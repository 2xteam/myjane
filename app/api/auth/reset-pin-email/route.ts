import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    let body: { token?: string; newPin?: string; newPinConfirm?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    const token = typeof body.token === "string" ? body.token : "";
    const newPin = typeof body.newPin === "string" ? body.newPin : "";
    const newPinConfirm = typeof body.newPinConfirm === "string" ? body.newPinConfirm : "";

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "유효하지 않은 링크입니다." },
        { status: 400 },
      );
    }

    if (newPin.length < 4) {
      return NextResponse.json(
        { ok: false, error: "새 PIN은 4자 이상이어야 합니다." },
        { status: 400 },
      );
    }

    if (newPin !== newPinConfirm) {
      return NextResponse.json(
        { ok: false, error: "새 PIN과 PIN 확인이 일치하지 않습니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const User = getUserModel();
    const user = await User.findOne({
      pinResetToken: token,
      pinResetExpires: { $gt: new Date() },
    }).exec();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "링크가 만료되었거나 유효하지 않습니다." },
        { status: 400 },
      );
    }

    user.pin = await bcrypt.hash(newPin, 10);
    user.pinResetToken = undefined as unknown as string;
    user.pinResetExpires = undefined as unknown as Date;
    await user.save();

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
