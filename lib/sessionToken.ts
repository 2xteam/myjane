import crypto from "node:crypto";

/**
 * 통합 세션 쿠키에 실어 보내는 **서명 토큰**. 포털이 발급하고 앱이 검증한다.
 *
 * 같은 파일이 2hbk 저장소에도 있다 — `2hbk/lib/sessionToken.ts`.
 * `SESSION_SECRET`을 두 배포가 같은 값으로 공유해야 검증이 통과한다.
 *
 * `snap_user` 쿠키는 클라이언트가 읽고 쓸 수 있는 평문 JSON이다. 그래서 그 안의
 * `id`를 그대로 믿으면 아무나 남의 계정으로 API를 부를 수 있다. SnapWord·SnapNote·
 * FitLog는 개인 기록만 다뤄 지금까지 문제가 드러나지 않았지만, 2hbk는 남의 목표에
 * 스티커를 붙이고 참가를 승인하는 동작이 있어 그대로 둘 수 없다.
 *
 * 그래서 쿠키 payload에 `token` 한 칸을 덧붙인다. 포털이 로그인 시 HMAC으로 서명하고
 * 앱이 검증한다. **다른 세 앱은 모르는 필드라 무시하므로 기존 세션과 호환된다.**
 *
 * → my-obsidian-vault / 30-Patterns/인증과 세션 공유.md 의 "남은 과제"
 */

const TTL_SEC = 30 * 24 * 60 * 60;

export type TokenClaims = {
  /** 통합 회원의 Mongo `_id` */
  uid: string;
  /** 2hbk 도메인 식별자 (`users.userId`) */
  u: string;
  /** 만료 시각 (epoch 초) */
  exp: number;
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET 환경 변수가 없거나 너무 짧습니다.");
  }
  return secret;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

function hmac(body: string): string {
  return b64url(crypto.createHmac("sha256", getSecret()).update(body).digest());
}

export function signSessionToken(uid: string, userId: string): string {
  const claims: TokenClaims = {
    uid,
    u: userId,
    exp: Math.floor(Date.now() / 1000) + TTL_SEC,
  };
  const body = b64url(Buffer.from(JSON.stringify(claims), "utf8"));
  return `${body}.${hmac(body)}`;
}

export function verifySessionToken(token: string | undefined | null): TokenClaims | null {
  if (!token || typeof token !== "string") return null;

  const dot = token.indexOf(".");
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  // 길이가 다르면 timingSafeEqual이 예외를 던지므로 먼저 거른다
  const expected = hmac(body);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenClaims;
    if (typeof claims.uid !== "string" || typeof claims.u !== "string") return null;
    if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}
