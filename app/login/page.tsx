"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { AuthShell, AuthTabs } from "@/components/AuthShell";
import { buildReturnUrl, getApp } from "@/lib/apps";
import { IDENTIFIER_HINT } from "@/lib/identifier";
import {
  loadSession,
  loadSessionToken,
  saveSession,
  type SessionUser,
} from "@/lib/session";

/**
 * 통합 로그인.
 *
 * `?from=snapword&next=/home` 으로 호출된다.
 * 인증 후 `.myjane.co.kr` 쿠키를 저장하고 원래 앱으로 돌려보낸다.
 *
 * 입력칸은 **하나**다 — 이메일이든 전화번호든, 비밀번호든 PIN이든 받는다.
 * 앱마다 로그인 수단이 달라 화면을 갈라 뒀는데, 사람에게 "당신은 어느 쪽
 * 회원이냐"를 묻는 셈이라 합쳤다 → lib/identifier.ts
 */
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const app = getApp(params.get("from"));
  const returnUrl = buildReturnUrl(app, params.get("next"));

  const [identifier, setIdentifier] = useState("");
  const [secret, setSecret] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!loadSession()) return;

    /*
      세션이 있어도 **그대로 돌려보내면 안 되는 경우**가 있다.

      - `relogin=1` : 앱이 "이 세션으로는 안 된다"며 다시 보낸 것이다
      - 서명 토큰이 필요한 앱(2hbk)인데 지금 세션에 토큰이 없는 경우

      그냥 돌려보내면 앱이 다시 여기로 보내고, 둘이 무한히 왕복한다.
      2026-09-03에 실제로 그랬다 → 30-Patterns/인증과 세션 공유.md
    */
    if (params.get("relogin") === "1") return;
    if (app?.requiresSessionToken && !loadSessionToken()) return;

    if (app) window.location.href = returnUrl;
    else router.replace("/");
  }, [app, returnUrl, router, params]);

  const login = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier, secret }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        user?: SessionUser;
        token?: string;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.user) {
        setMsg(json.error ?? "로그인에 실패했습니다.");
        return;
      }
      // 토큰을 함께 저장해야 2hbk 같은 앱이 이 세션을 쓸 수 있다
      saveSession(json.user, json.token);
      if (app) window.location.href = returnUrl;
      else router.replace("/");
    } catch {
      setMsg("네트워크 오류입니다.");
    } finally {
      setBusy(false);
    }
  }, [identifier, secret, app, returnUrl, router]);

  const qs = params.toString();
  const withQs = (path: string) => (qs ? `${path}?${qs}` : path);

  return (
    <AuthShell
      eyebrow="RETURN TO YOUR RECORD"
      headline={
        <>
          다시,
          <br />
          기록을 이어가요
        </>
      }
      storySub={
        <>
          쌓아둔 기록을 같은 계정으로
          <br />
          이어서 확인해요.
        </>
      }
      app={app}
      note={
        <>
          <strong>NOTE</strong>
          계정 하나로 공부 기록과 건강 기록, 습관 기록에 들어가요.
          <br />
          공용 기기에서는 사용 후 로그아웃해 주세요.
        </>
      }
    >
      <AuthTabs current="login" qs={qs} />

      <h2 className="auth-title">다시 만나요</h2>
      <p className="auth-sub">{IDENTIFIER_HINT}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void login();
        }}
      >
        <div className="auth-field">
          <label className="auth-label" htmlFor="identifier">
            이메일 또는 전화번호
          </label>
          <input
            id="identifier"
            className="auth-input"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="name@example.com 또는 01012345678"
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="secret">
            비밀번호 또는 PIN
          </label>
          <div className="auth-input-wrap">
            <input
              id="secret"
              className="auth-input"
              type={reveal ? "text" : "password"}
              autoComplete="current-password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="가입할 때 정한 값"
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

        <button type="submit" className="auth-btn" disabled={busy}>
          {busy ? "확인 중…" : "로그인"}
        </button>
      </form>

      {msg ? <p className="auth-msg">{msg}</p> : null}

      <div className="auth-links">
        <div>
          아직 계정이 없으신가요? <Link href={withQs("/signup")}>회원가입</Link>
        </div>
        <div>
          <Link href={withQs("/forgot-pin")}>비밀번호를 잊으셨나요?</Link>
        </div>
        <div>
          <Link href={withQs("/find-phone")}>전화번호 찾기</Link>
        </div>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
