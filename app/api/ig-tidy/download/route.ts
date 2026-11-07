import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { igError, requireIgTidyUser } from "@/lib/igTidy";
import { signedInstallerUrl } from "@/lib/igTidyR2";
import { getIgReleaseModel } from "@/models/IgTidy";

export const runtime = "nodejs";

/**
 * 설치 파일 받기 — **허용된 회원만.**
 *
 *   GET /api/ig-tidy/download                 → 가장 최근 버전으로 302 (브라우저의 「내려받기」 버튼)
 *   GET /api/ig-tidy/download?json=1          → { version, url, sha256, size } (앱의 「업데이트」)
 *   GET /api/ig-tidy/download?version=1.2.0   → 그 버전
 *
 * 주소는 10분짜리다. 앱은 받은 뒤 sha256 을 맞춰 보고, 다르면 설치하지 않는다.
 */
export async function GET(req: Request) {
  const auth = await requireIgTidyUser(req);
  if ("error" in auth) {
    // 브라우저에서 눌렀으면 안내 화면으로 보낸다(JSON 을 보여 주지 않는다)
    const url = new URL(req.url);
    if (!url.searchParams.get("json")) return NextResponse.redirect(new URL("/ig-tidy", req.url), 302);
    return auth.error;
  }

  const url = new URL(req.url);
  const version = url.searchParams.get("version");
  await connectDB();
  const Releases = getIgReleaseModel();
  const r = version
    ? await Releases.findOne({ version }).lean().exec()
    : await Releases.findOne().sort({ publishedAt: -1 }).lean().exec();
  if (!r) return igError("bad_request", "아직 올라온 설치 파일이 없어요.", 404);

  const fileName = `IG-Tidy-Setup-${r.version}.exe`;
  let href = r.url ?? "";
  if (!href) {
    if (!r.key) return igError("bad_request", "설치 파일 위치가 비어 있어요. 관리자에게 알려 주세요.", 500);
    try {
      href = await signedInstallerUrl(r.key, fileName);
    } catch (err) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      return NextResponse.json({ ok: false, error: `설치 파일 주소를 만들지 못했어요: ${message}` }, { status: 500 });
    }
  }

  if (url.searchParams.get("json")) {
    return NextResponse.json({ ok: true, version: r.version, url: href, sha256: r.sha256 ?? "", size: r.size ?? 0, fileName });
  }
  return NextResponse.redirect(href, 302);
}
