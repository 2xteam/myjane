import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { adminError, requireAdmin } from "@/lib/adminAuth";
import {
  IMPERSONATION_TTL_SEC,
  auditImpersonation,
  impersonationCookieHeaders,
  nowSec,
  restoreCookieHeader,
} from "@/lib/impersonation";
import { readSessionTokenFromRequest, withSetCookies } from "@/lib/sessionCookie";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** 2hbk 도메인 식별자 — 세션 토큰이 이 값을 담고, 포털은 이 값으로 회원을 찾는다 */
function newUserId(): string {
  return `user_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * 고객 계정으로 **대리 로그인**을 시작한다. 마스터·운영자 모두 할 수 있다 → lib/impersonation.ts
 *
 * - 대상이 관리자이면 막는다(관리자끼리 권한을 빌리는 통로가 된다)
 * - 탈퇴한 계정은 막는다
 * - 세션은 1시간. 관리자 본인 세션은 snap_admin_restore 에 맡겨 두었다가 종료할 때 되돌린다
 */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  const admin = auth.admin.doc;

  try {
    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ ok: false, error: "회원 id 가 올바르지 않습니다." }, { status: 400 });
    }
    if (String(admin._id) === id) {
      return NextResponse.json({ ok: false, error: "자기 계정으로는 대리 로그인할 수 없습니다." }, { status: 400 });
    }

    await connectDB();
    const target = await getUserModel().findById(id).exec();
    if (!target) {
      return NextResponse.json({ ok: false, error: "회원을 찾을 수 없습니다." }, { status: 404 });
    }
    if (target.adminRole === "master" || target.adminRole === "operator") {
      return NextResponse.json(
        { ok: false, error: "관리자 계정으로는 대리 로그인할 수 없습니다." },
        { status: 403 },
      );
    }
    if (target.withdrawnAt) {
      return NextResponse.json({ ok: false, error: "탈퇴한 계정입니다." }, { status: 403 });
    }

    // 포털은 토큰의 userId 로 회원을 찾는다. 옛 계정(전화번호 가입)에는 없을 수 있다 — 로그인과 같은 처리
    if (!target.userId) {
      target.userId = newUserId();
      await target.save();
    }

    const adminToken = readSessionTokenFromRequest(req);
    if (!adminToken) {
      return NextResponse.json({ ok: false, error: "관리자 세션을 읽지 못했습니다." }, { status: 401 });
    }

    const exp = nowSec() + IMPERSONATION_TTL_SEC;
    await auditImpersonation(req, { action: "impersonate.start", admin, target, expiresAt: exp });

    return withSetCookies(
      NextResponse.json({
        ok: true,
        exp,
        user: { id: String(target._id), name: target.nickname ?? target.name ?? "" },
        next: "/",
      }),
      [restoreCookieHeader(req, adminToken), ...impersonationCookieHeaders(req, target, admin, exp)],
    );
  } catch (err) {
    return adminError(err);
  }
}
