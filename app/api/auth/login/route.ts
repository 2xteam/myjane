import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    let body: { phone?: string; pin?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    const phoneRaw = typeof body.phone === "string" ? body.phone : "";
    const pin = typeof body.pin === "string" ? body.pin : "";
    const phone = normalizePhone(phoneRaw);

    if (!phone || !pin) {
      return NextResponse.json(
        { ok: false, error: "phone과 pin이 필요합니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const User = getUserModel();
    const candidates = await User.find({ phone }).exec();
    const matches = [];
    for (const u of candidates) {
      if (await bcrypt.compare(pin, u.pin)) {
        matches.push(u);
      }
    }

    if (matches.length === 0) {
      return NextResponse.json(
        { ok: false, error: "전화번호 또는 PIN이 올바르지 않습니다." },
        { status: 401 },
      );
    }

    if (matches.length > 1) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "같은 전화번호로 여러 계정이 있습니다. PIN을 계정별로 다르게 설정해 주세요.",
        },
        { status: 409 },
      );
    }

    const user = matches[0];
    user.lastLoginAt = new Date();
    await user.save();

    return NextResponse.json({
      ok: true,
      user: { id: String(user._id), name: user.name, phone: user.phone },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
