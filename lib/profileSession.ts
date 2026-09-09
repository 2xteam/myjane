import { NextResponse } from "next/server";
import { sessionCookieHeaders, withSetCookies } from "@/lib/sessionCookie";
import { signSessionToken } from "@/lib/sessionToken";
import type { UserDocument } from "@/models/User";

/**
 * 프로필(보호자 본인 또는 자녀)로 세션을 발급한다 — 로그인 · 프로필 고르기 · 전환이 함께 쓴다.
 *
 * 자녀면 토큰에 `gid`(보호자 `_id`)가 실린다. 앱은 `uid` 만 보므로 자녀 기록은 자녀 문서에 쌓이고,
 * 포털의 계정 설정 라우트는 `gid` 를 보고 막는다 → lib/serverSession.ts
 * 표시용 쿠키에는 이름·닉네임·userId 만 — 전화번호·이메일은 넣지 않는다.
 */
export function issueProfileSession(req: Request, profile: UserDocument, guardian: UserDocument | null) {
  const token = signSessionToken(
    String(profile._id),
    profile.userId ?? "",
    profile.sessionVersion ?? 0,
    guardian ? String(guardian._id) : undefined,
  );
  return withSetCookies(
    NextResponse.json({
      ok: true,
      user: {
        id: String(profile._id),
        name: profile.nickname ?? profile.name ?? "",
        nickname: profile.nickname ?? "",
        userId: profile.userId,
        /* 자녀 프로필은 이메일이 없는 것이 정상이다 — 앱 배너가 "등록하라" 고 하지 않게 표시한다 */
        hasEmail: guardian ? true : Boolean(profile.email),
        ...(guardian ? { child: true } : {}),
      },
    }),
    sessionCookieHeaders(req, token),
  );
}
