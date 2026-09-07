import { NextResponse } from "next/server";
import {
  emailPromptState,
  nextPromptAt,
  remainingCooldownMs,
} from "@/lib/emailVerification";
import { requireSessionUser } from "@/lib/serverSession";

export const runtime = "nodejs";

/**
 * 이메일 안내를 띄워야 하는지 묻고(GET), 하루 미루기(POST).
 *
 * 세션 쿠키에는 `email` 만 있고 인증 여부는 없다. 쿠키를 늘리는 대신 여기서
 * 물어본다 — 쿠키는 클라이언트가 고칠 수 있어서 어차피 믿을 수 없다.
 *
 * ⚠️ **로그인을 막지 않는다.** 안내는 안내일 뿐이다. 인증을 로그인 조건으로 걸면
 * 메일이 늦거나 스팸함에 들어간 사람이 갇힌다 → 50-Plans/B 로그인·회원가입 개편.md
 *
 * 안내는 **포털에서만** 띄운다. 여섯 앱이 각자 물으면 같은 사람에게 여섯 번 묻는다.
 * 앱들은 배너로 포털 링크만 보여 준다.
 */
export async function GET(req: Request) {
  try {
    const auth = await requireSessionUser(req);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    const state = emailPromptState(user);
    const snoozedUntil = user.emailPromptSnoozedUntil ?? null;
    const snoozed = Boolean(snoozedUntil && snoozedUntil.getTime() > Date.now());

    return NextResponse.json({
      ok: true,
      state,
      // 하루에 한 번만 묻는다. 미뤄 둔 사이에는 조용히 있는다
      show: state !== null && !snoozed,
      email: user.email ?? null,
      pendingEmail: user.pendingEmail ?? null,
      resendCooldownMs: remainingCooldownMs(user),
      /*
        전화번호+PIN 으로만 쓰던 계정은 비밀번호가 없다. 인증을 마친 뒤
        "비밀번호를 정해 주세요" 를 보여줄지 가르는 값이다 —
        이미 있는 사람에게 물으면 바꾸라는 말처럼 읽힌다.
      */
      hasPassword: Boolean(user.password),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * "나중에 하기". 하루 뒤에 다시 묻는다.
 *
 * 미룬 시각을 **서버에 둔다.** 브라우저에 두면 기기를 바꾸거나 쿠키를 지운
 * 사람에게 매번 다시 뜨고, 반대로 한 기기에서 미루면 다른 기기에서는 계속 뜬다.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireSessionUser(req);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    user.emailPromptSnoozedUntil = nextPromptAt();
    await user.save();

    return NextResponse.json({
      ok: true,
      snoozedUntil: user.emailPromptSnoozedUntil.toISOString(),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
