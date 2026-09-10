import type { OAuthProfile } from "@/lib/oauth/state";

/**
 * 네이버 — OAuth 2.0 인가 코드 흐름 (네이버 로그인).
 *
 * 환경 변수 `NAVER_CLIENT_ID` · `NAVER_CLIENT_SECRET` (Naver Developers 애플리케이션의 Client ID / Secret).
 * 리다이렉트(Callback) URI 는 `<포털 origin>/api/auth/oauth/naver/callback` — 콘솔에 정확히 같은 문자열로 등록.
 *
 * 프로필은 `GET https://openapi.naver.com/v1/nid/me`. 이메일은 네이버 계정에 확인된 주소라 **검증된 것**으로 본다
 * (제공 정보에서 이메일을 "필수" 로 켜 두어야 늘 온다). 액세스 토큰은 여기서 버린다.
 * → my-obsidian-vault / 50-Plans/G 소셜 로그인.md
 */

export function naverConfigured(): boolean {
  return Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);
}

export function naverAuthUrl(args: { redirectUri: string; state: string }): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: process.env.NAVER_CLIENT_ID ?? "",
    redirect_uri: args.redirectUri,
    state: args.state,
  });
  return `https://nid.naver.com/oauth2.0/authorize?${q.toString()}`;
}

export async function naverExchange(args: { code: string; state: string }): Promise<OAuthProfile> {
  const q = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.NAVER_CLIENT_ID ?? "",
    client_secret: process.env.NAVER_CLIENT_SECRET ?? "",
    code: args.code,
    state: args.state,
  });
  const res = await fetch(`https://nid.naver.com/oauth2.0/token?${q.toString()}`);
  if (!res.ok) throw new Error(`네이버 토큰 교환 실패 (${res.status})`);
  const tok = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!tok.access_token) throw new Error(`네이버가 access_token 을 주지 않았습니다 (${tok.error ?? ""} ${tok.error_description ?? ""})`);

  const me = await fetch("https://openapi.naver.com/v1/nid/me", { headers: { authorization: `Bearer ${tok.access_token}` } });
  if (!me.ok) throw new Error(`네이버 프로필 조회 실패 (${me.status})`);
  const body = (await me.json()) as {
    resultcode?: string;
    response?: { id?: string; email?: string; nickname?: string; name?: string; profile_image?: string };
  };
  if (body.resultcode !== "00" || !body.response?.id) throw new Error("네이버 계정 식별자가 없습니다.");
  const r = body.response;
  const email = r.email ? r.email.toLowerCase() : null;

  return {
    provider: "naver",
    providerId: r.id!,
    email,
    emailVerified: Boolean(email),
    name: r.nickname ?? r.name ?? null,
    picture: r.profile_image ?? null,
  };
}
