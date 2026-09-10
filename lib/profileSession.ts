import { NextResponse } from "next/server";
import { SESSION_KEY, type SessionUser } from "@/lib/session";
import { cookieDomainFor, SESSION_COOKIE_TTL_SEC, sessionCookieHeaders, withSetCookies } from "@/lib/sessionCookie";
import { signSessionToken } from "@/lib/sessionToken";
import type { UserDocument } from "@/models/User";

/**
 * 프로필(보호자 본인 또는 자녀)로 세션을 발급한다 — 로그인 · 프로필 고르기 · 전환 · 소셜 콜백이 함께 쓴다.
 *
 * 자녀면 토큰에 `gid`(보호자 `_id`)가 실린다. 앱은 `uid` 만 보므로 자녀 기록은 자녀 문서에 쌓이고,
 * 포털의 계정 설정 라우트는 `gid` 를 보고 막는다 → lib/serverSession.ts
 * 표시용 쿠키에는 이름·닉네임·userId 만 — 전화번호·이메일은 넣지 않는다.
 */

export function displayUser(profile: UserDocument, guardian: UserDocument | null): SessionUser {
  return {
    id: String(profile._id),
    name: profile.nickname ?? profile.name ?? "",
    nickname: profile.nickname ?? "",
    userId: profile.userId ?? undefined,
    /* 자녀 프로필은 이메일이 없는 것이 정상이다 — 앱 배너가 "등록하라" 고 하지 않게 표시한다 */
    hasEmail: guardian ? true : Boolean(profile.email),
    ...(guardian ? { child: true } : {}),
  };
}

function sessionToken(profile: UserDocument, guardian: UserDocument | null): string {
  return signSessionToken(
    String(profile._id),
    profile.userId ?? "",
    profile.sessionVersion ?? 0,
    guardian ? String(guardian._id) : undefined,
  );
}

/**
 * 표시용 `snap_user` 쿠키를 서버가 직접 내린다 — 리다이렉트 흐름(소셜 콜백)에서는 JS 의 `saveSession()` 이
 * 돌 기회가 없다. 모양은 lib/session.ts 의 `saveSession` 과 같다(v1 · 토큰 없음).
 */
export function displayCookieHeader(req: Request, user: SessionUser): string {
  const payload = JSON.stringify({ v: 1, user, expiresAt: Date.now() + SESSION_COOKIE_TTL_SEC * 1000 });
  const domain = cookieDomainFor(req);
  const proto = req.headers.get("x-forwarded-proto");
  const host = (req.headers.get("host") ?? "").toLowerCase();
  const secure = proto ? proto.split(",")[0].trim() === "https" : !(host.startsWith("localhost") || host.startsWith("127.0.0.1"));
  let c = `${SESSION_KEY}=${encodeURIComponent(payload)}; Path=/; Max-Age=${SESSION_COOKIE_TTL_SEC}; SameSite=Lax`;
  if (domain) c += `; Domain=${domain}`;
  if (secure) c += "; Secure";
  return c;
}

/** JSON 응답 — 화면이 `saveSession(json.user)` 를 부르는 흐름 */
export function issueProfileSession(req: Request, profile: UserDocument, guardian: UserDocument | null) {
  return withSetCookies(
    NextResponse.json({ ok: true, user: displayUser(profile, guardian) }),
    sessionCookieHeaders(req, sessionToken(profile, guardian)),
  );
}

/** 302 응답 — 소셜 콜백처럼 화면을 거치지 않는 흐름. 표시용 쿠키까지 서버가 내린다 */
export function redirectWithSession(req: Request, profile: UserDocument, guardian: UserDocument | null, to: string) {
  const user = displayUser(profile, guardian);
  return withSetCookies(NextResponse.redirect(to, 302), [
    ...sessionCookieHeaders(req, sessionToken(profile, guardian)),
    displayCookieHeader(req, user),
  ]);
}
