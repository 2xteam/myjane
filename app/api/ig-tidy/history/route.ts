import { NextResponse } from "next/server";
import type { AnyBulkWriteOperation } from "mongoose";
import { connectDB } from "@/lib/db";
import { igError, livePlay, normalizeIg, playSummary, requireIgTidyUser } from "@/lib/igTidy";
import {
  getIgAccountModel,
  getIgBlockModel,
  getIgDailyModel,
  getIgPersonModel,
  getIgSnapshotModel,
} from "@/models/IgTidy";

export const runtime = "nodejs";

/**
 * 구조화된 히스토리 — 인스타그램 아이디별.
 *
 *   GET ?ig=zang.f1t
 *     → { people: { <상대>: {fSince, …} }, daily: { <날짜>: {…} }, snapshots: [...], blocks: [...] }
 *       다른 PC 에서 처음 열 때 앱이 이것으로 확장 모양의 `history` 를 되살린다.
 *
 *   PUT { igUsername, deviceId,
 *         people:    { <상대>: {칸…} | null },   ← 바뀐 사람만. null 은 지움
 *         daily:     { <날짜>: {…} | null },
 *         snapshots: [{ at, …값 }],               ← 같은 날은 덮어쓴다
 *         blocks:    [{ at, kind, reason, today }] }
 *
 * 앱(동기화 층)이 확장의 `history` 와 직전에 올린 것을 견줘 **바뀐 것만** 보낸다.
 * 사람 문서는 통째로 바꿔 쓴다(replace) — 앱이 그 사람의 전체 칸을 보내므로 빠진 칸은 지운 것이다.
 *
 * 다른 PC 가 실행 중이면 쓰지 못한다(409) — /api/ig-tidy/state 와 같은 까닭.
 */

const PERSON_FIELDS = [
  "fSince", "fSeen", "fGone", "fEst", "gSince", "gSeen", "gGone", "gEst",
  "unfollowedSeq", "droppedSeq", "triedN", "triedAt", "gaveUpTries", "gaveUpAt",
  "convertedTries", "convertedAt", "commentedAt", "dmSentAt",
] as const;
const DAY_RX = /^\d{4}-\d{2}-\d{2}$/;
const TARGET_RX = /^[A-Za-z0-9._]{1,30}$/;
const MAX_OPS = 20_000;

async function ownAccount(uid: unknown, ig: string) {
  const a = await getIgAccountModel().findOne({ igUsername: ig }).lean().exec();
  return !!a && String(a.uid) === String(uid) && !a.removedAt;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export async function GET(req: Request) {
  const auth = await requireIgTidyUser(req);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const ig = normalizeIg(new URL(req.url).searchParams.get("ig"));
  if (!ig) return igError("bad_request", "인스타그램 아이디가 없어요.", 400);

  await connectDB();
  if (!(await ownAccount(user._id, ig))) {
    return igError("account_taken", `@${ig} 는 이 계정에 등록된 아이디가 아니에요.`, 409);
  }

  const q = { uid: user._id, igUsername: ig };
  const [people, daily, snaps, blocks] = await Promise.all([
    getIgPersonModel().find(q).lean().exec(),
    getIgDailyModel().find(q).lean().exec(),
    getIgSnapshotModel().find(q).sort({ at: 1 }).lean().exec(),
    getIgBlockModel().find(q).sort({ at: -1 }).limit(50).lean().exec(),
  ]);

  const outPeople: Record<string, Record<string, unknown>> = {};
  for (const p of people) {
    const row: Record<string, unknown> = {};
    for (const f of PERSON_FIELDS) if (p[f] !== undefined && p[f] !== null) row[f] = p[f];
    if (p.skip) row.skip = true;
    outPeople[String(p.target)] = row;
  }
  const outDaily: Record<string, unknown> = {};
  for (const d of daily) outDaily[String(d.day)] = d.counts ?? {};

  return NextResponse.json({
    ok: true,
    igUsername: ig,
    people: outPeople,
    daily: outDaily,
    snapshots: snaps.map((s) => ({ at: s.at, ...((s.values as object) ?? {}) })),
    blocks: blocks.map((b) => ({ at: b.at, kind: b.kind, reason: b.reason, today: b.today ?? {} })),
  });
}

export async function PUT(req: Request) {
  const auth = await requireIgTidyUser(req);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const body = (await req.json().catch(() => ({}))) as {
    igUsername?: unknown; deviceId?: unknown; people?: unknown; daily?: unknown; snapshots?: unknown; blocks?: unknown;
  };
  const ig = normalizeIg(body.igUsername);
  const deviceId = String(body.deviceId ?? "").slice(0, 80);
  if (!ig || !deviceId) return igError("bad_request", "올릴 기록이 없어요.", 400);

  await connectDB();
  if (!(await ownAccount(user._id, ig))) {
    return igError("account_taken", `@${ig} 는 이 계정에 등록된 아이디가 아니에요.`, 409);
  }
  const live = await livePlay(user._id);
  if (live && live.deviceId !== deviceId) {
    return igError("busy_elsewhere", "다른 PC 에서 실행 중이라 이쪽 기록은 올리지 않았어요.", 409, {
      live: playSummary(live),
    });
  }

  const now = new Date();
  const base = { uid: user._id, igUsername: ig };

  // 사람
  const peopleOps: AnyBulkWriteOperation<Record<string, unknown>>[] = [];
  const people = body.people && typeof body.people === "object" ? (body.people as Record<string, unknown>) : {};
  for (const [target, raw] of Object.entries(people)) {
    if (!TARGET_RX.test(target)) continue;
    const filter = { ...base, target };
    if (raw === null) {
      peopleOps.push({ deleteOne: { filter } });
      continue;
    }
    const src = (raw ?? {}) as Record<string, unknown>;
    const doc: Record<string, unknown> = { ...filter, updatedAt: now };
    for (const f of PERSON_FIELDS) {
      const v = num(src[f]);
      if (v !== undefined) doc[f] = v;
    }
    if (src.skip === true) doc.skip = true;
    peopleOps.push({ replaceOne: { filter, replacement: doc, upsert: true } });
  }
  if (peopleOps.length > MAX_OPS) {
    return igError("bad_request", `한 번에 ${MAX_OPS}명까지 올릴 수 있어요.`, 400);
  }

  // 날짜별 건수
  const dailyOps: AnyBulkWriteOperation<Record<string, unknown>>[] = [];
  const daily = body.daily && typeof body.daily === "object" ? (body.daily as Record<string, unknown>) : {};
  for (const [day, counts] of Object.entries(daily)) {
    if (!DAY_RX.test(day)) continue;
    const filter = { ...base, day };
    if (counts === null) dailyOps.push({ deleteOne: { filter } });
    else dailyOps.push({ replaceOne: { filter, replacement: { ...filter, counts: counts ?? {}, updatedAt: now }, upsert: true } });
  }

  // 수집 시점 숫자(날짜가 열쇠) · 제한 기록(시각이 열쇠, 없는 것만 더한다)
  const snapOps: AnyBulkWriteOperation<Record<string, unknown>>[] = [];
  for (const s of Array.isArray(body.snapshots) ? (body.snapshots as Array<Record<string, unknown>>) : []) {
    const at = num(s?.at);
    if (at === undefined) continue;
    const { at: _at, ...values } = s;
    void _at;
    // 같은 날은 마지막 것 하나 — 확장의 takeSnapshot 과 같은 규칙. 날짜는 한국 시각으로
    const day = new Date(at + 9 * 3600 * 1000).toISOString().slice(0, 10);
    snapOps.push({ replaceOne: { filter: { ...base, day }, replacement: { ...base, day, at, values }, upsert: true } });
  }
  const blockOps: AnyBulkWriteOperation<Record<string, unknown>>[] = [];
  for (const b of Array.isArray(body.blocks) ? (body.blocks as Array<Record<string, unknown>>) : []) {
    const at = num(b?.at);
    if (at === undefined) continue;
    blockOps.push({
      updateOne: {
        filter: { ...base, at },
        update: {
          $setOnInsert: {
            ...base, at, kind: String(b.kind ?? "").slice(0, 20), reason: String(b.reason ?? "").slice(0, 300),
            today: b.today && typeof b.today === "object" ? b.today : {},
          },
        },
        upsert: true,
      },
    });
  }

  await Promise.all([
    peopleOps.length ? getIgPersonModel().bulkWrite(peopleOps, { ordered: false }) : null,
    dailyOps.length ? getIgDailyModel().bulkWrite(dailyOps, { ordered: false }) : null,
    snapOps.length ? getIgSnapshotModel().bulkWrite(snapOps, { ordered: false }) : null,
    blockOps.length ? getIgBlockModel().bulkWrite(blockOps, { ordered: false }) : null,
  ]);

  return NextResponse.json({
    ok: true,
    saved: { people: peopleOps.length, daily: dailyOps.length, snapshots: snapOps.length, blocks: blockOps.length },
    at: now.toISOString(),
  });
}
