import { clientIp } from "@/lib/loginThrottle";
import { displayUser } from "@/lib/profileSession";
import { SESSION_KEY } from "@/lib/session";
import {
  ADMIN_RESTORE_COOKIE,
  IMPERSONATION_COOKIE,
  SESSION_COOKIE,
  SESSION_MARK_COOKIE,
  cookieDomainFor,
  readCookieValues,
  serializeCookie,
} from "@/lib/sessionCookie";
import { signSessionToken, verifySessionToken } from "@/lib/sessionToken";
import { getAdminAuditLogModel } from "@/models/AdminAuditLog";
import type { UserDocument } from "@/models/User";

/**
 * 관리자 **대리 로그인** — 관리자가 고객 계정으로 들어가 고객이 보는 화면을 그대로 본다.
 *
 * 흐름
 *   시작  /admin 회원 → POST /api/admin/users/:id/impersonate
 *         고객 토큰(1시간, `imp` = 관리자 _id)을 snap_session 에 심고, 관리자 본인 토큰은
 *         snap_admin_restore 에 맡긴다. 읽을 수 있는 표지 snap_imp 로 앱들이 경고 바를 그린다
 *   연장  남은 시간 5분 이내에만. POST /api/impersonation/extend → 만료를 1시간 늘린다
 *   종료  POST /api/impersonation/end(바의 "종료" · 시간이 다 되면 자동) → 관리자 세션을 되돌린다
 *
 * 규칙
 *   - 만료는 **토큰의 exp** 가 정한다. 모든 앱이 exp 를 검사하므로 1시간 뒤 함께 끊긴다
 *   - snap_imp 는 표시용이다. 권한 판단은 언제나 서명 토큰의 `imp` · `exp` 로 한다
 *   - 관리자 계정으로는 대리 로그인할 수 없다
 *   - 대리 세션에서는 계정 설정(비밀번호·탈퇴·이메일·동의·자녀·프로필 전환·소셜 연결)을 막는다
 *     → lib/serverSession.ts requireSessionUser
 *   - 시작·연장·종료를 모두 admin_audit_logs 에 남긴다
 *
 * → my-obsidian-vault / 30-Patterns/통합 admin.md "대리 로그인"
 */

/** 한 번에 주는 시간(초) — 시작과 연장 모두 1시간 */
export const IMPERSONATION_TTL_SEC = 60 * 60;
/** 남은 시간이 이 안으로 들어와야 연장할 수 있다 */
export const IMPERSONATION_EXTEND_WINDOW_SEC = 5 * 60;
/**
 * 표지 쿠키는 만료 뒤에도 잠깐 남긴다. 세션과 같이 사라지면 경고 바가 "0초" 를 보지 못해
 * 자동 종료(관리자 세션 되돌리기)를 보내지 못한다.
 */
const MARK_GRACE_SEC = 10 * 60;
/** 되돌릴 관리자 세션을 맡겨 두는 기간 — 대리 세션보다 넉넉히 */
const RESTORE_TTL_SEC = 24 * 60 * 60;

/** 표지 쿠키 내용 — 앱의 ImpersonationBar 가 읽는다 */
export type ImpersonationMark = {
  /** 만료 시각(epoch 초) */
  exp: number;
  /** 들어가 있는 고객 이름 */
  name: string;
  /** 대리 로그인한 관리자 이름 */
  by: string;
};

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/** 고객 토큰 · 표시용 snap_user · 표지를 **만료 시각까지만** 살아 있게 심는다 */
export function impersonationCookieHeaders(
  req: Request,
  target: UserDocument,
  admin: UserDocument,
  exp: number,
): string[] {
  const domain = cookieDomainFor(req);
  const maxAge = Math.max(0, exp - nowSec());
  const token = signSessionToken(
    String(target._id),
    target.userId ?? "",
    target.sessionVersion ?? 0,
    undefined,
    { exp, imp: String(admin._id) },
  );
  const display = JSON.stringify({ v: 1, user: displayUser(target, null), expiresAt: exp * 1000 });
  const mark: ImpersonationMark = {
    exp,
    name: target.nickname ?? target.name ?? target.email ?? "고객",
    by: admin.nickname ?? admin.name ?? "관리자",
  };
  return [
    serializeCookie(SESSION_COOKIE, token, req, { maxAge, httpOnly: true, domain }),
    serializeCookie(SESSION_MARK_COOKIE, "1", req, { maxAge, httpOnly: false, domain }),
    serializeCookie(SESSION_KEY, display, req, { maxAge, httpOnly: false, domain }),
    serializeCookie(IMPERSONATION_COOKIE, JSON.stringify(mark), req, { maxAge: maxAge + MARK_GRACE_SEC, httpOnly: false, domain }),
  ];
}

/** 관리자 본인 토큰을 맡긴다(HttpOnly) — 종료할 때 되돌린다 */
export function restoreCookieHeader(req: Request, adminToken: string): string {
  return serializeCookie(ADMIN_RESTORE_COOKIE, adminToken, req, {
    maxAge: RESTORE_TTL_SEC,
    httpOnly: true,
    domain: cookieDomainFor(req),
  });
}

/** 표지와 맡긴 토큰을 지운다(도메인·host-only 둘 다) */
export function clearImpersonationHeaders(req: Request): string[] {
  const domain = cookieDomainFor(req);
  const out: string[] = [];
  for (const name of [IMPERSONATION_COOKIE, ADMIN_RESTORE_COOKIE]) {
    const httpOnly = name === ADMIN_RESTORE_COOKIE;
    if (domain) out.push(serializeCookie(name, "", req, { maxAge: 0, httpOnly, domain }));
    out.push(serializeCookie(name, "", req, { maxAge: 0, httpOnly }));
  }
  return out;
}

/** 맡겨 둔 관리자 토큰. 서명·만료가 유효할 때만 */
export function readRestoreClaims(req: Request) {
  for (const v of readCookieValues(req, ADMIN_RESTORE_COOKIE)) {
    const claims = verifySessionToken(v);
    if (claims && !claims.imp) return { token: v, claims };
  }
  return null;
}

export function isAdminDoc(doc: UserDocument | null | undefined): doc is UserDocument {
  return Boolean(doc && (doc.adminRole === "master" || doc.adminRole === "operator"));
}

/**
 * 돌아갈 주소 — **우리 도메인만.** 앱의 경고 바가 `next` 로 지금 주소를 넘긴다.
 * 다른 사이트로 튕기는 오픈 리다이렉트를 막는다.
 */
export function safeReturnUrl(req: Request, next: string | null | undefined, fallbackPath: string): string {
  const origin = new URL(req.url).origin;
  if (!next) return `${origin}${fallbackPath}`;
  try {
    const u = new URL(next, origin);
    const host = u.hostname.toLowerCase();
    const ok =
      (u.protocol === "https:" || u.protocol === "http:") &&
      (host === "myjane.co.kr" ||
        host.endsWith(".myjane.co.kr") ||
        host === "localhost" ||
        host === "127.0.0.1");
    return ok ? u.toString() : `${origin}${fallbackPath}`;
  } catch {
    return `${origin}${fallbackPath}`;
  }
}

/**
 * 폼 POST 가 우리 도메인에서 왔는가. 쿠키가 SameSite=Lax 라 다른 사이트의 POST 에는
 * 쿠키가 실리지 않지만, Origin 이 있으면 한 번 더 본다.
 */
export function isSameSiteRequest(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin || origin === "null") return true;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === "myjane.co.kr" || host.endsWith(".myjane.co.kr") || host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

export async function auditImpersonation(
  req: Request,
  entry: {
    action: "impersonate.start" | "impersonate.extend" | "impersonate.end" | "impersonate.expire";
    admin: UserDocument;
    target: UserDocument | null;
    expiresAt?: number | null;
  },
): Promise<void> {
  try {
    await getAdminAuditLogModel().create({
      action: entry.action,
      adminId: entry.admin._id,
      adminName: entry.admin.nickname ?? entry.admin.name ?? "",
      targetId: entry.target?._id ?? null,
      targetName: entry.target ? entry.target.nickname ?? entry.target.name ?? "" : "",
      expiresAt: entry.expiresAt ? new Date(entry.expiresAt * 1000) : null,
      ip: clientIp(req),
      userAgent: (req.headers.get("user-agent") ?? "").slice(0, 300),
    });
  } catch (err) {
    // 기록 실패로 관리자를 고객 계정에 가둬 두지 않는다. 서버 로그에는 남긴다
    console.error("[impersonation] 감사 기록 실패", err);
  }
}

