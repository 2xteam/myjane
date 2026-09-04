import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { adminError, requireAdmin } from "@/lib/adminAuth";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * 운영자를 세우고 내린다. **마스터만** 할 수 있다.
 *
 * 마스터는 시드로 정해진 한 계정뿐이고 이 API로는 만들 수 없다.
 * 마스터를 여기서 세울 수 있게 두면, 운영자 한 명만 뚫려도 마스터가 늘어난다.
 * → scripts/seed-admin.mjs
 */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdmin(req, { master: true });
  if ("error" in auth) return auth.error;

  try {
    const body = (await req.json()) as { role?: unknown };
    const role = body.role;

    if (role !== "operator" && role !== null) {
      return NextResponse.json(
        { ok: false, error: "운영자로 세우거나(operator) 내리는 것(null)만 할 수 있습니다." },
        { status: 400 },
      );
    }

    const { id } = await params;
    await connectDB();
    const User = getUserModel();

    const target = await User.findById(id).exec();
    if (!target) {
      return NextResponse.json({ ok: false, error: "회원을 찾을 수 없습니다." }, { status: 404 });
    }

    // 마스터는 이 경로로 바꿀 수 없다. 스스로를 내려 잠기는 것도 막는다
    if (target.adminRole === "master") {
      return NextResponse.json(
        { ok: false, error: "마스터 권한은 여기서 바꿀 수 없습니다." },
        { status: 403 },
      );
    }

    target.adminRole = role;
    await target.save();

    return NextResponse.json({
      ok: true,
      user: {
        id: String(target._id),
        name: target.nickname ?? target.name ?? "",
        adminRole: target.adminRole ?? null,
      },
    });
  } catch (err) {
    return adminError(err);
  }
}
