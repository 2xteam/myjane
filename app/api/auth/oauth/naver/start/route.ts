import { NextResponse } from "next/server";
import { naverAuthUrl, naverConfigured } from "@/lib/oauth/naver";
import { append, OAUTH_STATE_COOKIE, portalOrigin, randomToken, setCookieHeader, sign, type OAuthState } from "@/lib/oauth/state";
import { getSessionClaims } from "@/lib/serverSession";

export const runtime = "nodejs";

/** 네이버 로그인 시작 — 구글·카카오 start 와 같은 모양. → lib/oauth/naver.ts */
export async function GET(req: Request) {
  if (!naverConfigured()) {
    return NextResponse.json({ ok: false, error: "네이버 로그인이 아직 설정되지 않았습니다." }, { status: 503 });
  }
  const url = new URL(req.url);
  const claims = getSessionClaims(req);
  const st: OAuthState = {
    state: randomToken(),
    nonce: randomToken(),
    provider: "naver",
    from: url.searchParams.get("from"),
    next: url.searchParams.get("next"),
    linkTo: url.searchParams.get("link") === "1" && claims && !claims.gid ? claims.uid : null,
  };
  const redirectUri = `${portalOrigin(req)}/api/auth/oauth/naver/callback`;
  const res = NextResponse.redirect(naverAuthUrl({ redirectUri, state: st.state }), 302);
  return append(res, [setCookieHeader(req, OAUTH_STATE_COOKIE, sign("state", st))]);
}
