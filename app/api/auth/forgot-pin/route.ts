import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { connectDB } from "@/lib/db";
import { authMailOnCooldown } from "@/lib/authMailCooldown";
import { sendMail } from "@/lib/mail";
import { authMail } from "@/lib/mailTemplate";
import { normalizePhone } from "@/lib/phone";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

/**
 * 비밀번호·PIN 재설정 링크를 메일로 보낸다.
 *
 * ⚠️ **계정이 있든 없든 같은 답을 준다.** 예전에는 없으면 404 와 함께
 * "일치하는 계정이 없습니다" 를 돌려줬는데, 그건 **어떤 전화번호와 이메일 조합이
 * 존재하는지 알려주는 것**이다. 아무나 조합을 넣어 확인할 수 있었다.
 *
 * ⚠️ **메일을 먼저 보내고 토큰을 저장한다.** 반대로 하면 발송이 실패했을 때도
 * 토큰과 쿨다운이 남아, 사람은 오지 않는 메일을 60초 동안 기다리게 된다
 * (`lib/emailVerification.ts` 와 같은 이유).
 *
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */

/**
 * 있든 없든 이 답을 준다.
 *
 * ⚠️ **함수여야 한다.** 모듈 상수로 두면 `Response` 본문이 한 번만 소비되고
 * 두 번째 요청부터 **빈 응답**이 나간다.
 */
const sameAnswer = () =>
  NextResponse.json({
    ok: true,
    message: "입력하신 정보와 일치하는 계정이 있으면 재설정 링크를 보내드렸어요.",
  });

export async function POST(req: Request) {
  try {
    let body: { phone?: string; email?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }

    const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!phone || !email) {
      return NextResponse.json(
        { ok: false, error: "전화번호와 이메일을 입력해 주세요." },
        { status: 400 },
      );
    }

    await connectDB();
    const user = await getUserModel().findOne({ phone, email }).exec();

    /* 없어도 같은 답 — 있는지 없는지 알려주지 않는다 */
    if (!user) return sameAnswer();

    /* 연타를 막는다. 이것도 같은 답으로 돌려보낸다 */
    if (authMailOnCooldown(user)) return sameAnswer();

    const token = crypto.randomBytes(32).toString("hex");
    const origin = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.myjane.co.kr";
    const resetUrl = `${origin}/reset-pin-email?token=${token}`;

    /*
      ⚠️ 발송이 실패해도 **같은 답을 준다.** 던지게 두면 500 이 나가는데
      없는 계정은 200 이다. 그 차이만으로 조합이 존재한다는 것을 알 수 있다.
      토큰은 저장하지 않는다 — 오지 않은 메일의 링크를 살려 둘 이유가 없다.
    */
    try {
      await sendMail(
        email,
        "[myjane] 비밀번호·PIN 재설정",
        authMail({
          name: user.name ?? user.nickname ?? "회원",
          body: "<p>아래 버튼을 눌러 비밀번호 또는 PIN을 새로 정하실 수 있습니다.</p>",
          action: { label: "재설정하기", url: resetUrl },
          notes: ["이 링크는 30분 동안 유효하며, 한 번 사용하면 만료됩니다."],
          warn: "본인이 요청하지 않으셨다면 이 링크를 누르지 마시고 이 메일을 무시해 주세요.",
        }),
      );
    } catch (e) {
      console.error("[forgot-pin] 메일 발송 실패", e);
      return sameAnswer();
    }

    user.pinResetToken = token;
    user.pinResetExpires = new Date(Date.now() + 30 * 60 * 1000);
    user.authMailSentAt = new Date();
    await user.save();

    return sameAnswer();
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
