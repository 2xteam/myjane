import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { purgeUserAcrossApps, validateChildInput } from "@/lib/family";
import { requireSessionUser } from "@/lib/serverSession";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

async function ownChild(guardianId: mongoose.Types.ObjectId, id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  return getUserModel().findOne({ _id: id, parentId: guardianId, independentAt: null, withdrawnAt: null }).exec();
}

/** 이름·출생연도·동의(건강정보 · 국외 이전) 고치기. 법정대리인 동의는 처음 시각을 유지한다 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSessionUser(req);
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    await connectDB();
    const child = await ownChild(auth.user._id, id);
    if (!child) return NextResponse.json({ ok: false, error: "자녀 프로필을 찾을 수 없습니다." }, { status: 404 });

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }
    const parsed = validateChildInput({
      name: body.name ?? child.nickname ?? child.name,
      birthYear: body.birthYear ?? child.birthYear,
      consents: {
        guardian: true,
        health: typeof body.health === "boolean" ? body.health : Boolean(child.healthDataAgreedAt),
        overseas: typeof body.overseas === "boolean" ? body.overseas : Boolean(child.overseasTransferAgreedAt),
      },
    });
    if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

    const now = new Date();
    child.name = parsed.value.name;
    child.nickname = parsed.value.name;
    child.birthYear = parsed.value.birthYear;
    /* 동의는 처음 받은 시각이 기록이다 — 이미 있으면 덮어쓰지 않고, 철회하면 비운다 */
    child.healthDataAgreedAt = parsed.value.consents.health ? (child.healthDataAgreedAt ?? now) : null;
    child.overseasTransferAgreedAt = parsed.value.consents.overseas ? (child.overseasTransferAgreedAt ?? now) : null;
    await child.save();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * 자녀 프로필 삭제 — **즉시 폐기.** 탈퇴(6개월 보관)가 아니라 보호자가 관리하는 하위 데이터다.
 * 다섯 앱의 데이터를 먼저 치우고 회원 문서를 지운다. 앱 정리가 실패해도 문서는 지운다(결과를 돌려준다).
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSessionUser(req);
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    await connectDB();
    const child = await ownChild(auth.user._id, id);
    if (!child) return NextResponse.json({ ok: false, error: "자녀 프로필을 찾을 수 없습니다." }, { status: 404 });

    const purged = await purgeUserAcrossApps({ id: String(child._id), userId: child.userId });
    await getUserModel().deleteOne({ _id: child._id }).exec();
    console.log(`[family] 자녀 프로필 삭제 ${child.userId ?? String(child._id)}`, purged);
    return NextResponse.json({ ok: true, purged });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
