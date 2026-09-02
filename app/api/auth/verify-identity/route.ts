import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    let body: { phone?: string; name?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!phone || !name) {
      return NextResponse.json(
        { ok: false, error: "전화번호와 이름을 입력해 주세요." },
        { status: 400 },
      );
    }

    await connectDB();
    const User = getUserModel();
    const user = await User.findOne({ phone, name }).exec();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "일치하는 계정을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
