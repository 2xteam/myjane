import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { adminError, requireAdmin } from "@/lib/adminAuth";
import { migrateLegacyNotice, noticeLevelOf, noticeView } from "@/lib/igTidy";
import { getIgNoticeModel } from "@/models/IgTidy";

export const runtime = "nodejs";

/**
 * IG Tidy 공지 게시판 — 관리 화면 「공지」 탭(2026-11-08). 운영자·마스터.
 *
 *   GET                                         → { ok, notices:[{ id, title, body, level, active, publishedAt, updatedAt }] } 최근부터
 *   POST   { title, body, level, active }       → { ok, notice }
 *   PATCH  { id, title?, body?, level?, active?, republish? } → { ok, notice }
 *   DELETE { id }                               → { ok }
 *
 * 앱은 publishedAt 으로 「새 공지」 를 가린다(닫은 공지는 다시 안 뜬다). 그래서 글을 고쳐도 시각은 그대로고,
 * `republish: true` 일 때만 지금으로 새로 찍는다 — 닫은 사람에게도 다시 띄우고 싶을 때.
 * 꺼 둔 공지를 다시 켤 때도 시각은 그대로다(같은 공지라서).
 */
const TITLE_MAX = 120;
const BODY_MAX = 3000;

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  try {
    await connectDB();
    await migrateLegacyNotice();
    const rows = await getIgNoticeModel().find().sort({ publishedAt: -1, _id: -1 }).limit(200).lean().exec();
    return NextResponse.json({ ok: true, notices: rows.map((r) => noticeView(r as Record<string, unknown>)) });
  } catch (err) {
    return adminError(err);
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const title = String(b.title ?? "").trim().slice(0, TITLE_MAX);
    if (!title) return NextResponse.json({ ok: false, error: "제목을 적어 주세요." }, { status: 400 });
    await connectDB();
    const now = new Date();
    const doc = await getIgNoticeModel().create({
      title,
      body: String(b.body ?? "").replace(/\r\n/g, "\n").trim().slice(0, BODY_MAX),
      level: noticeLevelOf(b.level),
      active: b.active !== false,
      publishedAt: now,
      updatedAt: now,
      createdBy: auth.admin.doc._id,
    });
    return NextResponse.json({ ok: true, notice: noticeView(doc.toObject() as Record<string, unknown>) });
  } catch (err) {
    return adminError(err);
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const id = String(b.id ?? "");
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ ok: false, error: "id 가 필요합니다." }, { status: 400 });
    const now = new Date();
    const set: Record<string, unknown> = { updatedAt: now };
    if (b.title !== undefined) {
      const title = String(b.title ?? "").trim().slice(0, TITLE_MAX);
      if (!title) return NextResponse.json({ ok: false, error: "제목을 비울 수 없어요." }, { status: 400 });
      set.title = title;
    }
    if (b.body !== undefined) set.body = String(b.body ?? "").replace(/\r\n/g, "\n").trim().slice(0, BODY_MAX);
    if (b.level !== undefined) set.level = noticeLevelOf(b.level);
    if (typeof b.active === "boolean") set.active = b.active;
    if (b.republish === true) set.publishedAt = now;

    await connectDB();
    const doc = await getIgNoticeModel()
      .findOneAndUpdate({ _id: new Types.ObjectId(id) }, { $set: set }, { new: true })
      .lean()
      .exec();
    if (!doc) return NextResponse.json({ ok: false, error: "공지를 찾지 못했어요." }, { status: 404 });
    return NextResponse.json({ ok: true, notice: noticeView(doc as Record<string, unknown>) });
  } catch (err) {
    return adminError(err);
  }
}

export async function DELETE(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  try {
    const b = (await req.json().catch(() => ({}))) as { id?: unknown };
    const id = String(b.id ?? "");
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ ok: false, error: "id 가 필요합니다." }, { status: 400 });
    await connectDB();
    await getIgNoticeModel().deleteOne({ _id: new Types.ObjectId(id) }).exec();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return adminError(err);
  }
}
