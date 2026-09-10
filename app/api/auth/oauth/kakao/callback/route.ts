import { handleOAuthCallback } from "@/lib/oauth/callback";
import { kakaoConfigured, kakaoExchange } from "@/lib/oauth/kakao";

export const runtime = "nodejs";

/** 카카오 콜백 — 매칭·세션은 공용(lib/oauth/callback.ts). 교환만 카카오 것 */
export async function GET(req: Request) {
  return handleOAuthCallback(req, "kakao", kakaoConfigured(), ({ code, redirectUri }) => kakaoExchange({ code, redirectUri }));
}
