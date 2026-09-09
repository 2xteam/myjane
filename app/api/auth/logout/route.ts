import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/serverSession";
import { clearSessionCookieHeaders, withSetCookies } from "@/lib/sessionCookie";

export const runtime = "nodejs";

/**
 * 로그아웃.
 *
 *   POST {}              이 기기의 쿠키만 지운다
 *   POST { all: true }   **모든 기기** — `sessionVersion` 을 올려 지금까지 발급한 토큰을 전부 무효화한다
 *
 * `snap_session` 은 HttpOnly 라 JS 가 못 지운다. 그래서 `clearSession()` 이 이 라우트를 부른다.
 * 비밀번호 변경·탈퇴도 같은 방법으로 토큰을 폐기한다 → lib/sessionToken.ts 의 `sv`
 * → my-obsidian-vault / 50-Plans/E 개인정보 보호 보강.md 5번
 */
export async function POST(req: Request) {
  let all = false;
  try {
    const body = (await req.json()) as { all?: unknown };
    all = body?.all === true;
  } catch {
    /* 본문 없음 = 이 기기만 */
  }

  if (all) {
    const user = await getSessionUser(req);
    if (user) {
      user.sessionVersion = (user.sessionVersion ?? 0) + 1;
      await user.save();
    }
  }

  return withSetCookies(NextResponse.json({ ok: true, all }), clearSessionCookieHeaders(req));
}
