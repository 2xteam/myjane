import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { compareVersion } from "@/lib/igTidy";
import { signedInstallerUrl } from "@/lib/igTidyR2";
import { getIgUiBundleModel } from "@/models/IgTidy";

export const runtime = "nodejs";

/**
 * 화면 묶음 — 앱이 5분마다 묻는다(app/ui-bundle.js).
 *
 *   GET ?app=<앱 버전> → { ok, bundle: { rev, url, sha256, signature, minApp, notes } | null }
 *
 * 그 앱 버전이 쓸 수 있는(minApp ≤ app) **꺼지지 않은 가장 새 묶음**. 없으면 null — 앱은 자기 안의 화면을 쓴다.
 * 로그인 없이 연다: 묶음은 앱 코드일 뿐 비밀이 아니고, 서명이 맞아야만 앱이 쓴다.
 * 주소는 10분짜리 사전 서명 GET.
 */
export async function GET(req: Request) {
  const app = (new URL(req.url).searchParams.get("app") ?? "").trim();
  if (!/^\d+\.\d+\.\d+$/.test(app)) return NextResponse.json({ ok: false, error: "앱 버전이 필요해요." }, { status: 400 });
  try {
    await connectDB();
    const rows = await getIgUiBundleModel().find({ disabled: { $ne: true } }).sort({ rev: -1 }).limit(30).lean().exec();
    const b = rows.find((r) => compareVersion(String(r.minApp || "0.0.0"), app) <= 0);
    if (!b) return NextResponse.json({ ok: true, bundle: null });
    const url = await signedInstallerUrl(b.key, `ui-${b.rev}.json.gz`);
    return NextResponse.json({
      ok: true,
      bundle: { rev: b.rev, url, sha256: b.sha256, signature: b.signature, minApp: b.minApp, notes: b.notes ?? "" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
