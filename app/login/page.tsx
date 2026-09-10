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
  /* 소셜 로그인 — 환경 변수가 있는 공급자만 버튼을 그린다 */
  const [social, setSocial] = useState<{ google: boolean } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/auth/oauth/providers");
        const json = (await res.json()) as { ok: boolean; google?: boolean };
        setSocial({ google: Boolean(json.ok && json.google) });
      } catch {
        setSocial({ google: false });
      }
    })();
  }, []);

  /*
    소셜 콜백은 302 로 돌아온다 — 자녀가 있는 계정이면 `?pick=<토큰>` 으로, 실패면 `?oauth_error=<코드>` 로.
    → app/api/auth/oauth/google/callback/route.ts
  */
  useEffect(() => {
    const err = params.get("oauth_error");
    if (err) {
      const text: Record<string, string> = {
        denied: "구글 로그인을 취소했어요.",
        state_missing: "로그인 과정이 만료됐어요. 다시 시도해 주세요.",
        state_mismatch: "로그인 과정이 일치하지 않아요. 다시 시도해 주세요.",
        exchange_failed: "구글에서 계정 정보를 받지 못했어요. 잠시 후 다시 시도해 주세요.",
        already_linked: "그 구글 계정은 이미 다른 회원에 연결되어 있어요.",
        not_configured: "구글 로그인이 아직 준비되지 않았어요.",
      };
      setMsg(text[err] ?? "소셜 로그인에 실패했어요. 다시 시도해 주세요.");
    }
    const pickToken = params.get("pick");
    if (pickToken) {
      void (async () => {
        const res = await fetch(`/api/auth/pick-profile?pickToken=${encodeURIComponent(pickToken)}`);
        const json = (await res.json()) as { ok: boolean; profiles?: Profile[]; error?: string };
        if (res.ok && json.ok && json.profiles) setPick({ token: pickToken, profiles: json.profiles });
        else setMsg(json.error ?? "선택 시간이 지났어요. 다시 로그인해 주세요.");
      })();
    }
  }, [params]);

  const socialStart = (provider: "google") => {
    const q = new URLSearchParams();
    const from = params.get("from");
    const next = params.get("next");
    if (from) q.set("from", from);
    if (next) q.set("next", next);
    window.location.href = `/api/auth/oauth/${provider}/start${q.toString() ? `?${q.toString()}` : ""}`;
  };

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

      {social?.google ? (
        <div style={{ display: "grid", gap: 10, margin: "14px 0 18px" }}>
          {/* 구글 브랜드 규정 — 흰 바탕 · 회색 테두리 · G 로고 · "Google 계정으로 로그인". 로고를 바꾸지 않는다 */}
          <button
            type="button"
            onClick={() => socialStart("google")}
            disabled={busy}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              width: "100%",
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #dadce0",
              background: "#fff",
              color: "#1f1f1f",
              font: "inherit",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6C12.3 13.3 17.7 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-2.8-.4-4H24v7.6h12.9c-.3 2.1-1.7 5.3-4.9 7.4l7.5 5.8c4.5-4.1 7-10.2 7-16.8z" />
              <path fill="#FBBC05" d="M10.4 28.8A14.5 14.5 0 0 1 9.5 24c0-1.7.3-3.3.8-4.8l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.8-6z" />
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2 1.4-4.7 2.4-8.4 2.4-6.3 0-11.7-3.8-13.6-9.2l-7.8 6C6.5 42.6 14.6 48 24 48z" />
            </svg>
            Google 계정으로 로그인
          </button>
          <p className="auth-hint" style={{ margin: 0, textAlign: "center" }}>
            처음이면 이름과 동의만 확인하고 바로 가입돼요. 비밀번호는 만들지 않아요.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-dim)", fontSize: "0.8rem" }}>
            <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
            또는 이메일로
            <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>
        </div>
      ) : null}
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
