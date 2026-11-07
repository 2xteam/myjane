import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * IG Tidy 설치 파일 저장소 — Cloudflare R2 **비공개** 버킷.
 *
 * 설치 파일은 허용된 회원만 받아야 한다(지인 배포 · 무분별한 확산 방지).
 * 그래서 공개 URL(`pub-….r2.dev`)을 켜지 않고, 포털 라우트가 허용 여부를 확인한 뒤
 * **10분짜리 사전 서명 주소**로 넘긴다. 100MB 안팎이라 Vercel 함수로 흘려보내지 않는다.
 * → my-obsidian-vault / 40-Infra/Cloudflare R2.md · 10-Projects/IG Tidy.md
 *
 * 버킷은 myjane **공용 버킷 `myjane`**(2026-11-07 결정) — 앱마다 접두 폴더로 나눈다.
 * IG Tidy 설치 파일은 `ig-tidy/releases/IG-Tidy-Setup-<버전>.exe`.
 * 공용 버킷이라도 **공개 URL(r2.dev · 커스텀 도메인)을 켜지 않는다** — 켜면 설치 파일이 허용 확인 없이 열린다.
 * `IG_TIDY_R2_BUCKET` 으로 따로 둘 수도 있다(없으면 `myjane`).
 */
export const IG_TIDY_RELEASE_PREFIX = "ig-tidy/releases/";
export const igTidyReleaseKey = (version: string) => `${IG_TIDY_RELEASE_PREFIX}IG-Tidy-Setup-${version}.exe`;

let client: S3Client | null = null;

function r2(): S3Client {
  if (client) return client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 환경 변수(R2_ACCOUNT_ID · R2_ACCESS_KEY_ID · R2_SECRET_ACCESS_KEY)가 없어요.");
  }
  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    // 사전 서명에 빈 본문 체크섬이 박히지 않게 → 30-Patterns/이미지 업로드 패턴.md
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

export function igTidyBucket(): string {
  return process.env.IG_TIDY_R2_BUCKET || process.env.R2_BUCKET_NAME || "myjane";
}

/**
 * 설치 파일을 **브라우저에서 바로** 올리는 주소(30분). 관리 화면 「배포 버전」 이 쓴다.
 * 100MB 안팎이라 포털(Vercel 함수, 본문 4.5MB 제한)을 거치지 않고 R2 로 곧장 PUT 한다.
 * ⚠️ 버킷에 CORS(PUT · 포털 오리진)가 있어야 한다 → 40-Infra/Cloudflare R2.md
 */
export async function signedInstallerUploadUrl(key: string): Promise<string> {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({ Bucket: igTidyBucket(), Key: key, ContentType: "application/octet-stream" }),
    { expiresIn: 1800 },
  );
}

/** 설치 파일을 10분 동안 받을 수 있는 주소 */
export async function signedInstallerUrl(key: string, fileName: string): Promise<string> {
  return getSignedUrl(
    r2(),
    new GetObjectCommand({
      Bucket: igTidyBucket(),
      Key: key,
      ResponseContentDisposition: `attachment; filename="${fileName.replace(/"/g, "")}"`,
    }),
    { expiresIn: 600 },
  );
}
