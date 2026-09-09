import { NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { IS_TOKEN_SYSTEM_ENABLED } from "@/lib/constants";
import { issueEmailToken, normalizeEmail } from "@/lib/emailVerification";
import { POLICY_VERSION } from "@/lib/legalVersion";
import { passwordProblem } from "@/lib/password";
import { normalizePhone } from "@/lib/phone";
import { signSessionToken } from "@/lib/sessionToken";
import { sessionCookieHeaders, withSetCookies } from "@/lib/sessionCookie";
import { getUserModel, type UserDocument } from "@/models/User";

export const runtime = "nodejs";

/** 2hbk 도메인 식별자 — 목표·팔로우·초대가 이 값을 참조한다 */
function newUserId(): string {
  return `user_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * 통합 회원가입.
 *
 * **이메일이 필수다. 전화번호는 선택이다.** (2026-09-07)
 * 예전에는 둘 중 하나만 있으면 됐지만, 비밀번호를 잊었을 때 되찾을 길이
 * 이메일뿐이라 전화번호만 있는 계정은 스스로 복구할 수 없었다.
 *
 * ⚠️ **필수는 여기서만 건다.** `models/User.ts` 의 `email` 은 선택 필드 그대로다.
 * 스키마에서 필수로 바꾸면 전화번호만 있는 **기존** 계정의 `user.save()` 가
 * 여섯 앱 전부에서 터진다 → my-obsidian-vault / 30-Patterns/인증과 세션 공유.md
 *
 * 각 앱의 로컬 가입 라우트(`SnapWord/app/api/auth/register` 등)는 별개다.
 * 로컬 개발용이라 예전 형식을 그대로 받는다 — 여기를 바꿔도 영향이 없다.
 */
export async function POST(req: Request) {
  try {
    let body: {
      name?: string;
      email?: string;
      password?: string;
      passwordConfirm?: string;
      /** 선택 — 넣으면 연락처로만 저장한다. 로그인 수단이 되지는 않는다 */
      phone?: string;
      /** 예전 형식 — 한 칸에 이메일·전화번호를 아무거나 받던 시절의 이름 */
      secret?: string;
      secretConfirm?: string;
      /** 약관·개인정보 동의. 둘 다 true 라야 가입된다 */
      agreeTerms?: boolean;
      agreePrivacy?: boolean;
      /** 어느 앱에서 가입했는지 */
      signupFrom?: string;
      /** 앱별 초기값 — 모두 선택이다. 없으면 나중에 그 앱에서 받는다 */
      heightCm?: number;
      gender?: string;
      birthYear?: number;
      nickname?: string;
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

    const email = normalizeEmail(body.email);
    if (!email) {
      return NextResponse.json(
        { ok: false, error: "이메일 주소를 입력해 주세요." },
        { status: 400 },
      );
    }

    const password = body.password ?? body.secret ?? "";
    const passwordConfirm = body.passwordConfirm ?? body.secretConfirm ?? password;

    const weak = passwordProblem(password);
    if (weak) return NextResponse.json({ ok: false, error: weak }, { status: 400 });

    if (password !== passwordConfirm) {
      return NextResponse.json(
        { ok: false, error: "입력한 두 비밀번호가 일치하지 않습니다." },
        { status: 400 },
      );
    }

    /*
      ⚠️ 동의는 **여기서도** 본다. 가입 화면에서만 막으면 이 라우트를 직접
      부르는 쪽이 그대로 통과한다. 동의 시각은 아래에서 남긴다.
      → myjane/app/legal/* · my-obsidian-vault / 50-Plans/C 법적 페이지.md
    */
    if (body.agreeTerms !== true || body.agreePrivacy !== true) {
      return NextResponse.json(
        { ok: false, error: "이용약관과 개인정보 수집·이용에 동의해 주세요." },
        { status: 400 },
      );
    }
    const agreedAt = new Date();

    /*
      전화번호는 선택이다. 넣었으면 형식만 보고 연락처로 저장한다.

      ⚠️ `pin` 은 만들지 않는다. 새 계정의 로그인 수단은 이메일+비밀번호 하나다.
      `/api/auth/login` 은 `pin` 이 `null` 인 계정을 자연히 건너뛰므로
      (`[u.password, u.pin].filter(Boolean)`) 그대로 두면 된다.
    */
    let phone = "";
    if (typeof body.phone === "string" && body.phone.trim()) {
      phone = normalizePhone(body.phone);
      if (phone.length < 9 || phone.length > 11) {
        return NextResponse.json(
          { ok: false, error: "전화번호 형식이 올바르지 않습니다." },
          { status: 400 },
        );
      }
    }

    await connectDB();
    const User = getUserModel();

    if (phone) {
      const phoneTaken = await User.findOne({ phone }).exec();
      if (phoneTaken) {
        return NextResponse.json(
          { ok: false, error: "이미 등록된 전화번호입니다." },
          { status: 409 },
        );
      }
    }

    const hashed = await bcrypt.hash(password, 10);
    const signupFrom =
      typeof body.signupFrom === "string" && body.signupFrom.trim()
        ? body.signupFrom.trim().slice(0, 32)
        : null;

    // 앱별 초기값 — 전부 선택이다. 범위를 벗어나거나 없으면 조용히 null 로 둔다
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
    const nickname =
      typeof body.nickname === "string" && body.nickname.trim()
        ? body.nickname.trim().slice(0, 40)
        : name;

    const existing = await User.findOne({ email }).exec();
    if (existing) {
      /*
        이미 그 이메일을 쓰는 계정이 있다.

        비밀 값이 아직 없는 계정(다른 앱에서 이메일만 적어 둔 경우)이라면
        새로 만들지 않고 **그 계정에 로그인 수단을 얹는다.** 새로 만들면
        같은 사람의 기록이 두 계정으로 갈린다.

        비밀 값이 있으면 남의 계정이다. 병합하지 않고 409 로 돌려보낸다
        (2026-09-07 확인: 실제 중복 이메일 0건).
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
      if (!existing.nickname) existing.nickname = nickname;
      if (phone && !existing.phone) existing.phone = phone;
      if (heightCm !== null && existing.heightCm === null) existing.heightCm = heightCm;
      if (gender !== null && existing.gender === null) existing.gender = gender;
      if (birthYear !== null && existing.birthYear === null) existing.birthYear = birthYear;
      existing.lastLoginAt = new Date();
      existing.passwordChangedAt = agreedAt;
      existing.termsAgreedAt = agreedAt;
      existing.privacyAgreedAt = agreedAt;
      existing.agreedPolicyVersion = POLICY_VERSION;

      const mailSent = await sendVerification(existing, email);
      await existing.save();

      return withSetCookies(
        NextResponse.json({
          ok: true,
          mailSent,
          user: {
            id: String(existing._id),
            name: existing.nickname ?? existing.name ?? name,
              nickname: existing.nickname ?? nickname,
            userId,
            hasEmail: true,
          },
        }),
        sessionCookieHeaders(req, token),
      );
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
      nickname,
      email,
      password: hashed,
      phone: phone || null,
      pin: null,
      emailVerified: false,
      tokens: IS_TOKEN_SYSTEM_ENABLED ? 20 : 0,
      signupFrom,
      heightCm,
      gender,
      birthYear,
      createdAt: new Date(),
      lastLoginAt: new Date(),
      passwordChangedAt: agreedAt,
      termsAgreedAt: agreedAt,
      privacyAgreedAt: agreedAt,
      agreedPolicyVersion: POLICY_VERSION,
    });

    /*
      ⚠️ 인증 메일은 계정을 만든 **뒤에** 보내고, 실패해도 가입을 실패시키지 않는다.

      메일 발송이 터졌다고 500 을 돌려주면 계정은 이미 만들어졌는데 사람은
      "가입 실패"를 본다. 다시 시도하면 이번엔 409(이미 가입된 이메일)가 나고,
      메일도 못 받은 채 들어갈 수도 나갈 수도 없게 된다.

      메일은 `/api/auth/send-verification` 으로 다시 받을 수 있다. 계정이 남는 쪽이 낫다.
    */
    const mailSent = await sendVerification(user, email);
    if (mailSent) await user.save();

    return withSetCookies(
      NextResponse.json({
        ok: true,
        mailSent,
        user: {
          id: String(user._id),
          name,
          nickname,
          userId,
          hasEmail: true,
        },
      }),
      sessionCookieHeaders(req, token),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** 토큰을 심고 메일을 보낸다. 실패해도 가입은 살린다 */
async function sendVerification(user: UserDocument, email: string): Promise<boolean> {
  try {
    await issueEmailToken(user, email);
    return true;
  } catch {
    return false;
  }
}
