import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { parseIdentifier } from "@/lib/identifier";
import { signSessionToken } from "@/lib/sessionToken";
import { getUserModel, type UserDocument } from "@/models/User";

export const runtime = "nodejs";

/** 2hbk 도메인 식별자 — 목표·팔로우·초대가 이 값을 참조한다 */
function newUserId(): string {
  return `user_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * 통합 로그인.
 *
 * **이메일이든 전화번호든, 비밀번호든 PIN이든** 맞으면 들어온다.
 * 원래는 전화번호+PIN만 받았고 2hbk용으로 이메일+비밀번호 라우트를 따로 뒀는데,
 * 사람에게 "당신은 어느 쪽 회원이냐"를 묻는 것이 이상해서 하나로 합쳤다.
 *
 * 예전 본문 형식(`{phone, pin}` · `{email, password}`)도 그대로 받는다.
 * 각 앱의 로컬 개발용 로그인 화면이 그 형식으로 부른다.
 */
export async function POST(req: Request) {
  try {
    let body: {
      identifier?: string;
      secret?: string;
      phone?: string;
      pin?: string;
      email?: string;
      password?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }

    const identifierRaw = body.identifier ?? body.email ?? body.phone ?? "";
    const secret = body.secret ?? body.password ?? body.pin ?? "";

    if (!identifierRaw || !secret) {
      return NextResponse.json(
        { ok: false, error: "이메일 또는 전화번호와 비밀번호를 입력해 주세요." },
        { status: 400 },
      );
    }

    const id = parseIdentifier(identifierRaw);
    if (id.kind === "unknown") {
      return NextResponse.json(
        { ok: false, error: "이메일 또는 전화번호 형식이 아닙니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const User = getUserModel();

    const candidates =
      id.kind === "email"
        ? await User.find({ email: id.email }).exec()
        : await User.find({ phone: id.phone }).exec();

    // 계정마다 비밀번호와 PIN 중 있는 것으로 맞춰 본다.
    // 한 사람이 둘 다 가진 경우(이메일이 겹쳐 병합한 계정)는 어느 쪽이든 통과한다
    const matches: UserDocument[] = [];
    for (const u of candidates) {
      const hashes = [u.password, u.pin].filter((h): h is string => Boolean(h));
      for (const hash of hashes) {
        if (await bcrypt.compare(secret, hash)) {
          matches.push(u);
          break;
        }
      }
    }

    if (matches.length === 0) {
      return NextResponse.json(
        { ok: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 },
      );
    }

    if (matches.length > 1) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "같은 전화번호로 여러 계정이 있습니다. 계정마다 다른 비밀번호를 쓰거나 이메일로 로그인해 주세요.",
        },
        { status: 409 },
      );
    }

    const user = matches[0];

    /*
      `userId`가 없으면 지금 만들어 준다.

      2hbk의 목표·팔로우·초대가 이 값을 참조하고, 세션 서명 토큰도 이 값을 담는다.
      옛 계정(전화번호+PIN으로만 가입)에는 없어서, 없으면 2hbk를 쓸 수 없었다.
      로그인 한 번으로 조용히 채워 준다.
    */
    if (!user.userId) user.userId = newUserId();
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
