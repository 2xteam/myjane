import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { getUserModel } from "@/models/User";
import { signSessionToken } from "@/lib/sessionToken";

export const runtime = "nodejs";

/**
 * 이메일 + 비밀번호 로그인 — 2hbk용.
 *
 * 세 Snap·FitLog 계열은 전화번호+PIN(`/api/auth/login`)을 그대로 쓴다.
 * 2hbk는 자체 백엔드에서 이메일 로그인을 쓰다가 넘어왔고, 기존 회원의
 * bcrypt 해시를 그대로 옮겨 왔기 때문에 같은 비밀번호로 계속 로그인된다.
 *
 * → my-obsidian-vault / 30-Patterns/인증과 세션 공유.md
 */
export async function POST(req: Request) {
  try {
    let body: { email?: string; password?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "이메일과 비밀번호를 입력해 주세요." },
        { status: 400 },
      );
    }

    await connectDB();
    const User = getUserModel();
    const user = await User.findOne({ email }).exec();

    // 계정이 없는 경우와 비밀번호가 틀린 경우를 구분해 알려주지 않는다
    const invalid = NextResponse.json(
      { ok: false, error: "이메일 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );

    if (!user || !user.password) return invalid;
    if (!(await bcrypt.compare(password, user.password))) return invalid;

    if (!user.userId) {
      return NextResponse.json(
        { ok: false, error: "이 계정은 2hbk를 사용할 수 없습니다." },
        { status: 403 },
      );
    }

    user.lastLoginAt = new Date();
    await user.save();

    return NextResponse.json({
      ok: true,
      user: {
        id: String(user._id),
        name: user.nickname ?? user.name ?? "",
        phone: user.phone ?? "",
        email: user.email ?? "",
        nickname: user.nickname ?? "",
        userId: user.userId,
      },
      token: signSessionToken(String(user._id), user.userId),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
