import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { adminError, requireAdmin } from "@/lib/adminAuth";
import { normalizeIg, playSummary, sweepLost } from "@/lib/igTidy";
import { getIgPlayModel } from "@/models/IgTidy";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

/**
 * 실행 이력 — 최근부터. 공용 페이징(`page` · `pageSize`)을 따른다 → 통합 admin.md "목록 정렬·페이징"
 *
 *   ?uid=<회원 _id>  ?ig=<아이디>  ?status=running|done|…
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const url = new URL(req.url);
    const pageSize = Math.min(Math.max(Math.floor(Number(url.searchParams.get("pageSize")) || 20), 1), 500);
    const page = Math.max(Math.floor(Number(url.searchParams.get("page")) || 1), 1);

    const filter: Record<string, unknown> = {};
    const uid = url.searchParams.get("uid");
    if (uid && Types.ObjectId.isValid(uid)) filter.uid = new Types.ObjectId(uid);
    const ig = normalizeIg(url.searchParams.get("ig"));
    if (ig) filter.igUsername = ig;
    const status = url.searchParams.get("status");
    if (status) filter.status = status;

    await connectDB();
    await sweepLost();
    const Plays = getIgPlayModel();
    const [rows, total] = await Promise.all([
      Plays.find(filter).sort({ startedAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean().exec(),
      Plays.countDocuments(filter).exec(),
    ]);

    const users = await getUserModel()
      .find({ _id: { $in: [...new Set(rows.map((r) => String(r.uid)))] } }, { name: 1, nickname: 1, email: 1 })
      .lean()
      .exec();
    const nameOf = new Map(users.map((u) => [String(u._id), u.nickname ?? u.name ?? u.email ?? ""]));

    return NextResponse.json({
      ok: true,
      total,
      page,
      pageSize,
      plays: rows.map((p) => ({
        ...playSummary(p),
        uid: String(p.uid),
        member: nameOf.get(String(p.uid)) ?? "",
        appVersion: p.appVersion ?? "",
        endedAt: p.endedAt instanceof Date ? p.endedAt.toISOString() : null,
        reason: p.reason ?? "",
        tally: p.tally ?? {},
      })),
    });
  } catch (err) {
    return adminError(err);
  }
}
