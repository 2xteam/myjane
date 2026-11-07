import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { adminError, requireAdmin } from "@/lib/adminAuth";
import { getIgUiBundleModel } from "@/models/IgTidy";

export const runtime = "nodejs";

/**
 * 관리 화면 「배포 버전 → 화면 묶음」.
 *   GET                         최근 묶음 50개
 *   PATCH { rev, disabled }     끄기(되돌리기) · 다시 켜기 — 앱들은 5분 안에 따라간다
 * 묶음 만들기 · 올리기는 릴리스 스크립트(npm run release -- --ui "바뀐 점")가 한다(서명 키가 그 PC 에만 있다).
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  try {
    await connectDB();
    const rows = await getIgUiBundleModel().find().sort({ rev: -1 }).limit(50).lean().exec();
    return NextResponse.json({
      ok: true,
      bundles: rows.map((r) => ({
        rev: r.rev, notes: r.notes ?? "", minApp: r.minApp ?? "", size: r.size ?? 0, disabled: !!r.disabled,
        publishedAt: r.publishedAt instanceof Date ? r.publishedAt.toISOString() : null,
      })),
    });
  } catch (err) {
    return adminError(err);
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  try {
    const b = (await req.json().catch(() => ({}))) as { rev?: unknown; disabled?: unknown };
    const rev = Number(b.rev);
    if (!Number.isInteger(rev)) return NextResponse.json({ ok: false, error: "rev 가 필요해요." }, { status: 400 });
    await connectDB();
    const r = await getIgUiBundleModel().updateOne({ rev }, { $set: { disabled: b.disabled === true } }).exec();
    if (!r.matchedCount) return NextResponse.json({ ok: false, error: "그런 묶음이 없어요." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return adminError(err);
  }
}
