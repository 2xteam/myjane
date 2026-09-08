import crypto from "node:crypto";

/**
 * 계정 찾기 결과를 보여 주기 위한 **짧은 서명 토큰.**
 *
 * ## 왜 이렇게 하나
 *
 * 예전 "아이디 찾기" 는 **전화번호를 메일 본문에 그대로 적어** 보냈다.
 * 메일은 받은 편지함에 오래 남고, 전달되고, 기기가 바뀌어도 따라간다.
 * 링크로 바꾸면 그 순간에만 보여 주고 30분 뒤에는 아무 의미가 없다.
 *
 * ## 왜 DB 필드를 안 쓰나
 *
 * 읽기만 하는 짧은 조회라 `SESSION_SECRET` 으로 서명한 **자기완결 토큰**이면
 * 충분하다. 세션 토큰(`lib/sessionToken.ts`)과 같은 방식이다.
 *
 * ⚠️ **한 번 쓰면 폐기되지는 않는다.** 저장하지 않으니 거둬들일 수도 없다.
 * 30분 안에 같은 링크를 여러 번 열 수 있다. 비밀번호 재설정처럼 상태를 바꾸는
 * 일이라면 이 방식을 쓰면 안 된다 — 그쪽은 DB 토큰을 쓴다(`pinResetToken`).
 *
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */

const TTL_SEC = 30 * 60;

type LookupClaims = {
  /** 회원 Mongo `_id` */
  uid: string;
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
  return b64url(crypto.createHmac("sha256", getSecret()).update(`lookup.${body}`).digest());
}

export function signLookupToken(uid: string): string {
  const claims: LookupClaims = { uid, exp: Math.floor(Date.now() / 1000) + TTL_SEC };
  const body = b64url(Buffer.from(JSON.stringify(claims), "utf8"));
  return `${body}.${hmac(body)}`;
}

export function verifyLookupToken(token: string | undefined | null): LookupClaims | null {
  if (!token || typeof token !== "string") return null;

  const dot = token.indexOf(".");
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  /* 길이가 다르면 timingSafeEqual 이 예외를 던지므로 먼저 거른다 */
  const expected = hmac(body);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as LookupClaims;
    if (typeof claims.uid !== "string") return null;
    if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}
