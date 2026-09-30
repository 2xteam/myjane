import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
  IMPERSONATION_EXTEND_WINDOW_SEC,
  IMPERSONATION_TTL_SEC,
  auditImpersonation,
  impersonationCookieHeaders,
  isAdminDoc,
  isSameSiteRequest,
  nowSec,
  safeReturnUrl,
} from "@/lib/impersonation";
import { getSessionClaims } from "@/lib/serverSession";
import { withSetCookies } from "@/lib/sessionCookie";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

/**
 * 대리 로그인 **연장** — 남은 시간이 5분 이내일 때만, 1시간을 더한다 → lib/impersonation.ts
 *
 * 앱의 경고 바가 폼으로 POST 한다(`next` = 지금 보던 주소). 끝나면 그 주소로 되돌려 보낸다.
 * 화면이 fetch 로 부르면(Accept: application/json) JSON 으로 답한다.
 *
 * 연장할 때마다 **관리자가 아직 관리자인지** 다시 본다. 권한을 내린 뒤에는 늘릴 수 없다.
 */
export async function POST(req: Request) {
  const wantsJson = (req.headers.get("accept") ?? "").includes("application/json");
  let next: string | null = null;
  try {
    const form = await req.formData();
    const v = form.get("next");
    next = typeof v === "string" ? v : null;
  } catch {
    /* JSON 이나 빈 본문 — next 없이 */
  }
  const back = safeReturnUrl(req, next, "/");

  const fail = (status: number, error: string) =>
    wantsJson
      ? NextResponse.json({ ok: false, error }, { status })
      : NextResponse.redirect(back, 303);

  if (!isSameSiteRequest(req)) return fail(403, "허용되지 않은 요청입니다.");

  const claims = getSessionClaims(req);
  if (!claims?.imp) return fail(400, "대리 로그인 중이 아닙니다.");

  const left = claims.exp - nowSec();
  if (left > IMPERSONATION_EXTEND_WINDOW_SEC) {
    return fail(400, "남은 시간이 5분 이내일 때만 연장할 수 있습니다.");
  }

  await connectDB();
  const User = getUserModel();
  const [admin, target] = await Promise.all([
    User.findById(claims.imp).exec(),
    User.findOne({ userId: claims.u }).exec(),
  ]);
  if (!isAdminDoc(admin)) return fail(403, "관리자 권한이 없어 연장할 수 없습니다.");
  if (!target || target.withdrawnAt) return fail(404, "고객 계정을 찾을 수 없습니다.");
  if ((claims.sv ?? 0) !== (target.sessionVersion ?? 0)) return fail(401, "고객 세션이 폐기되었습니다.");

  const exp = claims.exp + IMPERSONATION_TTL_SEC;
  await auditImpersonation(req, { action: "impersonate.extend", admin, target, expiresAt: exp });

  return withSetCookies(
    wantsJson ? NextResponse.json({ ok: true, exp }) : NextResponse.redirect(back, 303),
    impersonationCookieHeaders(req, target, admin, exp),
  );
}
