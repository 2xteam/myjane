import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { issueEmailToken, normalizeEmail, remainingCooldownMs } from "@/lib/emailVerification";
import { checkThrottle, clearThrottle, hitThrottle, throttleKeys } from "@/lib/loginThrottle";
import { passwordProblem } from "@/lib/password";
import { normalizePhone } from "@/lib/phone";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

/**
 * 전화번호+PIN 계정을 **이메일+비밀번호 계정으로 전환**한다 (2026-09-09 사용자 결정).
 *
 * 로그인은 이제 이메일로만 된다. 전화번호로만 가입했던 사람은 여기서
 *
 *   전화번호 · PIN (본인 확인) · 새 이메일 · 새 비밀번호
 *
 * 를 넣는다. PIN 이 맞으면 비밀번호를 바로 저장하고, 이메일은 `pendingEmail` 에 두고
 * 인증 메일을 보낸다. 링크를 누르면(`/api/auth/verify-email`) 주소가 `email` 로 옮겨지고
 * **PIN 은 지운다**(`pinRetireOnVerify`). 그 뒤로는 이메일+비밀번호로 로그인한다.
 *
 * 세션은 내주지 않는다 — 인증을 마치고 새 방식으로 한 번 로그인하게 한다.
 *
 * - 시도 제한은 로그인과 같다(전화번호당 5회 / 15분). PIN 이 4자리라 특히 필요하다
 * - 같은 전화번호로 계정이 둘이면 어느 쪽인지 알 수 없어 409 — 관리자에게 안내
 * - 이메일이 다른 계정에 있으면(정식이든 대기 중이든) 409
 * → my-obsidian-vault / 50-Plans/E 개인정보 보호 보강.md "이메일 전용 로그인"
 */
export async function POST(req: Request) {
  try {
    let body: { phone?: unknown; pin?: unknown; email?: unknown; password?: unknown; passwordConfirm?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }

    const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
    const pin = typeof body.pin === "string" ? body.pin : "";
    const email = normalizeEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    const passwordConfirm = typeof body.passwordConfirm === "string" ? body.passwordConfirm : password;

    if (!phone || !pin) {
      return NextResponse.json({ ok: false, error: "전화번호와 PIN을 입력해 주세요." }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ ok: false, error: "이메일 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const problem = passwordProblem(password);
    if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 });
    if (password !== passwordConfirm) {
      return NextResponse.json({ ok: false, error: "입력한 두 비밀번호가 일치하지 않습니다." }, { status: 400 });
    }

    await connectDB();
    const User = getUserModel();

    const keys = throttleKeys(req, phone);
    const throttled = await checkThrottle(keys);
    if (throttled) return throttled;

    /* PIN 이 있는 계정만 — 이미 전환한 계정은 대상이 아니다 */
    const candidates = await User.find({ phone, pin: { $type: "string" }, withdrawnAt: null }).exec();
    const matches = [];
    for (const u of candidates) {
      if (u.pin && (await bcrypt.compare(pin, u.pin))) matches.push(u);
    }

    if (matches.length === 0) {
      await hitThrottle(keys);
      return NextResponse.json(
        { ok: false, error: "전화번호 또는 PIN이 올바르지 않거나, 이미 이메일 계정으로 전환된 번호입니다." },
        { status: 401 },
      );
    }
    if (matches.length > 1) {
      return NextResponse.json(
        {
          ok: false,
          error: "같은 전화번호로 계정이 여러 개 있어 자동으로 전환할 수 없어요. 아래 관리자 메일로 연락해 주세요.",
        },
        { status: 409 },
      );
    }
    const user = matches[0];
    await clearThrottle(keys);

    /* 다른 계정이 그 주소를 쓰고 있으면(정식이든 대기 중이든) 막는다 — 남의 주소를 심는 사고 방지 */
    const taken = await User.findOne({
      _id: { $ne: user._id },
      $or: [{ email }, { pendingEmail: email }],
    }).exec();
    if (taken) {
      return NextResponse.json({ ok: false, error: "이미 다른 계정이 사용하는 이메일입니다." }, { status: 409 });
    }

    if (remainingCooldownMs(user) > 0) {
      return NextResponse.json(
        { ok: false, error: "인증 메일을 방금 보냈어요. 잠시 후 다시 시도해 주세요." },
        { status: 429 },
      );
    }

    /* 메일이 먼저, 저장은 뒤 — 보내지 못한 링크를 살려 두지 않는다 */
    try {
      await issueEmailToken(user, email);
    } catch (e) {
      console.error("[migrate-pin] 인증 메일 발송 실패", e);
      return NextResponse.json(
        { ok: false, error: "인증 메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요." },
        { status: 502 },
      );
    }

    user.pendingEmail = email;
    user.password = await bcrypt.hash(password, 10);
    user.passwordChangedAt = new Date();
    user.pinRetireOnVerify = true;
    await user.save();

    return NextResponse.json({ ok: true, pendingEmail: email });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
