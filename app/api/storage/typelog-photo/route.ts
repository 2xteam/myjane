import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * TypeLog 러닝 기록 — 결과 링크 자격증의 사진을 R2(공용 버킷 `myjane`)에 올리고 지운다.
 *
 * TypeLog 배포에는 R2 키가 없어서 **포털이 대신 올린다**(서버 ↔ 서버). 브라우저는 부르지 않는다.
 * 인증은 다섯 배포가 공유하는 `ADMIN_API_SECRET` 이다 → lib/appAdminApi.ts
 *
 *   POST   본문 = JPEG 바이트, 헤더 `x-key` = typelog/run/<응시 id>-<무작위>.jpg  → { url }
 *   DELETE 헤더 `x-key` 만                                                    → { ok }
 *
 * 키는 접두 폴더 `typelog/run/` 아래만 받는다 — 이 길로 다른 앱의 파일을 건드리지 못하게.
 * 버킷은 r2.dev 공개 주소가 켜져 있다(R2_PUBLIC_URL). 사진을 바꾸면 TypeLog 가 옛 키를 지운다.
 * → my-obsidian-vault / 40-Infra/Cloudflare R2.md · 10-Projects/TypeLog.md
 */

const KEY = /^typelog\/run\/[a-f0-9]{24}-[a-z0-9]{12,32}\.jpg$/;
const MAX = 1_500_000;

function authorized(req: Request) {
  const secret = process.env.ADMIN_API_SECRET ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (secret.length < 16 || got.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

let client: S3Client | null = null;
function r2() {
  if (client) return client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) throw new Error("R2 환경 변수가 없어요.");
  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}
const bucket = () => process.env.R2_BUCKET_NAME || "myjane";

function keyOf(req: Request) {
  const key = req.headers.get("x-key") ?? "";
  return KEY.test(key) ? key : null;
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "권한이 없어요." }, { status: 401 });
  const key = keyOf(req);
  if (!key) return NextResponse.json({ ok: false, error: "잘못된 키예요." }, { status: 400 });
  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");
  if (!publicBase) return NextResponse.json({ ok: false, error: "R2_PUBLIC_URL 이 없어요." }, { status: 500 });
  try {
    const body = Buffer.from(await req.arrayBuffer());
    if (!body.length || body.length > MAX) {
      return NextResponse.json({ ok: false, error: "사진 크기가 맞지 않아요." }, { status: 400 });
    }
    // JPEG 머리(FF D8)만 받는다
    if (body[0] !== 0xff || body[1] !== 0xd8) {
      return NextResponse.json({ ok: false, error: "JPEG 만 받아요." }, { status: 400 });
    }
    await r2().send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: body,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return NextResponse.json({ ok: true, url: `${publicBase}/${key}` });
  } catch (err) {
    console.error("typelog-photo upload", err);
    return NextResponse.json({ ok: false, error: "올리지 못했어요." }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "권한이 없어요." }, { status: 401 });
  const key = keyOf(req);
  if (!key) return NextResponse.json({ ok: false, error: "잘못된 키예요." }, { status: 400 });
  try {
    await r2().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("typelog-photo delete", err);
    return NextResponse.json({ ok: false, error: "지우지 못했어요." }, { status: 502 });
  }
}
