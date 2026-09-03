"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { AuthShell, AuthTabs } from "@/components/AuthShell";
import { EmailAuth } from "@/components/EmailAuth";
import { buildReturnUrl, getApp } from "@/lib/apps";
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
 */
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const app = getApp(params.get("from"));
  const returnUrl = buildReturnUrl(app, params.get("next"));

  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!loadSession()) return;

    /*
      세션이 있어도 **그대로 돌려보내면 안 되는 경우**가 있다.

      - `relogin=1` : 앱이 "이 세션으로는 안 된다"며 다시 보낸 것이다
      - 토큰을 요구하는 앱(2hbk)인데 지금 세션에 서명 토큰이 없는 경우

      그냥 돌려보내면 앱이 다시 여기로 보내고, 둘이 무한히 왕복한다.
      2026-09-03에 실제로 그랬다 → 30-Patterns/인증과 세션 공유.md
    */
    if (params.get("relogin") === "1") return;
    if (app?.usesEmailLogin && !loadSessionToken()) return;

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
        body: JSON.stringify({ phone, pin }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        user?: SessionUser;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.user) {
        setMsg(json.error ?? "로그인에 실패했습니다.");
        return;
      }
      saveSession(json.user);
      if (app) window.location.href = returnUrl;
      else router.replace("/");
    } catch {
      setMsg("네트워크 오류입니다.");
    } finally {
      setBusy(false);
    }
  }, [phone, pin, app, returnUrl, router]);

  const qs = params.toString();
  const withQs = (path: string) => (qs ? `${path}?${qs}` : path);

  // 2hbk처럼 이메일로 로그인하는 앱은 입력 항목이 달라 화면을 갈라 쓴다
  if (app?.usesEmailLogin) {
    return <EmailAuth mode="login" app={app} next={params.get("next")} qs={qs} />;
  }

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
          쌓아둔 단어장과 오답노트, 몸의 기록을
          <br />
          이어서 확인해요.
        </>
      }
      app={app}
      note={
        <>
          <strong>NOTE</strong>
          계정 하나로 공부 기록(SnapWord · SnapNote)과 건강 기록(FitLog)에
          들어가요.
          <br />
          공용 기기에서는 사용 후 로그아웃해 주세요.
        </>
      }
    >
      <AuthTabs current="login" qs={qs} />

      <h2 className="auth-title">다시 만나요</h2>
      <p className="auth-sub">전화번호와 PIN으로 로그인해 주세요</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void login();
        }}
      >
        <div className="auth-field">
          <label className="auth-label" htmlFor="phone">
            전화번호
          </label>
          <input
            id="phone"
            className="auth-input"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01012345678"
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="pin">
            PIN
          </label>
          <div className="auth-input-wrap">
            <input
              id="pin"
              className="auth-input"
              type={reveal ? "text" : "password"}
              inputMode="numeric"
              autoComplete="current-password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN을 입력해 주세요"
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
          <Link href={withQs("/forgot-pin")}>PIN을 잊으셨나요?</Link>
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
