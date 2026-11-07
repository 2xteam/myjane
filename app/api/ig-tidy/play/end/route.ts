import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { igError, requireIgTidyUser } from "@/lib/igTidy";
import { getIgPlayModel } from "@/models/IgTidy";

export const runtime = "nodejs";

const END_STATUS = new Set(["done", "paused", "blocked", "stopped"]);

/**
 * 실행을 닫는다 — 완료 · 일시정지 · 제한 안내 · 사용자가 멈춤.
 *
 * 본문: `{ playId, status, reason, tally }`
 *
 * 이미 닫힌 실행(넘겨받기·관리자 종료)이면 상태를 덮어쓰지 않는다 — 왜 끝났는지가 사라진다.
 * 수치만 마지막 값으로 맞춘다.
 */
export async function POST(req: Request) {
  const auth = await requireIgTidyUser(req);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const body = (await req.json().catch(() => ({}))) as {
    playId?: unknown; status?: unknown; reason?: unknown; tally?: unknown;
  };
  const playId = String(body.playId ?? "");
  if (!Types.ObjectId.isValid(playId)) return igError("bad_request", "실행 번호가 없어요.", 400);
  const status = END_STATUS.has(String(body.status)) ? String(body.status) : "stopped";

  await connectDB();
  const Plays = getIgPlayModel();
  const tally = body.tally && typeof body.tally === "object" ? body.tally : undefined;
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 300) : "";

  const closed = await Plays.updateOne(
    { _id: playId, uid: user._id, status: "running" },
    { $set: { status, reason, endedAt: new Date(), ...(tally ? { tally } : {}) } },
  ).exec();

  if (!closed.matchedCount && tally) {
    await Plays.updateOne({ _id: playId, uid: user._id }, { $set: { tally } }).exec();
  }
  return NextResponse.json({ ok: true });
}
