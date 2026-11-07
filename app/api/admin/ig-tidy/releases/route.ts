import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { adminError, requireAdmin } from "@/lib/adminAuth";
import { compareVersion, loadSettings } from "@/lib/igTidy";
import { getIgReleaseModel, getIgSettingsModel } from "@/models/IgTidy";

export const runtime = "nodejs";

/**
 * 배포한 버전 — 새 버전을 올리면 앱이 「새 버전이 있어요」 를 띄운다.
 *
 *   GET   목록(최근부터)
 *   POST  { version, notes, key, sha256, size, url?, mandatory? }  — 등록(같은 버전이면 고침)
 *
 * 등록은 둘 중 하나로 한다.
 *   · 관리 화면(운영자·마스터 세션)
 *   · 릴리스 스크립트 — `Authorization: Bearer <IG_TIDY_RELEASE_SECRET>`
 *     (`ig-tidy/scripts/release.mjs` 가 R2 에 설치 파일을 올린 뒤 부른다)
 *
 * 릴리스 비밀은 **여섯 앱이 함께 쓰는 ADMIN_API_SECRET 과 따로** 둔다. 개발 PC 의 파일에
 * 들어가는 값이라, 새어 나가도 할 수 있는 일이 "버전 등록" 하나에 그치게.
 *
 * `mandatory: true` 면 설정의 최소 버전도 이 버전으로 올린다 — 낮은 앱은 시작 전에 업데이트를 요구받는다.
 */

function releaseSecretOk(req: Request): boolean {
  const secret = process.env.IG_TIDY_RELEASE_SECRET ?? "";
  if (secret.length < 24) return false;   // 비어 있거나 짧으면 이 길을 닫는다
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (got.length !== secret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : null);

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  try {
    await connectDB();
    const rows = await getIgReleaseModel().find().sort({ publishedAt: -1 }).limit(50).lean().exec();
    return NextResponse.json({
      ok: true,
      releases: rows.map((r) => ({
        version: r.version, notes: r.notes ?? "", url: r.url ?? "", key: r.key ?? "",
        sha256: r.sha256 ?? "", size: r.size ?? 0, mandatory: !!r.mandatory, publishedAt: iso(r.publishedAt),
      })),
    });
  } catch (err) {
    return adminError(err);
  }
}

export async function POST(req: Request) {
  if (!releaseSecretOk(req)) {
    const auth = await requireAdmin(req);
    if ("error" in auth) return auth.error;
  }

  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const version = String(b.version ?? "").trim();
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      return NextResponse.json({ ok: false, error: "버전은 1.2.3 모양으로 넣어 주세요." }, { status: 400 });
    }
    const key = String(b.key ?? "").trim();
    const url = String(b.url ?? "").trim();
    if (!key && !url) {
      return NextResponse.json({ ok: false, error: "설치 파일 위치(key 또는 url)가 필요해요." }, { status: 400 });
    }
    if (url && !url.startsWith("https://")) {
      return NextResponse.json({ ok: false, error: "설치 파일 주소는 https 여야 해요." }, { status: 400 });
    }
    const sha256 = String(b.sha256 ?? "").trim().toLowerCase();
    if (sha256 && !/^[0-9a-f]{64}$/.test(sha256)) {
      return NextResponse.json({ ok: false, error: "sha256 모양이 아니에요." }, { status: 400 });
    }
    const mandatory = b.mandatory === true;

    await connectDB();
    await getIgReleaseModel()
      .updateOne(
        { version },
        {
          $set: {
            notes: String(b.notes ?? "").slice(0, 2000), key, url, sha256,
            size: Math.max(0, Number(b.size) || 0), mandatory,
          },
          $setOnInsert: { version, publishedAt: new Date() },
        },
        { upsert: true },
      )
      .exec();

    if (mandatory) {
      const s = await loadSettings();
      if (compareVersion(s.minVersion || "0.0.0", version) < 0) {
        await getIgSettingsModel().updateOne({ _id: "main" }, { $set: { minVersion: version, updatedAt: new Date() } }).exec();
      }
    }
    return NextResponse.json({ ok: true, version });
  } catch (err) {
    return adminError(err);
  }
}
