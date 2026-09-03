"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell, AuthTabs } from "@/components/AuthShell";
import { buildReturnUrl, type AppInfo } from "@/lib/apps";
import { saveSession, type SessionUser } from "@/lib/session";

/**
 * 이메일 + 비밀번호 인증 화면 — 2hbk처럼 `usesEmailLogin`인 앱에서만 쓴다.
 *
 * 화면 구성은 전화번호+PIN 쪽과 같은 `AuthShell`을 그대로 쓴다. 입력 항목만 다르고
 * 결(결쩜사 로그인 패턴)은 하나로 유지한다 → 20-Design/결쩜사 페이지 패턴.md
 */
export function EmailAuth({
  mode,
  app,
  next,
  qs,
}: {
  mode: "login" | "signup";
  app: AppInfo;
  next: string | null;
  qs: string;
}) {
  const returnUrl = buildReturnUrl(app, next);
  const signup = mode === "signup";

  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (signup && password !== confirm) {
      setMsg("비밀번호가 서로 달라요.");
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(signup ? "/api/auth/register-email" : "/api/auth/login-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(signup ? { email, password, nickname } : { email, password }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        user?: SessionUser;
        token?: string;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.user) {
        setMsg(json.error ?? (signup ? "가입에 실패했습니다." : "로그인에 실패했습니다."));
        return;
      }
      saveSession(json.user, json.token);
      window.location.href = returnUrl;
    } catch {
      setMsg("네트워크 오류입니다.");
    } finally {
      setBusy(false);
    }
  }

  const withQs = (path: string) => (qs ? `${path}?${qs}` : path);

  return (
    <AuthShell
      eyebrow={signup ? "START TODAY" : "WELCOME BACK"}
      headline={
        signup ? (
          <>
            첫 칸부터
            <br />
            같이 채워요
          </>
        ) : (
          <>
            다시,
            <br />
            오늘의 한 칸을
          </>
        )
      }
      storySub={
        signup ? (
          <>
            목표를 정하고 해낼 때마다
            <br />
            스티커를 한 장씩 붙여요.
          </>
        ) : (
          <>
            모아 둔 스티커판을
            <br />
            이어서 채워요.
          </>
        )
      }
      app={app}
      note={
        <>
          <strong>NOTE</strong>
          <strong>2hbk</strong>(함히보까)는 이메일과 비밀번호로 로그인해요.
          다른 myjane 앱은 전화번호와 PIN을 씁니다.
          <br />
          공용 기기에서는 사용 후 로그아웃해 주세요.
        </>
      }
    >
      <AuthTabs current={mode} qs={qs} />

      <h2 className="auth-title">{signup ? "2hbk 시작하기" : "다시 만나요"}</h2>
      <p className="auth-sub">
        {signup ? "닉네임과 이메일만 있으면 돼요" : "이메일과 비밀번호로 로그인해 주세요"}
      </p>

      <form onSubmit={submit}>
        {signup ? (
          <div className="auth-field">
            <label className="auth-label" htmlFor="nickname">
              닉네임
            </label>
            <input
              id="nickname"
              className="auth-input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              placeholder="친구가 찾을 때 보이는 이름"
            />
          </div>
        ) : null}

        <div className="auth-field">
          <label className="auth-label" htmlFor="email">
            이메일
          </label>
          <input
            id="email"
            className="auth-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="password">
            비밀번호
          </label>
          <div className="auth-input-wrap">
            <input
              id="password"
              className="auth-input"
              type={reveal ? "text" : "password"}
              autoComplete={signup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={signup ? "8자 이상" : "비밀번호를 입력해 주세요"}
              style={{ paddingRight: 52 }}
            />
            <button
              type="button"
              className="auth-reveal"
              onClick={() => setReveal((v) => !v)}
            >
              {reveal ? "숨기기" : "보기"}
            </button>
          </div>
        </div>

        {signup ? (
          <div className="auth-field">
            <label className="auth-label" htmlFor="confirm">
              비밀번호 확인
            </label>
            <input
              id="confirm"
              className="auth-input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        ) : null}

        <button type="submit" className="auth-btn" disabled={busy}>
          {busy ? "확인 중…" : signup ? "가입하고 시작하기" : "로그인"}
        </button>
      </form>

      {msg ? <p className="auth-msg">{msg}</p> : null}

      <div className="auth-links">
        <div>
          {signup ? (
            <>
              이미 계정이 있으신가요? <Link href={withQs("/login")}>로그인</Link>
            </>
          ) : (
            <>
              아직 계정이 없으신가요? <Link href={withQs("/signup")}>회원가입</Link>
            </>
          )}
        </div>
      </div>
    </AuthShell>
  );
}
