import { handleOAuthCallback } from "@/lib/oauth/callback";
import { googleConfigured, googleExchange } from "@/lib/oauth/google";

export const runtime = "nodejs";

/** 구글 콜백 — 매칭·세션은 공용(lib/oauth/callback.ts). 교환만 구글 것(id_token 검증) */
export async function GET(req: Request) {
  return handleOAuthCallback(req, "google", googleConfigured(), googleExchange);
}
