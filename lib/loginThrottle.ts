import { NextResponse } from "next/server";
import { getLoginAttemptModel } from "@/models/LoginAttempt";

/**
 * 로그인 시도 제한.
 *
 * 전화번호 + 4자리 PIN 계정은 1만 번이면 전부 시도할 수 있다. 시도 횟수를 막지
 * 않으면 비밀번호 정책이 아무 의미가 없다.
 *
 *   식별자당  5회 / 15분   — 한 계정을 노리는 경우
 *   IP 당    30회 / 15분   — 여러 계정을 훑는 경우
 *
 * 순서: 비교 **전에** `check` → 실패하면 `hit` → 성공하면 `clear`.
 * 없는 계정도 `hit` 한다. 응답 문장은 기존과 같게 유지한다(계정 열거 방지).
 *
 * 남은 시간은 알려주지 않는다 — 공격자에게 리듬을 알려주는 셈이다.
 *
 * → my-obsidian-vault / 50-Plans/E 개인정보 보호 보강.md 4번
 */

export const WINDOW_SEC = 15 * 60;
export const LIMIT_PER_ID = 5;
export const LIMIT_PER_IP = 30;

export type ThrottleKeys = { id: string; ip: string };

/** 요청에서 식별자·IP 키를 만든다 */
export function throttleKeys(req: Request, identifier: string): ThrottleKeys {
  const id = identifier.trim().toLowerCase().replace(/[^a-z0-9@._+\-]/g, "");
  return { id: `id:${id || "-"}`, ip: `ip:${clientIp(req)}` };
}

/** Vercel 은 `x-forwarded-for` 첫 항목이 실제 클라이언트다 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** 막아야 하면 429 응답, 아니면 null */
export async function checkThrottle(keys: ThrottleKeys): Promise<NextResponse | null> {
  const Model = getLoginAttemptModel();
  const now = new Date();
  const rows = await Model.find({ key: { $in: [keys.id, keys.ip] }, expiresAt: { $gt: now } })
    .lean()
    .exec();

  const over = rows.some(
    (r) =>
      (r.key === keys.id && r.count >= LIMIT_PER_ID) ||
      (r.key === keys.ip && r.count >= LIMIT_PER_IP),
  );
  if (!over) return null;

  return NextResponse.json(
    { ok: false, error: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요." },
    { status: 429, headers: { "Retry-After": String(WINDOW_SEC) } },
  );
}

/** 실패 1회. 창이 닫혀 있었으면(TTL 이 지웠거나 만료) 새 창을 연다 */
export async function hitThrottle(keys: ThrottleKeys): Promise<void> {
  const Model = getLoginAttemptModel();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + WINDOW_SEC * 1000);

  for (const key of [keys.id, keys.ip]) {
    /*
      TTL 삭제는 최대 60초 늦을 수 있어 만료된 문서가 남아 있을 수 있다.
      만료됐으면 새 창으로 덮어쓴다 — 두 단계로 나눠 경쟁 상태를 좁힌다.
    */
    const reset = await Model.updateOne(
      { key, expiresAt: { $lte: now } },
      { $set: { count: 1, firstAt: now, expiresAt } },
    ).exec();
    if (reset.matchedCount > 0) continue;

    await Model.updateOne(
      { key },
      {
        $inc: { count: 1 },
        $setOnInsert: { firstAt: now, expiresAt },
      },
      { upsert: true },
    ).exec();
  }
}

/** 성공하면 그 식별자의 카운터를 지운다. IP 는 두지 않는다 — 남을 위해 열어 둘 이유가 없다 */
export async function clearThrottle(keys: ThrottleKeys): Promise<void> {
  await getLoginAttemptModel().deleteMany({ key: { $in: [keys.id, keys.ip] } }).exec();
}
