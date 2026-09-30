import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
  auditImpersonation,
  clearImpersonationHeaders,
  isAdminDoc,
  isSameSiteRequest,
  readRestoreClaims,
  safeReturnUrl,
} from "@/lib/impersonation";
import { displayCookieHeader, displayUser } from "@/lib/profileSession";
import { getSessionClaims } from "@/lib/serverSession";
import { clearSessionCookieHeaders, sessionCookieHeaders, withSetCookies } from "@/lib/sessionCookie";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

/**
 * 대리 로그인 **종료** — 관리자 본인 세션으로 되돌린다 → lib/impersonation.ts
 *
 * 경고 바의 "종료" 와, 남은 시간이 0 이 되었을 때 바가 자동으로 부른다(`reason=expired`).
 * 대리 토큰이 이미 만료됐어도 끝낼 수 있어야 하므로 **맡겨 둔 관리자 토큰**(snap_admin_restore)
 * 을 기준으로 한다. 그 토큰이 없거나 더 관리자가 아니면 모두 지우고 로그인 화면으로 보낸다.
 */
export async function POST(req: Request) {
  const wantsJson = (req.headers.get("accept") ?? "").includes("application/json");
  let reason: string | null = null;
  try {
    const form = await req.formData();
    const r = form.get("reason");
    reason = typeof r === "string" ? r : null;
  } catch {
    /* 빈 본문 */
  }

  if (!isSameSiteRequest(req)) {
    return NextResponse.json({ ok: false, error: "허용되지 않은 요청입니다." }, { status: 403 });
  }

  await connectDB();
  const User = getUserModel();

  const impClaims = getSessionClaims(req);
  const restore = readRestoreClaims(req);
  const admin = restore ? await User.findOne({ userId: restore.claims.u }).exec() : null;
  const target = impClaims?.imp ? await User.findOne({ userId: impClaims.u }).exec() : null;

  // 관리자 세션을 되돌릴 수 없다 — 모두 지우고 로그인 화면으로
  if (!restore || !isAdminDoc(admin) || (restore.claims.sv ?? 0) !== (admin.sessionVersion ?? 0)) {
    const to = safeReturnUrl(req, null, "/login");
    return withSetCookies(
      wantsJson
        ? NextResponse.json({ ok: true, restored: false, next: "/login" })
        : NextResponse.redirect(to, 303),
      clearSessionCookieHeaders(req),
    );
  }

  await auditImpersonation(req, {
    action: reason === "expired" ? "impersonate.expire" : "impersonate.end",
    admin,
    target,
  });

  // 관리자 회원 관리 화면으로 돌아간다
  const to = safeReturnUrl(req, null, "/admin/members");
  return withSetCookies(
    wantsJson
      ? NextResponse.json({ ok: true, restored: true, next: "/admin/members" })
      : NextResponse.redirect(to, 303),
    [
      ...clearImpersonationHeaders(req),
      ...sessionCookieHeaders(req, restore.token),
      displayCookieHeader(req, displayUser(admin, null)),
    ],
  );
}
