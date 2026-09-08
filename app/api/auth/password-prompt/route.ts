import { NextResponse } from "next/server";
import {
  PASSWORD_MAX_AGE_DAYS,
  PASSWORD_SNOOZE_DAYS,
  daysFromNow,
  passwordAgeDays,
  shouldPromptPassword,
} from "@/lib/accountLifecycle";
import { requireSessionUser } from "@/lib/serverSession";

export const runtime = "nodejs";

/**
 * 비밀번호를 바꾼 지 오래됐는지 묻고(GET), "3개월 연장" 을 받는다(POST).
 *
 * ⚠️ **강제하지 않는다.** 주기적 강제 변경은 NIST SP 800-63B 가 권장하지 않는다 —
 * 사람이 `pw1!` → `pw2!` 로 바꿔서 오히려 약해지기 때문이다. 그래서 안내만 하고,
 * 바꾸거나 미루거나는 본인이 고른다.
 *
 * 이메일 안내와 같은 모양이다(`app/api/auth/email-prompt`). 미룬 시각을
 * **서버에 둔다** — 브라우저에 두면 기기를 바꿀 때마다 다시 뜨고, 한 기기에서
 * 미루면 다른 기기에서는 계속 뜬다.
 *
 * 안내는 **포털에서만** 띄운다. 여섯 앱이 각자 물으면 여섯 번 묻는다.
 */
export async function GET(req: Request) {
  try {
    const auth = await requireSessionUser(req);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    return NextResponse.json({
      ok: true,
      show: shouldPromptPassword(user),
      ageDays: passwordAgeDays(user),
      maxAgeDays: PASSWORD_MAX_AGE_DAYS,
      snoozeDays: PASSWORD_SNOOZE_DAYS,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** "3개월 연장" — 지금 비밀번호를 그대로 쓰고 3개월 뒤에 다시 묻는다 */
export async function POST(req: Request) {
  try {
    const auth = await requireSessionUser(req);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    user.passwordPromptSnoozedUntil = daysFromNow(PASSWORD_SNOOZE_DAYS);
    await user.save();

    return NextResponse.json({
      ok: true,
      snoozedUntil: user.passwordPromptSnoozedUntil.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
