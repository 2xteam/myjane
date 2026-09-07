import { NextResponse } from "next/server";
import {
  issueEmailToken,
  normalizeEmail,
  remainingCooldownMs,
} from "@/lib/emailVerification";
import { requireSessionUser } from "@/lib/serverSession";
import { connectDB } from "@/lib/db";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

/**
 * 이미 쓰던 계정에 **이메일을 나중에 받는다.** 전화번호로만 가입한 사람용.
 *
 * 2026-09-07 에 두 가지를 고쳤다. 예전 이 라우트는 —
 *
 * 1. 권한을 **요청 본문의 `phone` + `userId`** 로만 확인했다. 쿠키도 아니고
 *    클라이언트가 보낸 값이라, 남의 `userId` 와 전화번호만 알면 그 계정에
 *    이메일을 심을 수 있었다. → 이제 세션의 **서명 토큰**으로 확인한다
 * 2. 받은 주소를 **인증 없이 바로 `email` 에 저장**했다. 남의 주소를 넣어도
 *    그대로 들어갔고, 그러면 그 주소의 진짜 주인이 가입할 때 막힌다.
 *    → 이제 `pendingEmail` 에 두고 인증 메일을 보낸다. `email` 로 옮기는 것은
 *      `/api/auth/verify-email` 이 링크를 확인한 뒤다
 *
 * → my-obsidian-vault / 30-Patterns/인증과 세션 공유.md
 */
export async function POST(req: Request) {
  try {
    const auth = await requireSessionUser(req);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    let body: { email?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    const email = normalizeEmail(body.email);
    if (!email) {
      return NextResponse.json(
        { ok: false, error: "올바른 이메일 주소를 입력해 주세요." },
        { status: 400 },
      );
    }

    if (user.email === email && user.emailVerified) {
      return NextResponse.json({ ok: true, alreadyVerified: true, email });
    }

    /*
      다른 계정이 이미 쓰는 주소면 받지 않는다.

      스키마에 유일 인덱스가 없어서(여섯 앱이 공유하는 컬렉션이라 기존 비유일
      `email_1` 을 갈아엎어야 한다) 여기서 막는다. 가입 라우트와 같은 방식이다.
    */
    await connectDB();
    const User = getUserModel();
    const taken = await User.findOne({
      email,
      _id: { $ne: user._id },
    }).exec();
    if (taken) {
      return NextResponse.json(
        { ok: false, error: "다른 계정이 이미 사용 중인 이메일입니다." },
        { status: 409 },
      );
    }

    // 같은 주소로 연달아 누르는 것은 막는다. 주소를 바꿔 넣었다면 바로 보낸다
    if (user.pendingEmail === email) {
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
    }

    user.pendingEmail = email;
    await issueEmailToken(user, email);
    // 안내는 다시 띄우지 않는다 — 방금 답했다
    user.emailPromptSnoozedUntil = undefined as unknown as Date;
    await user.save();

    return NextResponse.json({ ok: true, pendingEmail: email });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
