import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { adminError, requireAdmin } from "@/lib/adminAuth";
import { loadSettings, publicSettings } from "@/lib/igTidy";
import { getIgBlockModel, getIgDailyModel, getIgPlayModel } from "@/models/IgTidy";

export const runtime = "nodejs";

/**
 * IG Tidy 현황 — 여러 사람의 기록을 모아 「몇 건에서 제한에 걸리나」 를 보고 하루 상한을 고른다(2026-11-08).
 * 관리 화면 「현황」 탭이 그린다. 운영자·마스터.
 *
 *   GET ?days=30 →
 *     { ok, days, since, until,
 *       actions: [{ action, cap, suggested, basis, lowData,
 *                   blocks, accounts, blockedPlays,
 *                   blockDay: Dist | null,     제한에 걸린 날 그 행동의 건수(blocks.today)
 *                   safeDay:  Dist | null }],  제한이 없던 날의 건수(daily — 그 아이디에 제한이 있던 날은 뺀다)
 *       series: [{ day, blocks, blockedPlays }],   기간의 날마다(빈 날도 0 으로)
 *       totals: { blocks, accounts, blockedPlays } }
 *     Dist = { n, min, p25, median, p75, p90, max }
 *
 * 어디서 읽나
 *   blocks  — 앱이 제한 안내를 받고 멈출 때 남긴 것. kind 는 **탭 종류**(follow · feed · aicomment …)이고
 *             today 는 그때까지 오늘 한 행동별 건수다. 탭 하나가 여러 행동을 하므로(팔로우 탭은 좋아요 · 메시지도 한다)
 *             아래 KIND_ACTIONS 로 탭 → 행동을 펼치고, 그날 그 행동을 실제로 한 것(today[행동] > 0)만 센다.
 *   daily   — 아이디별 날짜별 행동 건수(앱 PC 의 날짜 — 사용자가 한국이라 한국 날짜로 본다)
 *   plays   — status "blocked" 로 끝난 실행. 기록(blocks)이 아직 올라오지 않은 제한도 여기서 보인다(건수 분포는 없다)
 *
 * 추천 상한(suggested) 규칙 — 보수적으로 잡는다
 *   ① 제한에 걸린 날 건수의 아래쪽 25%(p25) × 0.8 — "걸린 사람 넷 중 하나는 이보다 적게 하고도 걸렸다" 에서 20% 더 물린다
 *   ② 단, 제한 없던 날 건수의 p90 을 넘지 않는다 — 실제로 무사히 해 본 적이 거의 없는 높이로 올려 잡지 않는다
 *   ③ 20 이상이면 5 단위로 내림. 1 보다 작으면 추천하지 않는다(null)
 *   제한 기록이 없으면 추천하지 않는다(null — 지금 값 유지). 제한 기록이 3건 미만이면 lowData = true(근거 적음).
 */

/** 하루 상한 칸 — 운영 설정의 dailyCaps 와 같다 */
const ACTIONS = ["follow", "unfollow", "like", "feed", "story", "comment", "dm"] as const;
type Action = (typeof ACTIONS)[number];

/* 탭 → 그 탭이 하는 행동. 앱의 KIND_ACTIONS 와 같다 → ig-tidy-desktop/app/main.js
   (aicomment 는 대상에 따라 like 또는 feed 를 누른다 — 둘 다 넣고 today 가 0 인 칸은 저절로 빠진다) */
const KIND_ACTIONS: Record<string, Action[]> = {
  feed: ["feed", "comment"], story: ["story"], like: ["like"], aicomment: ["comment", "feed", "like"],
  follow: ["follow", "like", "dm", "comment"],
  unfollow: ["unfollow"], leavers: ["unfollow"], mutual: ["unfollow"], ratio: ["unfollow", "like"],
};

const SUGGEST_FACTOR = 0.8;
const LOW_DATA = 3;

type Dist = { n: number; min: number; p25: number; median: number; p75: number; p90: number; max: number };

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
function dist(values: number[]): Dist | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const r = (x: number) => Math.round(x * 10) / 10;
  return {
    n: s.length, min: s[0], p25: r(quantile(s, 0.25)), median: r(quantile(s, 0.5)),
    p75: r(quantile(s, 0.75)), p90: r(quantile(s, 0.9)), max: s[s.length - 1],
  };
}

function suggest(block: Dist | null, safe: Dist | null): { suggested: number | null; basis: string } {
  if (!block) return { suggested: null, basis: "기간 안에 제한 기록이 없어 지금 값을 그대로 둬요." };
  let v = Math.floor(block.p25 * SUGGEST_FACTOR);
  let basis = `걸린 날 p25 ${block.p25} × ${SUGGEST_FACTOR} = ${v}`;
  if (safe && v > safe.p90) {
    v = Math.floor(safe.p90);
    basis += ` → 무사한 날 p90 ${safe.p90} 을 넘지 않게 ${v}`;
  }
  if (v >= 20) v = Math.floor(v / 5) * 5;
  if (v < 1) return { suggested: null, basis: `${basis} — 너무 낮아 추천하지 않아요.` };
  return { suggested: v, basis };
}

const kstDay = (ms: number) => new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10);
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  try {
    const days = Math.max(1, Math.min(180, Math.floor(Number(new URL(req.url).searchParams.get("days")) || 30)));
    const now = Date.now();
    const sinceMs = now - days * 86_400_000;
    const sinceDay = kstDay(sinceMs);
    const untilDay = kstDay(now);

    await connectDB();
    const [settings, blocks, daily, plays] = await Promise.all([
      loadSettings(),
      getIgBlockModel().find({ at: { $gte: sinceMs } }, { uid: 1, igUsername: 1, at: 1, kind: 1, today: 1 }).lean().exec(),
      getIgDailyModel().find({ day: { $gte: sinceDay } }, { uid: 1, igUsername: 1, day: 1, counts: 1 }).lean().exec(),
      getIgPlayModel()
        .find({ status: "blocked", startedAt: { $gte: new Date(sinceMs) } }, { kind: 1, startedAt: 1, endedAt: 1, uid: 1, igUsername: 1 })
        .lean().exec(),
    ]);
    const caps = publicSettings(settings).dailyCaps;

    const acct = (r: { uid?: unknown; igUsername?: unknown }) => `${String(r.uid)}|${String(r.igUsername ?? "")}`;
    const blockDays = new Set<string>();      // 아이디|날짜 — 무사한 날에서 뺀다
    const blockVals: Record<Action, number[]> = Object.fromEntries(ACTIONS.map((a) => [a, []])) as unknown as Record<Action, number[]>;
    const blockAccts: Record<Action, Set<string>> = Object.fromEntries(ACTIONS.map((a) => [a, new Set<string>()])) as unknown as Record<Action, Set<string>>;
    const allAccts = new Set<string>();
    const series = new Map<string, { blocks: number; blockedPlays: number }>();
    for (let t = sinceMs; kstDay(t) <= untilDay; t += 86_400_000) series.set(kstDay(t), { blocks: 0, blockedPlays: 0 });

    for (const b of blocks as Array<Record<string, unknown>>) {
      const day = kstDay(num(b.at));
      const key = acct(b);
      blockDays.add(`${key}|${day}`);
      allAccts.add(key);
      const row = series.get(day);
      if (row) row.blocks += 1;
      const today = (b.today ?? {}) as Record<string, unknown>;
      const kinds = KIND_ACTIONS[String(b.kind ?? "")] ?? [...ACTIONS];   // 모르는 탭이면 그날 한 행동 전부
      for (const a of kinds) {
        const n = num(today[a]);
        if (n <= 0) continue;
        blockVals[a].push(n);
        blockAccts[a].add(key);
      }
    }

    const safeVals: Record<Action, number[]> = Object.fromEntries(ACTIONS.map((a) => [a, []])) as unknown as Record<Action, number[]>;
    for (const d of daily as Array<Record<string, unknown>>) {
      if (blockDays.has(`${acct(d)}|${String(d.day)}`)) continue;
      const counts = (d.counts ?? {}) as Record<string, unknown>;
      for (const a of ACTIONS) {
        const n = num(counts[a]);
        if (n > 0) safeVals[a].push(n);   // 그 행동을 안 한 날(0)은 "무사했다" 의 근거가 아니다
      }
    }

    const playCount: Record<Action, number> = Object.fromEntries(ACTIONS.map((a) => [a, 0])) as Record<Action, number>;
    for (const p of plays as Array<Record<string, unknown>>) {
      for (const a of KIND_ACTIONS[String(p.kind ?? "")] ?? []) playCount[a] += 1;
      const at = (p.endedAt instanceof Date ? p.endedAt : p.startedAt) as Date | undefined;
      const row = at instanceof Date ? series.get(kstDay(at.getTime())) : undefined;
      if (row) row.blockedPlays += 1;
    }

    const actions = ACTIONS.map((action) => {
      const blockDay = dist(blockVals[action]);
      const safeDay = dist(safeVals[action]);
      const s = suggest(blockDay, safeDay);
      return {
        action,
        cap: num(caps[action]),
        suggested: s.suggested,
        basis: s.basis,
        lowData: blockVals[action].length > 0 && blockVals[action].length < LOW_DATA,
        blocks: blockVals[action].length,
        accounts: blockAccts[action].size,
        blockedPlays: playCount[action],
        blockDay,
        safeDay,
      };
    });

    return NextResponse.json({
      ok: true,
      days,
      since: sinceDay,
      until: untilDay,
      actions,
      series: [...series.entries()].map(([day, v]) => ({ day, ...v })),
      totals: { blocks: blocks.length, accounts: allAccts.size, blockedPlays: plays.length },
      rule: { factor: SUGGEST_FACTOR, lowData: LOW_DATA },
    });
  } catch (err) {
    return adminError(err);
  }
}
