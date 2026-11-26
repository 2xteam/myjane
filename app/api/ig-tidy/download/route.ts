import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { igError, requireIgTidyUser } from "@/lib/igTidy";
import { igTidyReleaseKey, installerMetadata, signedInstallerUrl } from "@/lib/igTidyR2";
import { getIgReleaseModel } from "@/models/IgTidy";

export const runtime = "nodejs";

function requestedPlatform(req: Request): "win" | "mac" {
  const explicit = new URL(req.url).searchParams.get("platform");
  if (explicit === "mac" || explicit === "win") return explicit;
  return /Macintosh|Mac OS X/i.test(req.headers.get("user-agent") ?? "") ? "mac" : "win";
}

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
  const platform = requestedPlatform(req);
  const version = url.searchParams.get("version");
  await connectDB();
  const Releases = getIgReleaseModel();
  let r = version
    ? await Releases.findOne({ version }).lean().exec()
    : await Releases.findOne().sort({ publishedAt: -1 }).lean().exec();
  if (platform === "mac" && r && !r.macKey) {
    const key = igTidyReleaseKey(r.version, "mac");
    if (await installerMetadata(key)) r = { ...r, macKey: key };
  }
  if (platform === "mac" && !version && (!r || !r.macKey)) {
    const candidates = await Releases.find().sort({ publishedAt: -1 }).limit(50).lean().exec();
    for (const candidate of candidates) {
      const key = igTidyReleaseKey(candidate.version, "mac");
      if (await installerMetadata(key)) {
        r = { ...candidate, macKey: key };
        break;
      }
    }
  }
  if (!r) return igError("bad_request", "아직 올라온 설치 파일이 없어요.", 404);

  const mac = platform === "mac";
  const fileName = mac ? `IG-Tidy-${r.version}.dmg` : `IG-Tidy-Setup-${r.version}.exe`;
  const key = mac ? (r.macKey ?? "") : (r.key ?? "");
  const sha256 = mac ? (r.macSha256 ?? "") : (r.sha256 ?? "");
  const size = mac ? (r.macSize ?? 0) : (r.size ?? 0);
  let href = mac ? "" : (r.url ?? "");
  if (!href) {
    if (!key) return igError("bad_request", "이 운영체제의 설치 파일이 아직 없어요.", 404);
    try {
      href = await signedInstallerUrl(key, fileName);
    } catch (err) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      return NextResponse.json({ ok: false, error: `설치 파일 주소를 만들지 못했어요: ${message}` }, { status: 500 });
    }
  }

  if (url.searchParams.get("json")) {
    const updateKey = mac ? (r.macUpdateKey ?? "") : "";
    const updateFileName = mac ? (r.macUpdateFileName || `IG-Tidy-${r.version}.zip`) : "";
    let updateUrl = "";
    if (updateKey) updateUrl = await signedInstallerUrl(updateKey, updateFileName);
    return NextResponse.json({
      ok: true, version: r.version, url: href, sha256, size, fileName,
      updateUrl, updateSha256: mac ? (r.macUpdateSha256 ?? "") : "", updateFileName,
    });
  }
  return NextResponse.redirect(href, 302);
}
