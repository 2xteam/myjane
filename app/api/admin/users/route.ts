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

/**
 * 정렬할 수 있는 항목 → 정렬에 쓰는 값.
 * 화면의 열 이름과 같다. 이름은 닉네임이 있으면 닉네임(화면에 보이는 값)이다.
 * 로그인 수단은 가진 수단의 개수, 2hbk 는 사용 여부, 권한은 마스터 > 운영자 > 없음.
 */
const SORT_FIELDS: Record<string, string> = {
  name: "_sortName",
  email: "email",
  phone: "phone",
  methods: "_methodCount",
  signupFrom: "signupFrom",
  uses2hbk: "_uses2hbk",
  lastLoginAt: "lastLoginAt",
  createdAt: "createdAt",
  adminRole: "_roleRank",
};

const DEFAULT_SORT = "createdAt";
const MAX_PAGE_SIZE = 500;

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();

    // 정렬 — 기본은 가입일 내림차순(최근 가입이 위)
    const sortKey = SORT_FIELDS[url.searchParams.get("sort") ?? ""] ? url.searchParams.get("sort")! : DEFAULT_SORT;
    const dir = url.searchParams.get("dir") === "asc" ? 1 : -1;

    // 페이징 — 1부터 센다. 한 쪽은 1~500건
    const pageSize = Math.min(Math.max(Math.floor(Number(url.searchParams.get("pageSize")) || 20), 1), MAX_PAGE_SIZE);
    const page = Math.max(Math.floor(Number(url.searchParams.get("page")) || 1), 1);

    await connectDB();
    const User = getUserModel();

    const filter: Record<string, unknown> = {};
    if (q) {
      const rx = { $regex: escapeRegex(q), $options: "i" };
      filter.$or = [{ name: rx }, { nickname: rx }, { email: rx }, { phone: rx }];
    }

    /*
      계산이 필요한 정렬(이름·로그인 수단·2hbk·권한)이 있어 aggregate 로 한 번에 센다.
      같은 값끼리는 _id 로 순서를 고정한다 — 쪽을 넘길 때 같은 회원이 두 번 보이거나 빠지지 않게.
    */
    const [result] = await User.aggregate<{
      rows: Array<Record<string, unknown>>;
      total: Array<{ n: number }>;
    }>([
      { $match: filter },
      {
        $addFields: {
          _sortName: { $toLower: { $ifNull: ["$nickname", { $ifNull: ["$name", ""] }] } },
          _methodCount: {
            $add: [
              { $cond: [{ $gt: [{ $ifNull: ["$pin", ""] }, ""] }, 1, 0] },
              { $cond: [{ $gt: [{ $ifNull: ["$password", ""] }, ""] }, 1, 0] },
            ],
          },
          _uses2hbk: { $cond: [{ $gt: [{ $ifNull: ["$userId", ""] }, ""] }, 1, 0] },
          _roleRank: {
            $switch: {
              branches: [
                { case: { $eq: ["$adminRole", "master"] }, then: 2 },
                { case: { $eq: ["$adminRole", "operator"] }, then: 1 },
              ],
              default: 0,
            },
          },
        },
      },
      { $sort: { [SORT_FIELDS[sortKey]]: dir, _id: dir } },
      {
        $facet: {
          rows: [
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize },
            {
              $project: {
                name: 1, nickname: 1, email: 1, phone: 1, pin: 1, password: 1, parentId: 1,
                userId: 1, signupFrom: 1, adminRole: 1, createdAt: 1, lastLoginAt: 1,
              },
            },
          ],
          total: [{ $count: "n" }],
        },
      },
    ]);

    const total = result?.total[0]?.n ?? 0;
    type Row = {
      _id: unknown; name?: string; nickname?: string; email?: string; phone?: string; pin?: string;
      password?: string; parentId?: unknown; userId?: string; signupFrom?: string;
      adminRole?: string; createdAt?: unknown; lastLoginAt?: unknown;
    };
    const users = ((result?.rows ?? []) as Row[]).map((u) => ({
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
      /** 자녀 프로필이면 보호자 회원 id → lib/family.ts */
      parentId: u.parentId ? String(u.parentId) : null,
      createdAt: iso(u.createdAt),
      lastLoginAt: iso(u.lastLoginAt),
    }));

    return NextResponse.json({
      ok: true,
      users,
      total,
      page,
      pageSize,
      sort: sortKey,
      dir: dir === 1 ? "asc" : "desc",
    });
  } catch (err) {
    return adminError(err);
  }
}
