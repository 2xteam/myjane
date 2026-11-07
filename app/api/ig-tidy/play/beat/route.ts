import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { LEASE_MS, igError, loadSettings, publicSettings, requireIgTidyUser } from "@/lib/igTidy";
import { getIgPlayModel } from "@/models/IgTidy";

export const runtime = "nodejs";

/**
 * 실행 중 60초마다 — 임대를 늘리고 진행 수치를 남긴다.
 *
 * 본문: `{ playId, tally, reason? }`
 *
 * 응답의 `stop` 이 있으면 앱은 **그 문구로 즉시 멈춘다.** 넘겨받기(다른 PC)·관리자 종료·
 * 관리자가 전체를 멈춤 — 세 경우 모두 이 길로 알린다. 앱이 서버를 계속 부를 필요가 없다.
 *
 * 실행이 이미 닫혔으면(임대가 지나 lost 로 정리됨 등) 410 play_gone — 앱은 다시 시작을 시도한다.
 */
export async function POST(req: Request) {
  const auth = await requireIgTidyUser(req);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const body = (await req.json().catch(() => ({}))) as { playId?: unknown; tally?: unknown; reason?: unknown };
  const playId = String(body.playId ?? "");
  if (!Types.ObjectId.isValid(playId)) return igError("bad_request", "실행 번호가 없어요.", 400);

  await connectDB();
  const Plays = getIgPlayModel();
  const play = await Plays.findOne({ _id: playId, uid: user._id }).lean().exec();
  if (!play) return igError("play_gone", "실행 기록을 찾지 못했어요.", 410);

  if (play.status !== "running") {
    return NextResponse.json({
      ok: true,
      stop: play.stopRequest || play.reason || "이 실행은 이미 끝났어요.",
      status: play.status,
    });
  }

  const settings = publicSettings(await loadSettings());
  if (!settings.enabled) {
    const msg = settings.disabledMessage || "관리자가 잠시 멈춰 두었어요.";
    await Plays.updateOne(
      { _id: play._id, status: "running" },
      { $set: { status: "ended_by_admin", endedAt: new Date(), reason: msg, stopRequest: msg } },
    ).exec();
    return NextResponse.json({ ok: true, stop: msg, status: "ended_by_admin" });
  }

  const now = new Date();
  const set: Record<string, unknown> = { lastBeatAt: now, leaseUntil: new Date(now.getTime() + LEASE_MS) };
  if (body.tally && typeof body.tally === "object") set.tally = body.tally;
  if (typeof body.reason === "string") set.reason = body.reason.slice(0, 300);
  await Plays.updateOne({ _id: play._id, status: "running" }, { $set: set }).exec();

  return NextResponse.json({ ok: true, leaseUntil: set.leaseUntil, settings });
}
