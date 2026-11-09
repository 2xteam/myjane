import mongoose from "mongoose";
import { IG_TIDY_DB, getIgAiLogModel } from "@/models/IgTidy";

/**
 * OpenAI 하루 무료 토큰 — 남았으면 사진도 무료 모델로, 다 쓰면 gpt-6-luna 로(2026-11-08 사용자 결정).
 *
 * 무료 토큰(데이터 공유 대가)
 *   · 작은 모델 묶음(아래 FREE_MODELS)이 **함께** 하루 OPENAI_FREE_DAILY_TOKENS(기본 250만) 까지
 *   · 매일 **UTC 0시**(한국 오전 9시)에 다시 찬다. 넘기는 요청은 그 요청 전체가 정가
 *   · **조직 단위**다 — myjane · SnapWord · SnapNote 가 같은 키를 쓰니 셋이 나눠 쓴다
 *
 * 오늘 쓴 양을 어떻게 아나
 *   A. OPENAI_ADMIN_KEY 가 있으면 OpenAI 사용량 API(조직 전체 · 세 앱 합계)를 5분마다 한 번 읽어
 *      igtidy.free_usage 에 둔다(서버리스 인스턴스끼리 나눠 본다). 그 뒤 IG Tidy 가 쓴 것은 ai_logs 로 더한다
 *   B. 키가 없으면 ai_logs(IG Tidy 만) + 다른 앱 몫 OPENAI_FREE_RESERVE(기본 50만)
 *   어느 쪽이든 한도의 90% 에서 끊는다(사용량 API 가 몇 분 늦고, 다른 앱이 그 사이 쓸 수 있다)
 *
 * 관리자 키는 사용량 읽기에만 쓴다. 사용자가 OpenAI 설정 → Admin keys 에서 직접 만들어 Vercel 에 넣는다.
 * IG Tidy 는 SnapWord 와 키를 나눠(2026-11-08) OpenAI 프로젝트 「IG Tidy」 의 키를 쓴다. 무료 토큰은 그래도 **조직 전체**
 * 몫이라 끊는 판단은 조직 합계로 하고, OPENAI_PROJECT_ID 가 있으면 그중 IG Tidy 몫을 따로 보여 준다.
 */

/** 무료 묶음(하루 250만) 모델 — 이름 앞부분으로 맞춘다(gpt-4o-mini-2024-07-18 처럼 날짜가 붙어 온다) */
export const FREE_MODELS = [
  "gpt-5.4-mini", "gpt-5.4-nano", "gpt-5-mini", "gpt-5-nano",
  "gpt-4.1-mini", "gpt-4.1-nano", "gpt-4o-mini", "o3-mini", "o4-mini",
];
export const isFreeModel = (m: unknown) => {
  const s = String(m || "");
  return FREE_MODELS.some((f) => s === f || s.startsWith(`${f}-`));
};

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : d;
};
const freeDaily = () => num(process.env.OPENAI_FREE_DAILY_TOKENS, 2_500_000);
const reserve = () => num(process.env.OPENAI_FREE_RESERVE, 500_000);
const SAFETY = 0.9;
const API_EVERY_MS = 5 * 60_000;
/** 사진 한 건이 쓸 만큼 — 남은 양이 이보다 적으면 이번 사진은 유료 모델로 */
const PHOTO_ESTIMATE = 2_000;

/** 오늘(UTC) 0시 */
export function utcDayStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

type Snapshot = { _id: string; tokens: number; fetchedAt: Date; byModel?: Record<string, number>; project?: number | null };
const snapshots = () => mongoose.connection.useDb(IG_TIDY_DB, { useCache: true }).collection<Snapshot>("free_usage");

/** OpenAI 사용량 API — 오늘 무료 묶음 모델이 쓴 토큰(입력 + 출력) */
async function fetchOrgUsage(adminKey: string, since: Date): Promise<{ tokens: number; byModel: Record<string, number>; project: number | null }> {
  const projectId = (process.env.OPENAI_PROJECT_ID ?? "").trim();
  const url = new URL("https://api.openai.com/v1/organization/usage/completions");
  url.searchParams.set("start_time", String(Math.floor(since.getTime() / 1000)));
  url.searchParams.set("bucket_width", "1d");
  url.searchParams.append("group_by", "model");
  url.searchParams.append("group_by", "project_id");
  url.searchParams.set("limit", "2");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${adminKey}` }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`usage API ${res.status}`);
  const j = (await res.json()) as {
    data?: { results?: { model?: string; project_id?: string; input_tokens?: number; output_tokens?: number }[] }[];
  };
  const byModel: Record<string, number> = {};
  let tokens = 0;
  let project = 0;
  for (const b of j.data ?? []) {
    for (const r of b.results ?? []) {
      const t = (r.input_tokens ?? 0) + (r.output_tokens ?? 0);
      const m = String(r.model || "?");
      byModel[m] = (byModel[m] ?? 0) + t;
      if (isFreeModel(m)) tokens += t;
      if (projectId && r.project_id === projectId) project += t;
    }
  }
  return { tokens, byModel, project: projectId ? project : null };
}

/** ai_logs 에서 since 이후 무료 묶음 모델 토큰 */
async function logTokens(since: Date): Promise<number> {
  const rows = await getIgAiLogModel().aggregate<{ _id: string; t: number }>([
    { $match: { at: { $gte: since }, model: { $nin: [null, ""] } } },
    { $group: { _id: "$model", t: { $sum: { $ifNull: ["$totalTokens", 0] } } } },
  ]);
  return rows.filter((r) => isFreeModel(r._id)).reduce((s, r) => s + (r.t || 0), 0);
}

export type FreeUsage = {
  day: string;                 // UTC 날짜
  used: number;                // 오늘 무료 묶음에서 쓴 것(추정 포함)
  limit: number;               // 하루 무료 토큰
  cutoff: number;              // 여기서 끊는다(limit × 0.9)
  left: number;                // cutoff 까지 남은 것
  source: "api" | "logs";      // A(사용량 API + 기록) · B(기록 + 다른 앱 몫)
  apiAt: string | null;        // 사용량 API 를 마지막으로 읽은 때
  project: number | null;      // 그중 IG Tidy 프로젝트(OPENAI_PROJECT_ID)가 쓴 것 — 모든 모델, 사용량 API 기준
  apiError?: string;
};

let memo: { at: number; v: FreeUsage } | null = null;

/** 오늘 무료 토큰을 얼마나 썼나 — 30초는 인스턴스 안에서 재사용한다 */
export async function freeUsage(): Promise<FreeUsage> {
  if (memo && Date.now() - memo.at < 30_000 && memo.v.day === dayKey(utcDayStart())) return memo.v;
  const since = utcDayStart();
  const day = dayKey(since);
  const limit = freeDaily();
  const cutoff = Math.floor(limit * SAFETY);
  const adminKey = (process.env.OPENAI_ADMIN_KEY ?? "").trim();

  let v: FreeUsage | null = null;
  let apiError: string | undefined;
  if (adminKey) {
    try {
      const col = snapshots();
      let snap = await col.findOne({ _id: day });
      if (!snap || Date.now() - new Date(snap.fetchedAt).getTime() > API_EVERY_MS) {
        const fetchedAt = new Date();
        const r = await fetchOrgUsage(adminKey, since);
        snap = { _id: day, tokens: r.tokens, fetchedAt, byModel: r.byModel, project: r.project };
        await col.updateOne({ _id: day }, { $set: { tokens: r.tokens, fetchedAt, byModel: r.byModel, project: r.project } }, { upsert: true });
      }
      // 사용량 API 는 몇 분 늦다 — 읽은 때보다 조금 앞부터 IG Tidy 기록을 더한다(겹쳐 세는 쪽이 안전하다)
      const after = new Date(Math.max(since.getTime(), new Date(snap.fetchedAt).getTime() - 5 * 60_000));
      const used = snap.tokens + (await logTokens(after));
      v = { day, used, limit, cutoff, left: Math.max(0, cutoff - used), source: "api", apiAt: new Date(snap.fetchedAt).toISOString(), project: snap.project ?? null };
    } catch (e) {
      apiError = e instanceof Error ? e.message : String(e);
    }
  }
  if (!v) {
    const used = (await logTokens(since)) + reserve();
    v = { day, used, limit, cutoff, left: Math.max(0, cutoff - used), source: "logs", apiAt: null, project: null, ...(apiError ? { apiError } : {}) };
  }
  memo = { at: Date.now(), v };
  return v;
}

/** 이번 사진 댓글을 무료 모델로 보내도 되나 */
export async function photoFitsFree(): Promise<boolean> {
  try {
    return (await freeUsage()).left > PHOTO_ESTIMATE;
  } catch {
    return false;   // 모르면 유료(luna) 쪽 — 무료 한도를 넘겨 4o-mini 정가로 사진을 읽는 것보다 싸다
  }
}

/** 글 댓글 · 답글 하나를 무료 모델(gpt-5.4-mini)로 써도 되나 — 한 건 약 2,500 토큰 */
export async function textFitsFree(): Promise<boolean> {
  try {
    return (await freeUsage()).left > 3_000;
  } catch {
    return false;   // 모르면 싼 쪽(gpt-4o-mini)
  }
}

/** 방금 쓴 만큼 인스턴스 기억을 줄여 둔다 — 30초 사이 여러 건이 와도 넘치지 않게 */
export function noteFreeTokens(model: string, tokens: number | null | undefined) {
  if (!memo || !isFreeModel(model) || !tokens) return;
  memo.v = { ...memo.v, used: memo.v.used + tokens, left: Math.max(0, memo.v.left - tokens) };
}
