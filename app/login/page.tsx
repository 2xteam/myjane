"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { AuthShell, AuthTabs } from "@/components/AuthShell";
import { buildReturnUrl, getApp } from "@/lib/apps";
import { loadSession, saveSession, type SessionUser } from "@/lib/session";

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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 이미 로그인돼 있으면 곧바로 돌려보낸다
  useEffect(() => {
    if (!loadSession()) return;
    if (app) window.location.href = returnUrl;
    else router.replace("/");
  }, [app, returnUrl, router]);

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

  return (
    <AuthShell
      eyebrow="WELCOME BACK"
      headline={
        <>
          다시,
          <br />
          <span>기록을 이어가요</span>
        </>
      }
      sub={
        <>
          하나의 계정으로 SnapWord · SnapNote · FitLog를
          <br />
          모두 사용해요.
        </>
      }
      app={app}
      note={
        <>
          <strong>NOTE</strong>
          로그인하면 세 서비스에 모두 접속돼요. 공용 기기에서는 사용 후 로그아웃해 주세요.
        </>
      }
    >
      <AuthTabs current="login" qs={qs} />

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
          <input
            id="pin"
            className="auth-input"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="4자리 이상"
          />
        </div>

        <button type="submit" className="auth-btn" disabled={busy}>
          {busy ? "확인 중…" : "로그인"}
        </button>
      </form>

      {msg ? <p className="auth-msg">{msg}</p> : null}

      <div className="auth-links">
        <Link href={withQs("/find-phone")}>전화번호 찾기</Link>
        <span>·</span>
        <Link href={withQs("/forgot-pin")}>PIN 찾기</Link>
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
