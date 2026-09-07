import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { SESSION_KEY } from "@/lib/session";
import { verifySessionToken } from "@/lib/sessionToken";
import { getUserModel, type UserDocument } from "@/models/User";

/**
 * 라우트에서 "지금 요청을 보낸 사람"을 확인한다.
 *
 * `snap_user` 쿠키의 본문은 **클라이언트가 마음대로 쓸 수 있는 평문 JSON**이다.
 * 그래서 그 안의 `id`나 요청 본문의 `phone`·`userId` 를 그대로 믿으면 아무나
 * 남의 계정을 건드릴 수 있다. 같은 쿠키의 HMAC 서명 토큰만 신뢰한다.
 *
 * `lib/adminAuth.ts` 가 admin 용으로 먼저 쓰던 방식을 그대로 꺼냈다.
 * admin 이 아닌 일반 회원 동작(이메일 등록·인증 재발송)도 같은 확인이 필요하다.
 *
 * → my-obsidian-vault / 30-Patterns/인증과 세션 공유.md 의 "쿠키의 id를 믿지 않는다"
 */

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  const prefix = name + "=";
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(prefix)) continue;
    try {
      return decodeURIComponent(trimmed.slice(prefix.length));
    } catch {
      return null;
    }
  }
  return null;
}

/** `Authorization: Bearer …` 를 먼저 보고, 없으면 세션 쿠키의 `token` 을 꺼낸다 */
export function readSessionToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();

  const raw = readCookie(req, SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { token?: unknown };
    return typeof parsed.token === "string" ? parsed.token : null;
  } catch {
    return null;
  }
}

/** 서명이 유효한 세션이 가리키는 회원 문서. 없으면 `null` */
export async function getSessionUser(req: Request): Promise<UserDocument | null> {
  const claims = verifySessionToken(readSessionToken(req));
  if (!claims) return null;

  await connectDB();
  return getUserModel().findOne({ userId: claims.u }).exec();
}

/**
 * 로그인이 필요한 라우트에서 쓴다. 확인되지 않으면 401 응답을 돌려준다.
 *
 * ⚠️ 전화번호+PIN 으로 만든 옛 세션에는 토큰이 없을 수 있다. 그때는 여기서
 * 401 이 나가고 화면이 다시 로그인하도록 안내해야 한다 — 조용히 통과시키면
 * 처음에 이 토큰을 도입한 이유가 사라진다.
 */
export async function requireSessionUser(
  req: Request,
): Promise<{ user: UserDocument } | { error: NextResponse }> {
  const user = await getSessionUser(req);
  if (!user) {
    return {
      error: NextResponse.json(
        { ok: false, error: "로그인이 필요합니다. 다시 로그인해 주세요." },
        { status: 401 },
      ),
    };
  }
  return { user };
}
