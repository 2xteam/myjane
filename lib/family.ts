import crypto from "node:crypto";
import mongoose from "mongoose";
import { POLICY_VERSION } from "@/lib/legalVersion";
import { getUserModel, type UserDocument } from "@/models/User";

/**
 * 보호자·자녀 계정.
 *
 * 만 14세 미만은 보호자가 가입하고 **그 계정 안에 자녀를 추가**한다 (2026-09-07 · 09-09 사용자 결정).
 *
 *   - 자녀는 `users` 의 **별도 문서**다. `parentId` 가 보호자 `_id` 를 가리킨다.
 *     기록의 소유자 키(`createdBy` · `userId`)가 회원 `_id` 라서, 자녀도 `_id` 를 가져야
 *     여섯 앱의 라우트가 그대로 돈다. 2hbk 팔로우를 위해 도메인 식별자 `userId` 도 만든다
 *   - 자녀 문서에는 **이메일·전화번호·비밀번호가 없다.** 아동에게서 연락처를 받지 않는 것이 핵심이다
 *   - 로그인은 보호자가 하고, **어느 프로필로 들어갈지 고른다.** 토큰의 `uid` 가 자녀 `_id` 가 되고
 *     `gid` 에 보호자 `_id` 가 실린다. 앱은 `uid` 만 보므로 앱 코드는 바뀌지 않는다
 *   - 자녀 프로필에서는 계정 설정(탈퇴·동의·이메일·비밀번호·자녀 관리)을 못 한다 → serverSession 의 `allowChild`
 *   - 자녀를 추가할 때 법정대리인 동의를 받고 시각을 남긴다. FitLog(건강정보)·AI(국외 이전) 동의는
 *     체크박스로 함께 받는다 — 자녀 문서의 `healthDataAgreedAt` 등에 남고, 앱의 게이트가 그 문서를 본다
 *   - 만 14세가 되면 보호자가 자녀의 이메일·비밀번호를 등록해 **독립**시킨다. 인증 링크를 누르면
 *     `parentId` 가 풀리고 그 뒤로는 자기 이메일로 로그인한다
 *   - 보호자가 자녀 프로필을 지우면 다섯 앱 데이터를 **즉시** 폐기한다 (6개월 보관 없음 — 탈퇴가 아니라 하위 데이터)
 *
 * → my-obsidian-vault / 50-Plans/F 보호자·자녀 계정.md
 */

export const MAX_CHILDREN = 5;
export const INDEPENDENCE_AGE = 14;
const PICK_TTL_SEC = 5 * 60;

export type ChildInput = {
  name: string;
  birthYear: number | null;
  consents: { guardian: boolean; health: boolean; overseas: boolean };
};

export function newUserId(): string {
  return `user_${Math.random().toString(36).slice(2, 11)}`;
}

export function isChild(doc: { parentId?: unknown; independentAt?: unknown }): boolean {
  return Boolean(doc.parentId) && !doc.independentAt;
}

/** 한국 나이가 아니라 **만 나이의 하한** — 올해 생일이 지났는지 모르므로 보수적으로 `올해 - 출생연도 - 1` */
export function minAge(birthYear: number | null | undefined, now = new Date()): number | null {
  if (!birthYear) return null;
  return now.getFullYear() - birthYear - 1;
}

export async function listChildren(guardianId: mongoose.Types.ObjectId | string) {
  return getUserModel()
    .find(
      { parentId: new mongoose.Types.ObjectId(String(guardianId)), independentAt: null, withdrawnAt: null },
      { name: 1, nickname: 1, userId: 1, birthYear: 1, healthDataAgreedAt: 1, overseasTransferAgreedAt: 1, guardianAgreedAt: 1, createdAt: 1, pendingEmail: 1, independenceOnVerify: 1 },
    )
    .sort({ createdAt: 1 })
    .exec();
}

export function validateChildInput(body: unknown): { ok: true; value: ChildInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name || name.length > 20) return { ok: false, error: "자녀 이름(별칭)은 1~20자로 입력해 주세요." };
  let birthYear: number | null = null;
  if (b.birthYear !== undefined && b.birthYear !== null && b.birthYear !== "") {
    const y = Number(b.birthYear);
    const thisYear = new Date().getFullYear();
    if (!Number.isInteger(y) || y < thisYear - 30 || y > thisYear) return { ok: false, error: "출생연도가 올바르지 않습니다." };
    birthYear = y;
  }
  const c = (b.consents ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    value: {
      name,
      birthYear,
      consents: { guardian: c.guardian === true, health: c.health === true, overseas: c.overseas === true },
    },
  };
}

/** 자녀 문서를 만든다. 보호자의 법정대리인 동의 시각도 처음이면 함께 남긴다 */
export async function createChild(guardian: UserDocument, input: ChildInput): Promise<UserDocument> {
  const User = getUserModel();
  const now = new Date();

  const count = await User.countDocuments({ parentId: guardian._id, independentAt: null, withdrawnAt: null }).exec();
  if (count >= MAX_CHILDREN) throw new Error(`자녀 프로필은 ${MAX_CHILDREN}명까지 추가할 수 있어요.`);

  const child = await User.create({
    _id: new mongoose.Types.ObjectId(),
    userId: newUserId(),
    name: input.name,
    nickname: input.name,
    parentId: guardian._id,
    birthYear: input.birthYear,
    email: null,
    phone: null,
    pin: null,
    password: null,
    emailVerified: false,
    tokens: 0,
    signupFrom: "child",
    createdAt: now,
    lastLoginAt: null,
    /* 보호자가 자녀를 대신해 동의했다 — 법정대리인 동의 시각이 곧 약관·방침 동의 시각이다 */
    termsAgreedAt: now,
    privacyAgreedAt: now,
    agreedPolicyVersion: POLICY_VERSION,
    guardianAgreedAt: now,
    healthDataAgreedAt: input.consents.health ? now : null,
    overseasTransferAgreedAt: input.consents.overseas ? now : null,
    sessionVersion: 0,
  });

  if (!guardian.guardianAgreedAt) {
    guardian.guardianAgreedAt = now;
    await guardian.save();
  }
  return child;
}

/* ── 프로필 고르기 토큰 — 로그인 직후 5분 동안만 유효한 1회성 서명 ── */

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET 환경 변수가 없거나 너무 짧습니다.");
  return s;
}
const b64 = (b: Buffer) => b.toString("base64url");
const hmac = (body: string) => b64(crypto.createHmac("sha256", secret()).update(`pick:${body}`).digest());

export function signPickToken(uid: string): string {
  const body = b64(Buffer.from(JSON.stringify({ uid, exp: Math.floor(Date.now() / 1000) + PICK_TTL_SEC }), "utf8"));
  return `${body}.${hmac(body)}`;
}

export function verifyPickToken(token: unknown): string | null {
  if (typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(body);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { uid?: unknown; exp?: unknown };
    if (typeof claims.uid !== "string" || typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) return null;
    return claims.uid;
  } catch {
    return null;
  }
}

/* ── 다섯 앱의 데이터 폐기 — 탈퇴 크론과 자녀 삭제가 같이 쓴다 ── */

/**
 * ⚠️ 앱마다 사용자를 가리키는 키가 다르다 (2026-09-08 실측).
 *   SnapWord · SnapNote · FitLog · TypeLog   회원 Mongo `_id`
 *   2hbk                                     도메인 식별자 `userId`
 */
export const PURGE_TARGETS = [
  { key: "SnapWord", env: "APP_SNAPWORD_ORIGIN", sends: "id" },
  { key: "SnapNote", env: "APP_SNAPNOTE_ORIGIN", sends: "id" },
  { key: "FitLog", env: "APP_FITLOG_ORIGIN", sends: "id" },
  { key: "2hbk", env: "APP_2HBK_ORIGIN", sends: "userId" },
  { key: "TypeLog", env: "APP_TYPELOG_ORIGIN", sends: "id" },
] as const;

/** 실패해도 던지지 않는다 — 여기서 멈추면 그 사람은 영영 폐기되지 않는다. 앱별 결과를 돌려준다 */
export async function purgeUserAcrossApps(target: { id: string; userId?: string | null }): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const app of PURGE_TARGETS) {
    const base = process.env[app.env];
    if (!base) { out[app.key] = "skipped(no origin)"; continue; }
    if (app.sends === "userId" && !target.userId) { out[app.key] = "skipped(no userId)"; continue; }
    const payload = app.sends === "userId" ? { userId: target.userId } : { id: target.id };
    try {
      const res = await fetch(`${base.replace(/\/+$/, "")}/api/admin/purge-user`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.ADMIN_API_SECRET ?? ""}` },
        body: JSON.stringify(payload),
      });
      out[app.key] = res.ok ? "ok" : `failed(${res.status})`;
      if (!res.ok) console.error(`[purge] ${app.key} 정리 실패 ${res.status} — ${target.userId ?? target.id}`);
    } catch (e) {
      out[app.key] = "failed(fetch)";
      console.error(`[purge] ${app.key} 정리 실패 — ${target.userId ?? target.id}`, e);
    }
  }
  return out;
}

/** 2hbk 에 가족 전원을 서로 팔로우시킨다 (2026-09-07 결정). 실패해도 자녀 추가는 성공이다 */
export async function familyFollow(userIds: string[]): Promise<boolean> {
  const base = process.env.APP_2HBK_ORIGIN;
  const ids = userIds.filter(Boolean);
  if (!base || ids.length < 2) return false;
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/api/admin/family-follow`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.ADMIN_API_SECRET ?? ""}` },
      body: JSON.stringify({ userIds: ids }),
    });
    if (!res.ok) console.error(`[family] 2hbk 가족 팔로우 실패 ${res.status}`);
    return res.ok;
  } catch (e) {
    console.error("[family] 2hbk 가족 팔로우 실패", e);
    return false;
  }
}
