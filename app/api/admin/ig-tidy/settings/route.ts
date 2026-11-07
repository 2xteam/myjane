import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { adminError, requireAdmin } from "@/lib/adminAuth";
import { loadSettings, publicSettings } from "@/lib/igTidy";
import { getIgSettingsModel } from "@/models/IgTidy";

export const runtime = "nodejs";

const CAP_KEYS = ["follow", "unfollow", "like", "feed", "story", "comment", "dm"];

/** 운영 설정 — 앱에 내려 주는 값. 바꾸면 실행 중인 앱도 다음 연장(1분 안)에 새 값을 받는다 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  try {
    await connectDB();
    return NextResponse.json({ ok: true, settings: publicSettings(await loadSettings()) });
  } catch (err) {
    return adminError(err);
  }
}

export async function PUT(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const set: Record<string, unknown> = { updatedAt: new Date(), updatedBy: auth.admin.doc._id };

    if (typeof body.enabled === "boolean") set.enabled = body.enabled;
    if (typeof body.disabledMessage === "string") set.disabledMessage = body.disabledMessage.slice(0, 200);
    if (typeof body.minVersion === "string") {
      if (!/^\d+\.\d+\.\d+$/.test(body.minVersion)) {
        return NextResponse.json({ ok: false, error: "최소 버전은 1.2.3 모양으로 넣어 주세요." }, { status: 400 });
      }
      set.minVersion = body.minVersion;
    }
    if (body.minDelaySec !== undefined) set.minDelaySec = Math.max(0, Math.min(120, Number(body.minDelaySec) || 0));
    if (typeof body.aiEnabled === "boolean") set.aiEnabled = body.aiEnabled;
    const n = (v: unknown, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));
    if (body.aiFreePhotoDaily !== undefined) set.aiFreePhotoDaily = n(body.aiFreePhotoDaily, 0, 5000);
    if (body.aiApprovedPhotoDaily !== undefined) set.aiApprovedPhotoDaily = n(body.aiApprovedPhotoDaily, 0, 5000);
    if (body.aiPhotoWeight !== undefined) set.aiPhotoWeight = n(body.aiPhotoWeight, 1, 20);
    // 공지(notice · noticeAt)는 여기서 받지 않는다 — 공지 게시판으로 옮겼다(2026-11-08) → /api/admin/ig-tidy/notices
    // 저장된 값은 지우지 않는다. 예전 앱이 읽는 두 칸은 /api/ig-tidy/me 가 게시판에서 채운다.
    if (body.dailyCaps && typeof body.dailyCaps === "object") {
      const caps: Record<string, number> = {};
      for (const k of CAP_KEYS) {
        const v = Number((body.dailyCaps as Record<string, unknown>)[k]);
        caps[k] = Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
      }
      set.dailyCaps = caps;
    }

    await connectDB();
    await loadSettings();
    await getIgSettingsModel().updateOne({ _id: "main" }, { $set: set }).exec();
    return NextResponse.json({ ok: true, settings: publicSettings(await loadSettings()) });
  } catch (err) {
    return adminError(err);
  }
}
