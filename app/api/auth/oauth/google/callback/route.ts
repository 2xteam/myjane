import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { signPickToken } from "@/lib/family";
import { googleConfigured, googleExchange } from "@/lib/oauth/google";
import {
  append, clearCookieHeader, OAUTH_SIGNUP_COOKIE, OAUTH_STATE_COOKIE, portalOrigin, readCookie, setCookieHeader, sign, verify,
  type OAuthProfile, type OAuthState,
} from "@/lib/oauth/state";
import { redirectWithSession } from "@/lib/profileSession";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

/**
 * 구글 콜백 — state 대조 → 코드 교환 → 프로필 → 회원 매칭 → 세션 → 돌아가기.
 *
 * 매칭 규칙 (→ 50-Plans/G 소셜 로그인.md 3장)
 *   ① providers 에 같은 (provider, providerId) 가 있다      → 그 회원으로 로그인
 *   ② 없고, 검증된 이메일의 회원이 있다                     → 그 회원에 연결하고 로그인
 *   ③ 없고, 이메일이 없거나 미검증                          → 동의 화면에서 이메일을 받아 인증 (구글은 거의 없다)
 *   ④ 없고, 검증된 이메일이고 회원도 없다                   → 첫 가입 — 동의 화면(/signup/social)으로
 * ⚠️ ②의 "검증된" 을 빼면 남의 주소를 자기 구글에 넣어 그 사람 계정에 들어갈 수 있다.
 *
 * 실패는 전부 `/login?oauth_error=<코드>` 로 보낸다 — 콜백 화면에 오류를 그리지 않는다.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = portalOrigin(req);
  const clear = [clearCookieHeader(req, OAUTH_STATE_COOKIE)];
  const fail = (code: string, st?: OAuthState | null) => {
    const q = new URLSearchParams({ oauth_error: code });
    if (st?.from) q.set("from", st.from);
    if (st?.next) q.set("next", st.next);
    return append(NextResponse.redirect(`${origin}/login?${q.toString()}`, 302), clear);
  };

  if (!googleConfigured()) return fail("not_configured");
  const st = verify<OAuthState>("state", readCookie(req, OAUTH_STATE_COOKIE));
  if (!st || st.provider !== "google") return fail("state_missing");
  if (url.searchParams.get("state") !== st.state) return fail("state_mismatch", st);
  if (url.searchParams.get("error")) return fail("denied", st);
  const code = url.searchParams.get("code");
  if (!code) return fail("no_code", st);

  let profile: OAuthProfile;
  try {
    profile = await googleExchange({ code, redirectUri: `${origin}/api/auth/oauth/google/callback`, nonce: st.nonce });
  } catch (e) {
    console.error("[oauth/google] 교환 실패", e instanceof Error ? e.message : e);
    return fail("exchange_failed", st);
  }

  await connectDB();
  const User = getUserModel();
  const back = new URLSearchParams();
  if (st.from) back.set("from", st.from);
  if (st.next) back.set("next", st.next);
  const backQs = back.toString() ? `?${back.toString()}` : "";

  /* 로그인한 상태에서 "연결" — 세션은 그대로, providers 만 더한다 */
  if (st.linkTo) {
    const taken = await User.findOne({ "providers.provider": "google", "providers.providerId": profile.providerId }).exec();
    if (taken && String(taken._id) !== st.linkTo) return fail("already_linked", st);
    await User.updateOne(
      { _id: st.linkTo, "providers.providerId": { $ne: profile.providerId } },
      { $push: { providers: { provider: "google", providerId: profile.providerId, email: profile.email, linkedAt: new Date() } } },
    ).exec();
    return append(NextResponse.redirect(`${origin}${st.next && st.next.startsWith("/") ? st.next : "/"}`, 302), clear);
  }

  /* ① */
  let user = await User.findOne({ "providers.provider": "google", "providers.providerId": profile.providerId, withdrawnAt: null }).exec();

  /* ② */
  if (!user && profile.email && profile.emailVerified) {
    const byEmail = await User.findOne({ email: profile.email, withdrawnAt: null, parentId: null }).exec();
    if (byEmail) {
      byEmail.providers.push({ provider: "google", providerId: profile.providerId, email: profile.email, linkedAt: new Date() });
      if (!byEmail.emailVerified) byEmail.emailVerified = true;
      await byEmail.save();
      user = byEmail;
    }
  }

  /* ③ · ④ — 첫 가입: 프로필을 10분 쿠키에 담아 동의 화면으로 */
  if (!user) {
    const res = NextResponse.redirect(`${origin}/signup/social${backQs}`, 302);
    return append(res, [...clear, setCookieHeader(req, OAUTH_SIGNUP_COOKIE, sign("signup", { profile, from: st.from, next: st.next }))]);
  }

  /* 로그인 — 자녀가 있으면 프로필 고르기, 없으면 바로 세션 */
  user.lastLoginAt = new Date();
  await user.save();
  const children = await User.countDocuments({ parentId: user._id, independentAt: null, withdrawnAt: null }).exec();
  if (children > 0) {
    const q = new URLSearchParams(back);
    q.set("pick", signPickToken(String(user._id)));
    return append(NextResponse.redirect(`${origin}/login?${q.toString()}`, 302), clear);
  }
  /*
    ⚠️ NextResponse.redirect 는 **절대 URL** 만 받는다. 상대 경로("/")를 주면 던져서 500 이 난다 —
    2026-09-10 첫 운영 시도에서 그랬다. 앱에서 왔으면(from) 로그인 화면으로 보내 거기서 앱 복귀 규칙을 태운다.
  */
  const localNext = st.next && st.next.startsWith("/") && !st.next.startsWith("//") ? st.next : "/";
  const to = st.from ? `${origin}/login${backQs}` : `${origin}${localNext}`;
  return append(redirectWithSession(req, user, null, to), clear);
}
