import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * IG Tidy 설치 파일 저장소 — Cloudflare R2 **비공개** 버킷.
 *
 * 설치 파일은 허용된 회원만 받아야 한다(지인 배포 · 무분별한 확산 방지).
 * 그래서 공개 URL(`pub-….r2.dev`)을 켜지 않고, 포털 라우트가 허용 여부를 확인한 뒤
 * **10분짜리 사전 서명 주소**로 넘긴다. 100MB 안팎이라 Vercel 함수로 흘려보내지 않는다.
 * → my-obsidian-vault / 40-Infra/Cloudflare R2.md · 10-Projects/IG Tidy.md
 *
 * 버킷 이름은 환경 변수로 받되 **기본값을 두지 않는다** — 빠졌을 때 조용히 다른 앱의
 * 버킷을 가리키지 않게(AIKit 과 같은 원칙).
 */

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
  const b = process.env.IG_TIDY_R2_BUCKET;
  if (!b) throw new Error("IG_TIDY_R2_BUCKET 환경 변수가 없어요.");
  return b;
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
