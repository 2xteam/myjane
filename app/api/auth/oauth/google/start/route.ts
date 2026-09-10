import { NextResponse } from "next/server";
import { googleAuthUrl, googleConfigured } from "@/lib/oauth/google";
import { append, OAUTH_STATE_COOKIE, portalOrigin, randomToken, setCookieHeader, sign, type OAuthState } from "@/lib/oauth/state";
import { getSessionClaims } from "@/lib/serverSession";

export const runtime = "nodejs";

/**
 * 구글 로그인 시작 — state·nonce 를 서명 쿠키에 담고 구글 동의 화면으로 302.
 * `?from=<앱>&next=<경로>` 는 쿠키에 실어 두었다가 콜백에서 꺼낸다.
 * 로그인한 상태로 오면(`linkTo`) 그 회원에 연결만 한다.
 */
export async function GET(req: Request) {
  if (!googleConfigured()) {
    return NextResponse.json({ ok: false, error: "구글 로그인이 아직 설정되지 않았습니다." }, { status: 503 });
  }
  const url = new URL(req.url);
  const claims = getSessionClaims(req);
  const st: OAuthState = {
    state: randomToken(),
    nonce: randomToken(),
    provider: "google",
    from: url.searchParams.get("from"),
    next: url.searchParams.get("next"),
    linkTo: url.searchParams.get("link") === "1" && claims && !claims.gid ? claims.uid : null,
  };
  const redirectUri = `${portalOrigin(req)}/api/auth/oauth/google/callback`;
  const res = NextResponse.redirect(googleAuthUrl({ redirectUri, state: st.state, nonce: st.nonce }), 302);
  return append(res, [setCookieHeader(req, OAUTH_STATE_COOKIE, sign("state", st))]);
}
