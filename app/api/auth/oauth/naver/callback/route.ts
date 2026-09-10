import { handleOAuthCallback } from "@/lib/oauth/callback";
import { naverConfigured, naverExchange } from "@/lib/oauth/naver";

export const runtime = "nodejs";

/** 네이버 콜백 — 매칭·세션은 공용(lib/oauth/callback.ts). 네이버 토큰 교환에는 state 도 함께 보낸다 */
export async function GET(req: Request) {
  const state = new URL(req.url).searchParams.get("state") ?? "";
  return handleOAuthCallback(req, "naver", naverConfigured(), ({ code }) => naverExchange({ code, state }));
}
