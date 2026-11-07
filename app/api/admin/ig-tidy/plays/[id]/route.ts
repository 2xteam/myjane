import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { adminError, requireAdmin } from "@/lib/adminAuth";
import { getIgPlayModel, getIgRunlogModel } from "@/models/IgTidy";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** 실행 하나 — 설정 요약과 행동 기록(최대 2,000줄) */
export async function GET(req: Request, { params }: Params) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ ok: false, error: "잘못된 번호" }, { status: 400 });
    await connectDB();
    const [play, lines] = await Promise.all([
      getIgPlayModel().findById(id).lean().exec(),
      getIgRunlogModel().find({ playId: new Types.ObjectId(id) }).sort({ t: 1 }).limit(2000).lean().exec(),
    ]);
    if (!play) return NextResponse.json({ ok: false, error: "실행을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({
      ok: true,
      opts: play.opts ?? {},
      tally: play.tally ?? {},
      lines: lines.map((l) => ({
        t: l.t instanceof Date ? l.t.toISOString() : null,
        action: l.action, result: l.result, user: l.user, note: l.note,
      })),
    });
  } catch (err) {
    return adminError(err);
  }
}

/**
 * 실행을 끝낸다(관리자). 앱은 다음 연장(1분 안)에서 이 문구로 멈춘다.
 * 본문: `{ message? }`
 */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ ok: false, error: "잘못된 번호" }, { status: 400 });
    const body = (await req.json().catch(() => ({}))) as { message?: unknown };
    const msg = (typeof body.message === "string" && body.message.trim()) || "관리자가 실행을 끝냈어요.";
    await connectDB();
    const r = await getIgPlayModel()
      .updateOne(
        { _id: id, status: "running" },
        { $set: { status: "ended_by_admin", endedAt: new Date(), reason: msg.slice(0, 300), stopRequest: msg.slice(0, 300) } },
      )
      .exec();
    return NextResponse.json({ ok: true, ended: r.modifiedCount > 0 });
  } catch (err) {
    return adminError(err);
  }
}
