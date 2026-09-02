import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { getUserModel } from "@/models/User";
import { sendMail } from "@/lib/mail";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    let body: { phone?: string; email?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
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
    const User = getUserModel();
    const user = await User.findOne({ phone, email }).exec();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "전화번호와 이메일이 일치하는 계정이 없습니다." },
        { status: 404 },
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 30 * 60 * 1000);

    user.pinResetToken = token;
    user.pinResetExpires = expires;
    await user.save();

    // 재설정 링크는 통합 로그인(포털) 주소로 보낸다
    const origin = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.myjane.co.kr";
    const resetUrl = `${origin}/reset-pin-email?token=${token}`;

    await sendMail(
      email,
      "[SnapWord] PIN 변경 요청",
      `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#2ee8ae;margin:0 0 16px;">SnapWord</h2>
        <p>안녕하세요, <strong>${user.name}</strong>님.</p>
        <p>아래 버튼을 눌러 PIN을 변경할 수 있습니다.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background:#2ee8ae;color:#000;font-weight:700;border-radius:12px;text-decoration:none;font-size:15px;">
            PIN 변경하기
          </a>
        </div>
        <p style="color:#888;font-size:13px;">이 링크는 30분 동안 유효합니다.</p>
        <p style="color:#888;font-size:13px;">본인이 요청하지 않으셨다면 이 메일을 무시하셔도 됩니다.</p>
        <p style="color:#aaa;font-size:11px;margin-top:24px;word-break:break-all;">링크가 동작하지 않으면 아래 URL을 브라우저에 붙여넣기 하세요:<br/>${resetUrl}</p>
      </div>`,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
