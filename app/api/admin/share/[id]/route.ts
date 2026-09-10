import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { adminError, requireAdmin } from "@/lib/adminAuth";
import { getShareLinkModel } from "@/models/ShareLink";
import { listShareLinks, parseShareLinkBody } from "@/lib/shareLinks";

export const runtime = "nodejs";

/** 공유형 링크 하나 — 수정(PATCH) · 삭제(DELETE). 숨기려면 PATCH `active:false` 가 낫다 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  try {
    const { id } = await ctx.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ ok: false, error: "링크를 찾을 수 없습니다." }, { status: 404 });
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }
    const { out, errors } = parseShareLinkBody(body, true);
    if (errors.length) return NextResponse.json({ ok: false, error: errors[0] }, { status: 400 });

    await connectDB();
    const hit = await getShareLinkModel().updateOne({ _id: id }, { $set: { ...out, updatedAt: new Date() } }).exec();
    if (hit.matchedCount === 0) return NextResponse.json({ ok: false, error: "링크를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true, links: await listShareLinks() });
  } catch (err) {
    return adminError(err);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  try {
    const { id } = await ctx.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ ok: false, error: "링크를 찾을 수 없습니다." }, { status: 404 });
    await connectDB();
    await getShareLinkModel().deleteOne({ _id: id }).exec();
    return NextResponse.json({ ok: true, links: await listShareLinks() });
  } catch (err) {
    return adminError(err);
  }
}
