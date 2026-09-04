import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { adminError, requireAdmin } from "@/lib/adminAuth";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

/**
 * 통합 회원 목록.
 *
 * **통합 admin에서 가장 값진 화면이다.** 한 사람이 어느 앱을 쓰는지, 어떤 수단으로
 * 로그인하는지, 언제 마지막으로 들어왔는지를 한 자리에서 본다 —
 * 각 앱의 admin에서는 원래 볼 수 없던 것이다.
 *
 * 회원(`user` DB)은 포털 자신의 데이터라 앱 API를 거치지 않고 직접 읽는다.
 */

const iso = (d: unknown): string | null => (d instanceof Date ? d.toISOString() : null);

/** 정규식 검색어에 들어온 특수문자를 그대로 문자로 다룬다 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 500);

    await connectDB();
    const User = getUserModel();

    const filter: Record<string, unknown> = {};
    if (q) {
      const rx = { $regex: escapeRegex(q), $options: "i" };
      filter.$or = [{ name: rx }, { nickname: rx }, { email: rx }, { phone: rx }];
    }

    const rows = await User.find(filter)
      .select({
        name: 1, nickname: 1, email: 1, phone: 1, pin: 1, password: 1,
        userId: 1, signupFrom: 1, adminRole: 1, createdAt: 1, lastLoginAt: 1,
      })
      .sort({ lastLoginAt: -1, createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    const users = rows.map((u) => ({
      id: String(u._id),
      name: u.nickname ?? u.name ?? "",
      email: u.email ?? null,
      // 전화번호는 관리 목적에도 통째로 보일 이유가 없다. 뒤 4자리만
      phoneTail: u.phone ? String(u.phone).slice(-4) : null,
      /** 이 계정이 쓸 수 있는 로그인 수단 — 어느 칸이 채워졌는지가 곧 수단이다 */
      methods: [u.pin ? "PIN" : null, u.password ? "비밀번호" : null].filter(Boolean),
      /** 2hbk 도메인 식별자. 없으면 2hbk를 아직 쓴 적 없는 계정이다 */
      userId: u.userId ?? null,
      signupFrom: u.signupFrom ?? null,
      adminRole: u.adminRole ?? null,
      createdAt: iso(u.createdAt),
      lastLoginAt: iso(u.lastLoginAt),
    }));

    return NextResponse.json({ ok: true, users, total: users.length });
  } catch (err) {
    return adminError(err);
  }
}
