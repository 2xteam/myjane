import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { aiQuota, loadSettings, publicSettings, requireIgTidyUser } from "@/lib/igTidy";
import { getIgAiLogModel, getIgPermModel } from "@/models/IgTidy";

export const runtime = "nodejs";

/**
 * AI 댓글 현황 — 앱 「대시보드」 의 AI댓글 칸(2026-11-08).
 *
 *   GET ?days=14 → { ok, quota, days:[{ day, made, skip, fail, photo, text, units, replies, replySkip }],
 *                    styles:{…}, replyStyles:{…}, totals:{ made, skip, fail, photo, text, units, replies, replySkip }, analyze }
 *
 * 답글(kind "reply", 2026-11-08)은 따로 센다 — made · skip · text · styles 는 **댓글만**(예전 뜻 그대로),
 * replies · replySkip · replyStyles 가 답글이다. fail · units 는 둘을 합친다(units 는 한도와 같은 단위).
 * 예전 줄에는 kind 가 없다 — 댓글로 본다.
 *
 * myjane 계정 단위(한도와 같은 단위) — 여러 PC · 여러 IG 아이디가 함께 센다. 날은 한국 시간.
 * 서버가 아는 것은 **만든 것**까지다(게시는 앱이 한다). 실제로 단 댓글 수는 앱의 날마다 한 일에 있다.
 */
export async function GET(req: Request) {
  const auth = await requireIgTidyUser(req);
  if ("error" in auth) return auth.error;
  const uid = auth.user._id;
  const days = Math.max(1, Math.min(60, Number(new URL(req.url).searchParams.get("days")) || 14));
  const since = new Date(Date.now() - days * 86_400_000);

  await connectDB();
  const perm = await getIgPermModel().findOne({ uid }).lean().exec();
  const settings = publicSettings(await loadSettings());
  const quota = await aiQuota(uid, !!(perm && perm.aiComment === true), settings);
  const weight = settings.aiPhotoWeight;
  const Logs = getIgAiLogModel();

  const isReply = { $eq: [{ $ifNull: ["$kind", "comment"] }, "reply"] };
  const isComment = { $and: [{ $not: [isReply] }, { $ne: ["$style", "analyze"] }] };
  const [byDay, byStyle] = await Promise.all([
    Logs.aggregate<{
      _id: string; made: number; skip: number; fail: number; photo: number; text: number; units: number; analyze: number;
      replies: number; replySkip: number;
    }>([
      { $match: { uid, at: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$at", timezone: "Asia/Seoul" } },
          made: { $sum: { $cond: [{ $and: ["$ok", { $not: ["$skip"] }, isComment] }, 1, 0] } },
          skip: { $sum: { $cond: [{ $and: ["$ok", "$skip", isComment] }, 1, 0] } },
          fail: { $sum: { $cond: ["$ok", 0, 1] } },
          photo: { $sum: { $cond: [{ $and: ["$ok", "$withImage"] }, 1, 0] } },
          text: { $sum: { $cond: [{ $and: ["$ok", { $not: ["$withImage"] }, isComment] }, 1, 0] } },
          units: { $sum: { $cond: ["$ok", { $cond: ["$withImage", weight, { $ifNull: ["$units", 1] }] }, 0] } },
          analyze: { $sum: { $cond: [{ $and: ["$ok", { $eq: ["$style", "analyze"] }] }, 1, 0] } },
          replies: { $sum: { $cond: [{ $and: ["$ok", { $not: ["$skip"] }, isReply] }, 1, 0] } },
          replySkip: { $sum: { $cond: [{ $and: ["$ok", "$skip", isReply] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Logs.aggregate<{ _id: { style: string; reply: boolean }; n: number }>([
      { $match: { uid, at: { $gte: since }, ok: true, skip: { $ne: true }, style: { $ne: "analyze" } } },
      { $group: { _id: { style: "$style", reply: isReply }, n: { $sum: 1 } } },
    ]),
  ]);

  const rows = byDay.map((d) => ({
    day: d._id, made: d.made, skip: d.skip, fail: d.fail, photo: d.photo, text: d.text, units: d.units,
    replies: d.replies, replySkip: d.replySkip,
  }));
  const sum = (k: keyof (typeof rows)[number]) => rows.reduce((n, r) => n + (Number(r[k]) || 0), 0);
  return NextResponse.json({
    ok: true,
    quota,
    days: rows,
    styles: Object.fromEntries(byStyle.filter((s) => !s._id.reply).map((s) => [s._id.style || "basic", s.n])),
    replyStyles: Object.fromEntries(byStyle.filter((s) => s._id.reply).map((s) => [s._id.style || "basic", s.n])),
    totals: {
      made: sum("made"), skip: sum("skip"), fail: sum("fail"), photo: sum("photo"), text: sum("text"), units: sum("units"),
      replies: sum("replies"), replySkip: sum("replySkip"),
    },
    analyze: byDay.reduce((n, d) => n + d.analyze, 0),
    range: days,
  });
}
