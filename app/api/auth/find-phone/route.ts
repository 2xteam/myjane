import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getUserModel } from "@/models/User";
import { sendMail } from "@/lib/mail";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    let body: { email?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "이메일을 입력해 주세요." },
        { status: 400 },
      );
    }

    await connectDB();
    const User = getUserModel();
    const user = await User.findOne({ email }).exec();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "해당 이메일로 등록된 계정이 없습니다." },
        { status: 404 },
      );
    }

    await sendMail(
      email,
      "[SnapWord] 등록된 전화번호 안내",
      `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#2ee8ae;margin:0 0 16px;">SnapWord</h2>
        <p>안녕하세요, <strong>${user.name}</strong>님.</p>
        <p>요청하신 계정에 등록된 전화번호는 다음과 같습니다:</p>
        <div style="background:#f5f5f5;padding:16px;border-radius:12px;text-align:center;font-size:20px;font-weight:700;letter-spacing:2px;margin:16px 0;">
          ${user.phone}
        </div>
        <p style="color:#888;font-size:13px;">본인이 요청하지 않으셨다면 이 메일을 무시하셔도 됩니다.</p>
      </div>`,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
