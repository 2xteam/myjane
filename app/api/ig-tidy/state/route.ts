import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { igError, livePlay, normalizeIg, playSummary, requireIgTidyUser } from "@/lib/igTidy";
import { getIgAccountModel, getIgStateModel } from "@/models/IgTidy";

export const runtime = "nodejs";

/**
 * 인스타그램 아이디별 **덩어리 상태** — 구조로 나눌 까닭이 없는 것만 여기 둔다.
 *
 *   job        진행 중인 작업(큐·위치·집계) — 다른 PC 에서 「이어서 시작」
 *   formState  패널 설정
 *   lists      수집해 둔 팔로워·팔로잉 목록(캐시)
 *   historyMisc  히스토리 중 사람·날짜로 나뉘지 않는 작은 칸(peopleFrom · acted · touched)
 *
 * 사람·날짜·수집 시점으로 나뉘는 히스토리는 **구조화해서** `/api/ig-tidy/history` 가 맡는다.
 *
 *   GET  ?ig=zang.f1t            → 그 아이디의 모든 키와 값 (다른 PC 에서 처음 열 때)
 *   GET  ?ig=zang.f1t&keys=a,b   → 고른 키만
 *   PUT  { igUsername, deviceId, values: { key: value } }  → 바뀐 키만 올린다
 *
 * ⚠️ **다른 PC 가 실행 중이면 쓰지 못한다(409).** 실행 잠금은 "한 번에 한 곳만 쓴다" 를
 * 전제로 마지막 값이 이기게 해 두었다. 쉬고 있는 PC 가 낡은 기록을 올리면 실행 중인 쪽의
 * 기록을 덮는다.
 */

const MAX_KEY_BYTES = 8 * 1024 * 1024;
/** 받는 키 — 히스토리 본체(`history`)는 여기로 받지 않는다. 구조화된 쪽으로 보내야 한다 */
const KEYS = new Set(["job", "formState", "lists", "historyMisc", "dim"]);

async function ownAccount(uid: unknown, ig: string) {
  const a = await getIgAccountModel().findOne({ igUsername: ig }).lean().exec();
  return !!a && String(a.uid) === String(uid) && !a.removedAt;
}

export async function GET(req: Request) {
  const auth = await requireIgTidyUser(req);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const url = new URL(req.url);
  const ig = normalizeIg(url.searchParams.get("ig"));
  if (!ig) return igError("bad_request", "인스타그램 아이디가 없어요.", 400);

  await connectDB();
  if (!(await ownAccount(user._id, ig))) {
    return igError("account_taken", `@${ig} 는 이 계정에 등록된 아이디가 아니에요.`, 409);
  }

  const keys = (url.searchParams.get("keys") ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  const filter: Record<string, unknown> = { uid: user._id, igUsername: ig };
  if (keys.length) filter.key = { $in: keys };
  const rows = await getIgStateModel().find(filter).lean().exec();

  const values: Record<string, unknown> = {};
  const meta: Record<string, { updatedAt: string | null; bytes: number; deviceId: string }> = {};
  for (const r of rows) {
    try {
      values[r.key] = JSON.parse(r.json ?? "null");
    } catch {
      values[r.key] = null;
    }
    meta[r.key] = {
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : null,
      bytes: r.bytes ?? 0,
      deviceId: r.deviceId ?? "",
    };
  }
  return NextResponse.json({ ok: true, igUsername: ig, values, meta });
}

export async function PUT(req: Request) {
  const auth = await requireIgTidyUser(req);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const body = (await req.json().catch(() => ({}))) as { igUsername?: unknown; deviceId?: unknown; values?: unknown };
  const ig = normalizeIg(body.igUsername);
  const deviceId = String(body.deviceId ?? "").slice(0, 80);
  if (!ig || !deviceId || !body.values || typeof body.values !== "object") {
    return igError("bad_request", "올릴 기록이 없어요.", 400);
  }

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

  const States = getIgStateModel();
  const now = new Date();
  const saved: string[] = [];
  const skipped: { key: string; why: string }[] = [];
  for (const [key, value] of Object.entries(body.values as Record<string, unknown>)) {
    if (!KEYS.has(key)) { skipped.push({ key, why: "받지 않는 키" }); continue; }
    const json = JSON.stringify(value ?? null);
    const bytes = Buffer.byteLength(json, "utf8");
    if (bytes > MAX_KEY_BYTES) { skipped.push({ key, why: "8MB 초과" }); continue; }
    await States.updateOne(
      { uid: user._id, igUsername: ig, key },
      { $set: { json, bytes, updatedAt: now, deviceId } },
      { upsert: true },
    ).exec();
    saved.push(key);
  }
  return NextResponse.json({ ok: true, saved, skipped, at: now.toISOString() });
}
