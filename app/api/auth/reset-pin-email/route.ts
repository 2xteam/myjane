import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { passwordProblem } from "@/lib/password";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    /* 2026-09-09 부터 이 링크는 **비밀번호**를 정한다. 옛 키(newPin)도 받아 준다 */
    let body: { token?: string; newPassword?: string; newPasswordConfirm?: string; newPin?: string; newPinConfirm?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    const token = typeof body.token === "string" ? body.token : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : typeof body.newPin === "string" ? body.newPin : "";
    const newPasswordConfirm =
      typeof body.newPasswordConfirm === "string" ? body.newPasswordConfirm : typeof body.newPinConfirm === "string" ? body.newPinConfirm : "";

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "유효하지 않은 링크입니다." },
        { status: 400 },
      );
    }

    const problem = passwordProblem(newPassword);
    if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 });

    if (newPassword !== newPasswordConfirm) {
      return NextResponse.json(
        { ok: false, error: "새 비밀번호와 확인이 일치하지 않습니다." },
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

    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordChangedAt = new Date();
    user.passwordPromptSnoozedUntil = null;
    user.pinResetToken = undefined as unknown as string;
    user.pinResetExpires = undefined as unknown as Date;
    /* 지금까지 발급한 세션 토큰을 전부 폐기한다 → lib/sessionToken.ts 의 sv */
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    await user.save();

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
