import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { adminError, requireAdmin } from "@/lib/adminAuth";
import { getIgAiLogModel } from "@/models/IgTidy";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

/**
 * AI 댓글 기록 — 누가 · 어느 아이디로 · 누구 글에 · 무슨 문구를 · 토큰 얼마로. 최근부터.
 *   ?page · ?pageSize · ?uid
 * 만든 문구를 사람이 훑어볼 수 있어야 한다 — 남의 글에 우리 이름으로 말을 거는 일이다.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  try {
    const url = new URL(req.url);
    const pageSize = Math.min(Math.max(Math.floor(Number(url.searchParams.get("pageSize")) || 20), 1), 200);
    const page = Math.max(Math.floor(Number(url.searchParams.get("page")) || 1), 1);
    const filter: Record<string, unknown> = {};
    const uid = url.searchParams.get("uid");
    if (uid && Types.ObjectId.isValid(uid)) filter.uid = new Types.ObjectId(uid);

    await connectDB();
    const Logs = getIgAiLogModel();
    const [rows, total] = await Promise.all([
      Logs.find(filter).sort({ at: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean().exec(),
      Logs.countDocuments(filter).exec(),
    ]);
    const users = await getUserModel()
      .find({ _id: { $in: [...new Set(rows.map((r) => String(r.uid)))] } }, { name: 1, nickname: 1, email: 1 })
      .lean().exec();
    const nameOf = new Map(users.map((u) => [String(u._id), u.nickname ?? u.name ?? u.email ?? ""]));
    return NextResponse.json({
      ok: true, total, page, pageSize,
      logs: rows.map((r) => ({
        id: String(r._id),
        at: r.at instanceof Date ? r.at.toISOString() : null,
        member: nameOf.get(String(r.uid)) ?? "",
        igUsername: r.igUsername, target: r.target, permalink: r.permalink,
        comment: r.comment, skip: !!r.skip, reason: r.reason, ok: !!r.ok, error: r.error,
        tokens: r.totalTokens ?? null, withImage: !!r.withImage, ms: r.ms, style: r.style ?? "basic",
      })),
    });
  } catch (err) {
    return adminError(err);
  }
}
