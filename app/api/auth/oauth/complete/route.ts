import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { IS_TOKEN_SYSTEM_ENABLED } from "@/lib/constants";
import { issueEmailToken, normalizeEmail } from "@/lib/emailVerification";
import { newUserId } from "@/lib/family";
import { POLICY_VERSION } from "@/lib/legalVersion";
import { append, clearCookieHeader, OAUTH_SIGNUP_COOKIE, readCookie, verify, type OAuthProfile } from "@/lib/oauth/state";
import { issueProfileSession } from "@/lib/profileSession";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

type Pending = { profile: OAuthProfile; from: string | null; next: string | null };

/** 동의 화면이 먼저 부른다 — 쿠키에 담긴 공급자 프로필을 보여 주기 위해 */
export async function GET(req: Request) {
  const p = verify<Pending>("signup", readCookie(req, OAUTH_SIGNUP_COOKIE));
  if (!p) return NextResponse.json({ ok: false, error: "가입 정보가 만료됐어요. 다시 로그인해 주세요." }, { status: 401 });
  return NextResponse.json({
    ok: true,
    provider: p.profile.provider,
    name: p.profile.name ?? "",
    email: p.profile.email,
    emailVerified: p.profile.emailVerified,
    from: p.from,
    next: p.next,
  });
}

/**
 * 소셜 첫 가입 — 동의를 받고 회원을 만든다.
 *
 * 일반 가입(`/api/auth/register`)과 같은 것을 남긴다: 약관·방침 동의 시각 · 정책 버전 · 만 14세 확인.
 * "로그인하면 동의한 것으로 간주" 로 넘기지 않는다 — 방침이 가입 시 동의를 받는다고 적었다.
 * 이메일이 검증돼 있으면 바로 `email` 에, 없거나 미검증이면 입력받아 `pendingEmail` + 인증 메일.
 * 비밀번호는 없다(`password: null`). 로그인 라우트는 password 없는 계정을 건너뛰므로 이메일+비밀번호로는 못 들어온다.
 */
export async function POST(req: Request) {
  try {
    const p = verify<Pending>("signup", readCookie(req, OAUTH_SIGNUP_COOKIE));
    if (!p) return NextResponse.json({ ok: false, error: "가입 정보가 만료됐어요. 다시 로그인해 주세요." }, { status: 401 });

    let body: { name?: unknown; email?: unknown; agreeTerms?: unknown; agreePrivacy?: unknown; ageOk?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }
    if (body.agreeTerms !== true || body.agreePrivacy !== true) {
      return NextResponse.json({ ok: false, error: "이용약관과 개인정보 수집·이용에 동의해 주세요." }, { status: 400 });
    }
    if (body.ageOk !== true) {
      return NextResponse.json({ ok: false, error: "만 14세 미만은 가입하실 수 없어요. 보호자 계정에 자녀로 추가해 주세요." }, { status: 400 });
    }
    const name = (typeof body.name === "string" ? body.name.trim() : "") || p.profile.name?.trim() || "";
    if (!name || name.length > 20) return NextResponse.json({ ok: false, error: "이름(별칭)은 1~20자로 입력해 주세요." }, { status: 400 });

    await connectDB();
    const User = getUserModel();

    const dup = await User.findOne({ "providers.provider": p.profile.provider, "providers.providerId": p.profile.providerId }).exec();
    if (dup) return NextResponse.json({ ok: false, error: "이미 가입된 계정이에요. 로그인해 주세요." }, { status: 409 });

    /* 이메일 — 검증된 공급자 이메일이면 그대로, 아니면 입력받은 주소를 대기 상태로 */
    const verifiedEmail = p.profile.email && p.profile.emailVerified ? p.profile.email : null;
    const typed = normalizeEmail(body.email);
    if (!verifiedEmail && !typed) return NextResponse.json({ ok: false, error: "이메일을 입력해 주세요." }, { status: 400 });
    const emailToUse = verifiedEmail ?? typed!;
    const taken = await User.findOne({ $or: [{ email: emailToUse }, { pendingEmail: emailToUse }] }).exec();
    if (taken) return NextResponse.json({ ok: false, error: "이미 가입된 이메일입니다. 그 계정으로 로그인한 뒤 My 에서 연결해 주세요." }, { status: 409 });

    const now = new Date();
    const user = new User({
      _id: new mongoose.Types.ObjectId(),
      userId: newUserId(),
      name,
      nickname: name,
      email: verifiedEmail,
      pendingEmail: verifiedEmail ? null : emailToUse,
      emailVerified: Boolean(verifiedEmail),
      password: null,
      pin: null,
      phone: null,
      tokens: IS_TOKEN_SYSTEM_ENABLED ? 20 : 0,
      signupFrom: p.profile.provider,
      providers: [{ provider: p.profile.provider, providerId: p.profile.providerId, email: p.profile.email, linkedAt: now }],
      createdAt: now,
      lastLoginAt: now,
      termsAgreedAt: now,
      privacyAgreedAt: now,
      agreedPolicyVersion: POLICY_VERSION,
      sessionVersion: 0,
    });

    let mailSent: boolean | null = null;
    if (!verifiedEmail) {
      try {
        await issueEmailToken(user, emailToUse);
        mailSent = true;
      } catch (e) {
        console.error("[oauth/complete] 인증 메일 실패", e);
        mailSent = false;
      }
    }
    await user.save();

    const res = issueProfileSession(req, user, null);
    return append(res, [clearCookieHeader(req, OAUTH_SIGNUP_COOKIE)]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
