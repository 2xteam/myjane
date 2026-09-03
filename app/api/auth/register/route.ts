import { NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { IS_TOKEN_SYSTEM_ENABLED } from "@/lib/constants";
import { parseIdentifier } from "@/lib/identifier";
import { signSessionToken } from "@/lib/sessionToken";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

/** 2hbk 도메인 식별자 — 목표·팔로우·초대가 이 값을 참조한다 */
function newUserId(): string {
  return `user_${Math.random().toString(36).slice(2, 11)}`;
}

/** 전화번호로 가입하면 PIN, 이메일로 가입하면 비밀번호다. 최소 길이가 다르다 */
const MIN_PIN = 4;
const MIN_PASSWORD = 8;

/**
 * 통합 회원가입.
 *
 * **이메일이나 전화번호 중 하나만** 있으면 가입된다. 넣은 쪽에 따라 비밀 값이
 * `password`(이메일) 또는 `pin`(전화번호)에 들어가고, 그것이 곧 그 계정의
 * 로그인 수단이 된다 → 30-Patterns/인증과 세션 공유.md
 *
 * `userId`는 **항상** 만든다. 2hbk가 이 값을 도메인 식별자로 쓰기 때문에,
 * 없으면 나중에 2hbk를 쓸 수 없다.
 */
export async function POST(req: Request) {
  try {
    let body: {
      name?: string;
      identifier?: string;
      secret?: string;
      secretConfirm?: string;
      /** 예전 형식 — 각 앱의 로컬 가입 화면이 이 형식으로 부른다 */
      phone?: string;
      pin?: string;
      pinConfirm?: string;
      email?: string;
      password?: string;
      /** 어느 앱에서 가입했는지 */
      signupFrom?: string;
      /** FitLog에서 가입한 경우 함께 받는 신체 프로필 */
      heightCm?: number;
      gender?: string;
      birthYear?: number;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ ok: false, error: "이름을 입력해 주세요." }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json(
        { ok: false, error: "이름은 100자 이하여야 합니다." },
        { status: 400 },
      );
    }

    const identifierRaw = body.identifier ?? body.email ?? body.phone ?? "";
    const secret = body.secret ?? body.password ?? body.pin ?? "";
    const secretConfirm = body.secretConfirm ?? body.pinConfirm ?? secret;

    const id = parseIdentifier(identifierRaw);
    if (id.kind === "unknown") {
      return NextResponse.json(
        { ok: false, error: "이메일 또는 전화번호를 입력해 주세요." },
        { status: 400 },
      );
    }

    const minLength = id.kind === "email" ? MIN_PASSWORD : MIN_PIN;
    if (secret.length < minLength) {
      return NextResponse.json(
        {
          ok: false,
          error:
            id.kind === "email"
              ? `비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다.`
              : `PIN은 ${MIN_PIN}자 이상이어야 합니다.`,
        },
        { status: 400 },
      );
    }
    if (secret !== secretConfirm) {
      return NextResponse.json(
        { ok: false, error: "입력한 두 값이 일치하지 않습니다." },
        { status: 400 },
      );
    }

    await connectDB();
    const User = getUserModel();

    const hashed = await bcrypt.hash(secret, 10);
    const signupFrom =
      typeof body.signupFrom === "string" && body.signupFrom.trim()
        ? body.signupFrom.trim().slice(0, 32)
        : null;

    // FitLog에서 가입하면 신체 프로필을 함께 받는다
    const heightCm =
      typeof body.heightCm === "number" && body.heightCm >= 80 && body.heightCm <= 250
        ? body.heightCm
        : null;
    const gender = body.gender === "male" || body.gender === "female" ? body.gender : null;
    const thisYear = new Date().getFullYear();
    const birthYear =
      typeof body.birthYear === "number" &&
      body.birthYear >= 1900 &&
      body.birthYear <= thisYear
        ? body.birthYear
        : null;

    if (id.kind === "email") {
      const existing = await User.findOne({ email: id.email }).exec();
      if (existing) {
        /*
          이미 그 이메일을 쓰는 계정이 있다.

          비밀 값이 아직 없는 계정(다른 앱에서 이메일만 적어 둔 경우)이라면
          새로 만들지 않고 **그 계정에 로그인 수단을 얹는다.** 새로 만들면
          같은 사람의 기록이 두 계정으로 갈린다.
        */
        if (existing.password || existing.pin) {
          return NextResponse.json(
            { ok: false, error: "이미 가입된 이메일입니다." },
            { status: 409 },
          );
        }

        const userId = existing.userId ?? newUserId();
        const token = signSessionToken(String(existing._id), userId);
        existing.userId = userId;
        existing.password = hashed;
        if (!existing.name) existing.name = name;
        if (!existing.nickname) existing.nickname = name;
        existing.lastLoginAt = new Date();
        await existing.save();

        return NextResponse.json({
          ok: true,
          user: {
            id: String(existing._id),
            name: existing.nickname ?? existing.name ?? name,
            phone: existing.phone ?? "",
            email: id.email,
            nickname: existing.nickname ?? name,
            userId,
          },
          token,
        });
      }
    }

    /*
      `_id`를 미리 만들어 **쓰기 전에** 토큰을 서명한다.
      먼저 저장하고 나중에 서명하면, 서명이 실패했을 때 계정만 남고 세션은
      없는 상태가 된다. 그 뒤로는 다시 가입할 수도 없다. 2026-09-03에 겪었다.
    */
    const userId = newUserId();
    const _id = new mongoose.Types.ObjectId();
    const token = signSessionToken(String(_id), userId);

    const user = await User.create({
      _id,
      userId,
      name,
      nickname: name,
      email: id.kind === "email" ? id.email : null,
      password: id.kind === "email" ? hashed : null,
      phone: id.kind === "phone" ? id.phone : null,
      pin: id.kind === "phone" ? hashed : null,
      tokens: IS_TOKEN_SYSTEM_ENABLED ? 20 : 0,
      signupFrom,
      heightCm,
      gender,
      birthYear,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: String(user._id),
        name,
        phone: user.phone ?? "",
        email: user.email ?? "",
        nickname: name,
        userId,
      },
      token,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
