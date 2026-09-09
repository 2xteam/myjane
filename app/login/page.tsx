"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { AuthShell, AuthTabs } from "@/components/AuthShell";
import { ProfilePicker, type Profile } from "@/components/ProfilePicker";
import { buildReturnUrl, getApp } from "@/lib/apps";
import { IDENTIFIER_HINT } from "@/lib/identifier";
import {
  loadSession,
  hasUsableSession,
  saveSession,
  type SessionUser,
} from "@/lib/session";

/**
 * 통합 로그인.
 *
 * `?from=snapword&next=/home` 으로 호출된다.
 * 인증 후 `.myjane.co.kr` 쿠키를 저장하고 원래 앱으로 돌려보낸다.
 *
 * 2026-09-09 부터 **이메일+비밀번호만** 받는다. 전화번호+PIN 계정은 /migrate 에서 전환한다.
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
  /* 자녀가 있는 계정 — 로그인 뒤 어느 프로필로 들어갈지 고른다 */
  const [pick, setPick] = useState<{ token: string; profiles: Profile[] } | null>(null);

  /* 앱에서 오지 않았을 때 돌아갈 곳 — 포털 안 경로만 허용한다 (오픈 리다이렉트 방지) */
  const rawNext = params.get("next");
  const localNext = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

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
    if (app?.requiresSessionToken && !hasUsableSession()) return;

    if (app) window.location.href = returnUrl;
    else router.replace(localNext);
  }, [app, returnUrl, router, params, localNext]);

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
        choose?: boolean;
        pickToken?: string;
        profiles?: Profile[];
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setMsg(json.error ?? "로그인에 실패했습니다.");
        return;
      }
      if (json.choose && json.pickToken && json.profiles) {
        setPick({ token: json.pickToken, profiles: json.profiles });
        return;
      }
      if (!json.user) {
        setMsg("로그인에 실패했습니다.");
        return;
      }
      saveSession(json.user);
      if (app) window.location.href = returnUrl;
      else router.replace(localNext);
    } catch {
      setMsg("네트워크 오류입니다.");
    } finally {
      setBusy(false);
    }
  }, [identifier, secret, app, returnUrl, router, localNext]);

  const pickProfile = useCallback(
    async (profile: Profile) => {
      if (!pick) return;
      setBusy(true);
      setMsg(null);
      try {
        const res = await fetch("/api/auth/pick-profile", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pickToken: pick.token, profileId: profile.id }),
        });
        const json = (await res.json()) as { ok: boolean; user?: SessionUser; error?: string };
        if (!res.ok || !json.ok || !json.user) {
          setMsg(json.error ?? "프로필을 고르지 못했어요.");
          if (res.status === 401) setPick(null);
          return;
        }
        saveSession(json.user);
        if (app) window.location.href = returnUrl;
        else router.replace(localNext);
      } catch {
        setMsg("네트워크 오류입니다.");
      } finally {
        setBusy(false);
      }
    },
    [pick, app, returnUrl, router, localNext],
  );

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

      {pick ? (
        <>
          <h2 className="auth-title">누구로 들어갈까요?</h2>
          <p className="auth-sub">보호자 본인 또는 자녀 프로필을 골라 주세요. 나중에 프로필 전환에서 바꿀 수 있어요.</p>
          <ProfilePicker profiles={pick.profiles} busy={busy} onPick={(p) => void pickProfile(p)} />
          {msg ? <p className="auth-msg">{msg}</p> : null}
        </>
      ) : null}

      <div hidden={Boolean(pick)}>
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
            이메일
          </label>
          <input
            id="identifier"
            className="auth-input"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            type="email"
            placeholder="name@example.com"
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="secret">
            비밀번호
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

      {msg && !pick ? <p className="auth-msg">{msg}</p> : null}

      <div className="auth-links">
        <div>
          아직 계정이 없으신가요? <Link href={withQs("/signup")}>회원가입</Link>
        </div>
        <div>
          <Link href={withQs("/forgot-pin")}>비밀번호를 잊으셨나요?</Link>
        </div>
        <div>
          전화번호·PIN으로 쓰셨나요?{" "}
          <Link href={withQs("/migrate")}>이메일 계정으로 전환</Link>
        </div>
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
