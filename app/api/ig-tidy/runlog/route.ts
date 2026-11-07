import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { igError, normalizeIg, requireIgTidyUser } from "@/lib/igTidy";
import { getIgAccountModel, getIgRunlogModel } from "@/models/IgTidy";

export const runtime = "nodejs";

/**
 * 행동 기록 — 아이디별 히스토리. 앱이 쌓아 두었다가 30초마다·멈출 때 묶어서 올린다.
 *
 *   POST { igUsername, playId?, lines: [{ t, action, result, user, note }] }   (한 번에 500줄까지)
 *   GET  ?ig=zang.f1t&before=<ISO>&limit=200                                   최근부터
 */

const MAX_LINES = 500;

export async function POST(req: Request) {
  const auth = await requireIgTidyUser(req);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const body = (await req.json().catch(() => ({}))) as { igUsername?: unknown; playId?: unknown; lines?: unknown };
  const ig = normalizeIg(body.igUsername);
  if (!ig || !Array.isArray(body.lines)) return igError("bad_request", "올릴 기록이 없어요.", 400);
  if (body.lines.length > MAX_LINES) return igError("bad_request", `한 번에 ${MAX_LINES}줄까지 올릴 수 있어요.`, 400);

  await connectDB();
  const a = await getIgAccountModel().findOne({ igUsername: ig }).lean().exec();
  if (!a || String(a.uid) !== String(user._id)) {
    return igError("account_taken", `@${ig} 는 이 계정에 등록된 아이디가 아니에요.`, 409);
  }

  const playId = Types.ObjectId.isValid(String(body.playId ?? "")) ? new Types.ObjectId(String(body.playId)) : null;
  const s = (v: unknown, n: number) => String(v ?? "").slice(0, n);
  const docs = (body.lines as Array<Record<string, unknown>>)
    .map((l) => {
      const t = new Date(Number(l.t) || String(l.t));
      if (Number.isNaN(t.getTime())) return null;
      return {
        uid: user._id, igUsername: ig, playId, t,
        action: s(l.action, 20), result: s(l.result, 10), user: s(l.user, 40), note: s(l.note, 300),
      };
    })
    .filter(Boolean);
  if (docs.length) await getIgRunlogModel().insertMany(docs, { ordered: false });
  return NextResponse.json({ ok: true, saved: docs.length });
}

export async function GET(req: Request) {
  const auth = await requireIgTidyUser(req);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const url = new URL(req.url);
  const ig = normalizeIg(url.searchParams.get("ig"));
  if (!ig) return igError("bad_request", "인스타그램 아이디가 없어요.", 400);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 200, 1), 1000);
  const before = url.searchParams.get("before");

  await connectDB();
  const filter: Record<string, unknown> = { uid: user._id, igUsername: ig };
  if (before && !Number.isNaN(Date.parse(before))) filter.t = { $lt: new Date(before) };
  const rows = await getIgRunlogModel().find(filter).sort({ t: -1 }).limit(limit).lean().exec();
  return NextResponse.json({
    ok: true,
    lines: rows.map((r) => ({
      t: r.t instanceof Date ? r.t.getTime() : null,
      action: r.action, result: r.result, user: r.user, note: r.note,
      playId: r.playId ? String(r.playId) : null,
    })),
  });
}
