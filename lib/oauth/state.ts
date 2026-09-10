import crypto from "node:crypto";
import type { NextResponse } from "next/server";
import { cookieDomainFor, readCookieValues } from "@/lib/sessionCookie";

/**
 * OAuth 진행 중 상태 — **10분짜리 서명 쿠키** 둘.
 *
 *   oauth_state    start 에서 만들어 callback 에서 대조한다. CSRF 방지(state) + 돌아갈 곳(from·next) + 구글 nonce
 *   oauth_signup   callback 이 "처음 온 사람" 을 만나면 공급자 프로필을 담아 동의 화면(/signup/social)으로 넘긴다
 *
 * 둘 다 HttpOnly 이고 SESSION_SECRET 으로 서명한다 — 쿠키는 클라이언트가 고칠 수 있으니 서명 없는 값은 믿지 않는다.
 * → my-obsidian-vault / 50-Plans/G 소셜 로그인.md
 */

export const OAUTH_STATE_COOKIE = "oauth_state";
export const OAUTH_SIGNUP_COOKIE = "oauth_signup";
const TTL_SEC = 10 * 60;

export type OAuthState = {
  state: string;
  nonce: string;
  provider: "google" | "kakao" | "naver";
  from: string | null;
  next: string | null;
  /** 로그인한 상태에서 "연결" 로 들어온 경우 — 그 회원 _id */
  linkTo: string | null;
};

export type OAuthProfile = {
  provider: "google" | "kakao" | "naver";
  providerId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET 환경 변수가 없거나 너무 짧습니다.");
  return s;
}
const b64 = (b: Buffer) => b.toString("base64url");
const hmac = (tag: string, body: string) => b64(crypto.createHmac("sha256", secret()).update(`${tag}:${body}`).digest());

export function sign(tag: string, payload: unknown): string {
  const body = b64(Buffer.from(JSON.stringify({ p: payload, exp: Math.floor(Date.now() / 1000) + TTL_SEC }), "utf8"));
  return `${body}.${hmac(tag, body)}`;
}

export function verify<T>(tag: string, token: string | null | undefined): T | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(tag, body);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { p: T; exp: number };
    if (typeof parsed.exp !== "number" || parsed.exp * 1000 < Date.now()) return null;
    return parsed.p;
  } catch {
    return null;
  }
}

export const randomToken = () => b64(crypto.randomBytes(24));

function isSecure(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  const host = (req.headers.get("host") ?? "").toLowerCase();
  return !(host.startsWith("localhost") || host.startsWith("127.0.0.1"));
}

/** 진행 쿠키는 포털 host 에만 둔다(Domain 없음) — 앱들이 볼 일이 없다 */
export function setCookieHeader(req: Request, name: string, value: string, maxAge = TTL_SEC): string {
  void cookieDomainFor;
  let c = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax; HttpOnly`;
  if (isSecure(req)) c += "; Secure";
  return c;
}

export function clearCookieHeader(req: Request, name: string): string {
  return setCookieHeader(req, name, "", 0);
}

export function readCookie(req: Request, name: string): string | null {
  return readCookieValues(req, name)[0] ?? null;
}

export function append<T extends NextResponse>(res: T, headers: string[]): T {
  for (const h of headers) res.headers.append("set-cookie", h);
  return res;
}

/** 포털의 절대 주소 — 리다이렉트 URI 를 만들 때. 운영은 환경 변수, 로컬은 요청 host */
export function portalOrigin(req: Request): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim();
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return `http://${host}`;
  return env || `https://${host}`;
}
