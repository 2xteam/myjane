import { NextResponse } from "next/server";
import { adminError, requireAdmin } from "@/lib/adminAuth";
import { signedInstallerUploadUrl } from "@/lib/igTidyR2";

export const runtime = "nodejs";

/**
 * 설치 파일 올리기 주소 — 관리 화면 「배포 버전 → 새 버전 올리기」 가 부른다.
 *
 * 본문: `{ version }` → `{ url, key }`
 * 브라우저가 이 주소로 파일을 곧장 PUT 한 뒤, 이어서 POST /api/admin/ig-tidy/releases 로
 * 버전 · 바뀐 점 · sha256 · 크기를 등록한다. 등록하는 순간 앱들이 「새 버전」 을 알아챈다.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  try {
    const b = (await req.json().catch(() => ({}))) as { version?: unknown };
    const version = String(b.version ?? "").trim();
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      return NextResponse.json({ ok: false, error: "버전은 1.2.3 모양으로 넣어 주세요." }, { status: 400 });
    }
    const key = `releases/IG-Tidy-Setup-${version}.exe`;
    return NextResponse.json({ ok: true, key, url: await signedInstallerUploadUrl(key) });
  } catch (err) {
    return adminError(err);
  }
}
