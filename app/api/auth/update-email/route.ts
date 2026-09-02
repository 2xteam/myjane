import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    let body: { phone?: string; userId?: string; email?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
    const userId = typeof body.userId === "string" ? body.userId : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!phone || !userId) {
      return NextResponse.json(
        { ok: false, error: "phone과 userId가 필요합니다." },
        { status: 400 },
      );
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: "올바른 이메일 주소를 입력해 주세요." },
        { status: 400 },
      );
    }

    await connectDB();
    const User = getUserModel();
    const user = await User.findById(userId).exec();

    if (!user || user.phone !== phone) {
      return NextResponse.json(
        { ok: false, error: "권한이 없습니다." },
        { status: 403 },
      );
    }

    user.email = email;
    await user.save();

    return NextResponse.json({ ok: true, email: user.email });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
