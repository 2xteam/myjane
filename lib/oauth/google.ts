import type { OAuthProfile } from "@/lib/oauth/state";

/**
 * 구글 — OAuth 2.0 인가 코드 흐름 + OpenID Connect `id_token`.
 *
 * 환경 변수 `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` (포털 배포에만).
 * 리다이렉트 URI 는 `<포털 origin>/api/auth/oauth/google/callback` — Google Cloud Console 에 **정확히 같은 문자열**로
 * 등록해야 한다 (운영 · localhost:3000 둘).
 *
 * 프로필은 `id_token` 에서 읽고, 서명·대상(aud)·nonce 검증은 구글의 tokeninfo 엔드포인트에 맡긴다 —
 * JWKS 를 직접 다루는 것보다 단순하고, 서버에서 서버로 부르므로 위조할 수 없다.
 * 액세스 토큰은 쓰지 않고 버린다. 우리가 필요한 건 신원이지 구글 API 가 아니다.
 * → my-obsidian-vault / 50-Plans/G 소셜 로그인.md
 */

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleAuthUrl(args: { redirectUri: string; state: string; nonce: string }): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: args.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: args.state,
    nonce: args.nonce,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
}

export async function googleExchange(args: { code: string; redirectUri: string; nonce: string }): Promise<OAuthProfile> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: args.code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: args.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`구글 토큰 교환 실패 (${res.status})`);
  const tok = (await res.json()) as { id_token?: string };
  if (!tok.id_token) throw new Error("구글이 id_token 을 주지 않았습니다.");

  /* tokeninfo 가 서명·만료를 검증한다. aud 와 nonce 는 우리가 대조한다 */
  const info = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tok.id_token)}`);
  if (!info.ok) throw new Error("구글 id_token 검증 실패");
  const c = (await info.json()) as {
    aud?: string; sub?: string; email?: string; email_verified?: string | boolean; name?: string; picture?: string; nonce?: string;
    iss?: string;
  };
  if (c.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error("id_token 의 대상(aud)이 다릅니다.");
  if (c.nonce !== args.nonce) throw new Error("id_token 의 nonce 가 다릅니다.");
  if (c.iss !== "https://accounts.google.com" && c.iss !== "accounts.google.com") throw new Error("id_token 발급자가 다릅니다.");
  if (!c.sub) throw new Error("구글 계정 식별자가 없습니다.");

  return {
    provider: "google",
    providerId: c.sub,
    email: c.email ? c.email.toLowerCase() : null,
    emailVerified: c.email_verified === true || c.email_verified === "true",
    name: c.name ?? null,
    picture: c.picture ?? null,
  };
}
