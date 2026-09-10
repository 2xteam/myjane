import { NextResponse } from "next/server";
import { googleConfigured } from "@/lib/oauth/google";
import { kakaoConfigured } from "@/lib/oauth/kakao";
import { naverConfigured } from "@/lib/oauth/naver";

export const runtime = "nodejs";

/** 로그인 화면이 어느 소셜 버튼을 그릴지 — 환경 변수가 있는 공급자만. 값은 공개해도 되는 것만 */
export async function GET() {
  return NextResponse.json({ ok: true, google: googleConfigured(), kakao: kakaoConfigured(), naver: naverConfigured() });
}
