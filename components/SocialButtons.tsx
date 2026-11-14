"use client";

import { useEffect, useState } from "react";

/**
 * 구글 · 카카오 · 네이버 버튼 — 로그인 화면과 회원가입 화면이 함께 쓴다(2026-11-14 회원가입에도 붙였다).
 *
 * 소셜은 처음이면 콜백에서 이름 · 동의만 확인하고 바로 가입된다 → 버튼은 같고 시작 주소도 같다.
 * 환경 변수가 있는 공급자만 그린다(`/api/auth/oauth/providers`).
 * 각 버튼의 색 · 로고 · 문구는 공급자 브랜드 규정이다 — 바꾸지 않는다.
 * → my-obsidian-vault / 30-Patterns/인증과 세션 공유.md
 */
export function SocialButtons({
  from,
  next,
  disabled = false,
  divider = "또는 이메일로",
}: {
  from: string | null;
  next: string | null;
  disabled?: boolean;
  divider?: string;
}) {
  const [social, setSocial] = useState<{ google: boolean; kakao: boolean; naver: boolean } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/auth/oauth/providers");
        const json = (await res.json()) as { ok: boolean; google?: boolean; kakao?: boolean; naver?: boolean };
        setSocial({ google: Boolean(json.ok && json.google), kakao: Boolean(json.ok && json.kakao), naver: Boolean(json.ok && json.naver) });
      } catch {
        setSocial({ google: false, kakao: false, naver: false });
      }
    })();
  }, []);

  const start = (provider: "google" | "kakao" | "naver") => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (next) q.set("next", next);
    window.location.href = `/api/auth/oauth/${provider}/start${q.toString() ? `?${q.toString()}` : ""}`;
  };

  if (!social?.google && !social?.kakao && !social?.naver) return null;

  const base: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    padding: "12px 16px",
    borderRadius: 12,
    font: "inherit",
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <div style={{ display: "grid", gap: 10, margin: "14px 0 18px" }}>
      {social.google ? (
        /* 구글 브랜드 규정 — 흰 바탕 · 회색 테두리 · G 로고 · "Google 계정으로 로그인". 로고를 바꾸지 않는다 */
        <button
          type="button"
          onClick={() => start("google")}
          disabled={disabled}
          style={{ ...base, border: "1px solid #dadce0", background: "#fff", color: "#1f1f1f" }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6C12.3 13.3 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-2.8-.4-4H24v7.6h12.9c-.3 2.1-1.7 5.3-4.9 7.4l7.5 5.8c4.5-4.1 7-10.2 7-16.8z" />
            <path fill="#FBBC05" d="M10.4 28.8A14.5 14.5 0 0 1 9.5 24c0-1.7.3-3.3.8-4.8l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.8-6z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2 1.4-4.7 2.4-8.4 2.4-6.3 0-11.7-3.8-13.6-9.2l-7.8 6C6.5 42.6 14.6 48 24 48z" />
          </svg>
          Google 계정으로 로그인
        </button>
      ) : null}
      {social.kakao ? (
        /* 카카오 브랜드 규정 — 배경 #FEE500 · 글자 검정 85% · 말풍선 심볼 · 문구 "카카오 로그인". 색과 문구를 바꾸지 않는다 */
        <button
          type="button"
          onClick={() => start("kakao")}
          disabled={disabled}
          style={{ ...base, border: "none", background: "#FEE500", color: "rgba(0,0,0,.85)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#000000" fillOpacity=".85" d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.86 5.31 4.66 6.72-.16.6-.6 2.2-.69 2.55-.11.43.16.42.33.31.14-.1 2.2-1.5 3.1-2.11.84.12 1.71.19 2.6.19 5.52 0 10-3.58 10-8s-4.48-8-10-8z" />
          </svg>
          카카오 로그인
        </button>
      ) : null}
      {social.naver ? (
        /* 네이버 브랜드 규정 — 배경 #03C75A · 흰 글자 · N 로고 · 문구 "네이버 로그인" */
        <button
          type="button"
          onClick={() => start("naver")}
          disabled={disabled}
          style={{ ...base, border: "none", background: "#03C75A", color: "#fff" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#fff" d="M16.3 3v9.6L7.9 3H3v18h4.7v-9.6l8.4 9.6H21V3z" />
          </svg>
          네이버 로그인
        </button>
      ) : null}
      <p className="auth-hint" style={{ margin: 0, textAlign: "center" }}>
        처음이면 이름과 동의만 확인하고 바로 가입돼요. 비밀번호는 만들지 않아요.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-dim)", fontSize: "0.8rem" }}>
        <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
        {divider}
        <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>
    </div>
  );
}
