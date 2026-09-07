import { NextResponse } from "next/server";
import {
  RESEND_COOLDOWN_MS,
  issueEmailToken,
  remainingCooldownMs,
} from "@/lib/emailVerification";
import { requireSessionUser } from "@/lib/serverSession";

export const runtime = "nodejs";

/**
 * 인증 메일 재발송.
 *
 * 여기는 **세션이 필요하다.** 이메일 주소만 받고 보내 주면 남의 주소로 메일을
 * 쏟아붓는 도구가 된다. 지금 로그인한 사람의 계정에 등록된 주소로만 보낸다.
 *
 * 쿨다운 60초 → lib/emailVerification.ts
 */
export async function POST(req: Request) {
  try {
    const auth = await requireSessionUser(req);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    /*
      인증 대기 중인 주소가 있으면 **그쪽으로** 보낸다.
      전화번호만 있던 계정이 이메일을 등록한 직후가 이 상태다 —
      `email` 은 아직 비어 있고 `pendingEmail` 에만 값이 있다.
    */
    const target = user.pendingEmail ?? user.email;

    if (!target) {
      return NextResponse.json(
        { ok: false, error: "등록된 이메일이 없습니다. 이메일을 먼저 등록해 주세요." },
        { status: 400 },
      );
    }

    if (user.emailVerified && !user.pendingEmail) {
      // 이미 끝난 일이다. 메일을 또 보내지 않는다
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }

    const left = remainingCooldownMs(user);
    if (left > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `잠시 후에 다시 시도해 주세요. (${Math.ceil(left / 1000)}초)`,
          retryAfterMs: left,
        },
        { status: 429 },
      );
    }

    await issueEmailToken(user, target);
    await user.save();

    return NextResponse.json({
      ok: true,
      email: target,
      cooldownMs: RESEND_COOLDOWN_MS,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
