import type { OAuthProfile } from "@/lib/oauth/state";

/**
 * 카카오 — OAuth 2.0 인가 코드 흐름 (카카오 로그인).
 *
 * 환경 변수 `KAKAO_CLIENT_ID`(앱의 **REST API 키**) · `KAKAO_CLIENT_SECRET`(보안 탭에서 "Client Secret" 을 켰을 때만.
 * 켜지 않았으면 비워 둔다 — 그러면 토큰 요청에 넣지 않는다).
 * 리다이렉트 URI 는 `<포털 origin>/api/auth/oauth/kakao/callback` — Kakao Developers 에 정확히 같은 문자열로 등록.
 *
 * ⚠️ 이메일은 **선택 동의**로만 받을 수 있다(필수 동의는 비즈 앱). 사용자가 거부하면 `kakao_account.email` 이 없다 —
 * 그 경우 프로필의 email 이 null 로 가고, 동의 화면이 이메일을 입력받아 인증 메일을 보낸다(③).
 * 이메일이 와도 `is_email_verified` 가 false 면 검증된 것으로 보지 않는다 — 기존 계정 연결(②)에 쓰지 않는다.
 * → my-obsidian-vault / 50-Plans/G 소셜 로그인.md
 */

export function kakaoConfigured(): boolean {
  return Boolean(process.env.KAKAO_CLIENT_ID);
}

export function kakaoAuthUrl(args: { redirectUri: string; state: string }): string {
  const q = new URLSearchParams({
    client_id: process.env.KAKAO_CLIENT_ID ?? "",
    redirect_uri: args.redirectUri,
    response_type: "code",
    state: args.state,
  });
  /*
    scope 는 보내지 않는다 — 콘솔 [동의항목] 에 켜 둔 것을 카카오가 알아서 묻는다.
    개인 앱은 이메일(account_email)이 "권한 없음" 이라, scope 에 적으면 invalid_scope 로 거절된다
    (2026-09-10 콘솔 확인). 비즈 앱으로 전환해 이메일을 켜면 아무것도 바꾸지 않아도 이메일이 함께 온다.
  */
  return `https://kauth.kakao.com/oauth/authorize?${q.toString()}`;
}

export async function kakaoExchange(args: { code: string; redirectUri: string }): Promise<OAuthProfile> {
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.KAKAO_CLIENT_ID ?? "",
    redirect_uri: args.redirectUri,
    code: args.code,
  });
  if (process.env.KAKAO_CLIENT_SECRET) form.set("client_secret", process.env.KAKAO_CLIENT_SECRET);

  const res = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: form,
  });
  if (!res.ok) throw new Error(`카카오 토큰 교환 실패 (${res.status}) ${await res.text().catch(() => "")}`);
  const tok = (await res.json()) as { access_token?: string };
  if (!tok.access_token) throw new Error("카카오가 access_token 을 주지 않았습니다.");

  const me = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { authorization: `Bearer ${tok.access_token}`, "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
  });
  if (!me.ok) throw new Error(`카카오 프로필 조회 실패 (${me.status})`);
  const u = (await me.json()) as {
    id?: number | string;
    kakao_account?: {
      email?: string;
      is_email_valid?: boolean;
      is_email_verified?: boolean;
      profile?: { nickname?: string; profile_image_url?: string; thumbnail_image_url?: string };
    };
  };
  if (u.id === undefined || u.id === null) throw new Error("카카오 계정 식별자가 없습니다.");
  const acc = u.kakao_account ?? {};
  const email = acc.email ? acc.email.toLowerCase() : null;

  /* 액세스 토큰은 여기서 버린다 — 저장하지 않는다 */
  return {
    provider: "kakao",
    providerId: String(u.id),
    email,
    emailVerified: Boolean(email && acc.is_email_valid !== false && acc.is_email_verified === true),
    name: acc.profile?.nickname ?? null,
    picture: acc.profile?.profile_image_url ?? acc.profile?.thumbnail_image_url ?? null,
  };
}
