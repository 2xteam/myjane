import { NextResponse } from "next/server";
import { adminError, getAdmin } from "@/lib/adminAuth";
import { ADMIN_APPS } from "@/lib/adminApps";

export const runtime = "nodejs";

/**
 * 내가 관리자인지, 무엇을 볼 수 있는지.
 *
 * admin 화면이 가장 먼저 부른다. 403이면 화면을 그리지 않는다 —
 * 권한 없는 사람에게 탭 구조를 보여줄 이유가 없다.
 */
export async function GET(req: Request) {
  try {
    const admin = await getAdmin(req);
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "관리자 권한이 필요합니다." },
        { status: 403 },
      );
    }

    return NextResponse.json({
      ok: true,
      me: {
        name: admin.doc.nickname ?? admin.doc.name ?? "",
        email: admin.doc.email ?? null,
        role: admin.role,
      },
      apps: ADMIN_APPS.map((a) => ({ key: a.key, name: a.name, features: a.features })),
    });
  } catch (err) {
    return adminError(err);
  }
}
