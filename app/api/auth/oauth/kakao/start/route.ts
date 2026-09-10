import { NextResponse } from "next/server";
import { kakaoAuthUrl, kakaoConfigured } from "@/lib/oauth/kakao";
import { append, OAUTH_STATE_COOKIE, portalOrigin, randomToken, setCookieHeader, sign, type OAuthState } from "@/lib/oauth/state";
import { getSessionClaims } from "@/lib/serverSession";

export const runtime = "nodejs";

/** 카카오 로그인 시작 — 구글 start 와 같은 모양. → lib/oauth/kakao.ts */
export async function GET(req: Request) {
  if (!kakaoConfigured()) {
    return NextResponse.json({ ok: false, error: "카카오 로그인이 아직 설정되지 않았습니다." }, { status: 503 });
  }
  const url = new URL(req.url);
  const claims = getSessionClaims(req);
  const st: OAuthState = {
    state: randomToken(),
    nonce: randomToken(),
    provider: "kakao",
    from: url.searchParams.get("from"),
    next: url.searchParams.get("next"),
    linkTo: url.searchParams.get("link") === "1" && claims && !claims.gid ? claims.uid : null,
  };
  const redirectUri = `${portalOrigin(req)}/api/auth/oauth/kakao/callback`;
  const res = NextResponse.redirect(kakaoAuthUrl({ redirectUri, state: st.state }), 302);
  return append(res, [setCookieHeader(req, OAUTH_STATE_COOKIE, sign("state", st))]);
}
