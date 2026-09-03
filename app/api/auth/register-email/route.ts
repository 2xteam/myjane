import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { getUserModel } from "@/models/User";
import { signSessionToken } from "@/lib/sessionToken";

export const runtime = "nodejs";

/** 2hbk 백엔드와 같은 형식의 도메인 식별자 — 목표·팔로우·초대가 이 값을 참조한다 */
function newUserId(): string {
  return `user_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * 이메일 + 비밀번호 회원가입 — 2hbk용.
 *
 * 통합 회원 컬렉션에 한 줄을 만든다. 전화번호·PIN은 비워 두고 이메일로만 로그인한다.
 * 이미 다른 앱에서 같은 이메일로 가입한 계정이라면 **새로 만들지 않고**
 * 그 계정에 비밀번호와 닉네임을 붙여 두 방식 모두로 로그인되게 한다.
 */
export async function POST(req: Request) {
  try {
    let body: { email?: string; password?: string; nickname?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: "올바른 이메일 주소를 입력해 주세요." },
        { status: 400 },
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { ok: false, error: "비밀번호는 8자 이상이어야 합니다." },
        { status: 400 },
      );
    }
    if (!nickname || nickname.length > 20) {
      return NextResponse.json(
        { ok: false, error: "닉네임은 1~20자로 입력해 주세요." },
        { status: 400 },
      );
    }

    await connectDB();
    const User = getUserModel();

    const existing = await User.findOne({ email }).lean().exec();
    if (existing) {
      if (existing.userId || existing.password) {
        return NextResponse.json(
          { ok: false, error: "이미 가입된 이메일입니다." },
          { status: 409 },
        );
      }

      // 다른 앱에서 먼저 가입한 계정 — 2hbk 로그인 수단만 얹는다
      const userId = newUserId();
      await User.updateOne(
        { _id: existing._id },
        {
          $set: {
            userId,
            nickname,
            password: await bcrypt.hash(password, 10),
            lastLoginAt: new Date(),
          },
        },
      ).exec();

      return NextResponse.json({
        ok: true,
        user: {
          id: String(existing._id),
          name: existing.name ?? nickname,
          phone: existing.phone ?? "",
          email,
          nickname,
          userId,
        },
        token: signSessionToken(String(existing._id), userId),
      });
    }

    const userId = newUserId();
    const user = await User.create({
      userId,
      email,
      nickname,
      name: nickname,
      password: await bcrypt.hash(password, 10),
      phone: null,
      pin: null,
      signupFrom: "2hbk",
      emailVerified: false,
      followApprovalRequired: false,
      tokens: 0,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: String(user._id),
        name: nickname,
        phone: "",
        email,
        nickname,
        userId,
      },
      token: signSessionToken(String(user._id), userId),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
