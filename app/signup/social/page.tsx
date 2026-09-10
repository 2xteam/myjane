"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { buildReturnUrl, getApp } from "@/lib/apps";
import { saveSession, type SessionUser } from "@/lib/session";

/**
 * 소셜 첫 가입 — 동의 한 번.
 *
 * 구글로 처음 들어온 사람에게 이름을 확인받고 만 14세 · 약관 · 개인정보 동의를 받는다.
 * "로그인하면 동의한 것으로 간주" 로 넘기지 않는다 — 방침이 가입 시 동의를 받는다고 적었다.
 * 두 번째부터는 이 화면을 거치지 않는다. → app/api/auth/oauth/complete/route.ts
 */
function Mark({ required }: { required: boolean }) {
  return (
    <span style={{ marginLeft: 6, fontSize: "0.72rem", fontWeight: 700, color: required ? "var(--accent-ink)" : "var(--text-muted)" }}>
      {required ? "필수" : "선택"}
    </span>
  );
}

const PROVIDER_LABEL: Record<string, string> = { google: "구글", kakao: "카카오", naver: "네이버" };

function SocialSignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const app = getApp(params.get("from"));
  const returnUrl = buildReturnUrl(app, params.get("next"));
  const rawNext = params.get("next");
  const localNext = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const [pending, setPending] = useState<{ provider: string; name: string; email: string | null; emailVerified: boolean } | null>(null);
  const [expired, setExpired] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ageOk, setAgeOk] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/auth/oauth/complete");
      const json = (await res.json()) as { ok: boolean; provider?: string; name?: string; email?: string | null; emailVerified?: boolean };
      if (!res.ok || !json.ok) {
        setExpired(true);
        return;
      }
      setPending({ provider: json.provider ?? "google", name: json.name ?? "", email: json.email ?? null, emailVerified: Boolean(json.emailVerified) });
      setName(json.name ?? "");
    })();
  }, []);

  const needsEmail = pending ? !(pending.email && pending.emailVerified) : false;

  const submit = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/oauth/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email: needsEmail ? email : undefined, ageOk, agreeTerms, agreePrivacy }),
      });
      const json = (await res.json()) as { ok: boolean; user?: SessionUser; error?: string };
      if (!res.ok || !json.ok || !json.user) {
        setMsg(json.error ?? "가입에 실패했습니다.");
        if (res.status === 401) setExpired(true);
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
  }, [name, email, needsEmail, ageOk, agreeTerms, agreePrivacy, app, returnUrl, router, localNext]);

  const qs = params.toString();
  const withQs = (path: string) => (qs ? `${path}?${qs}` : path);

  return (
    <AuthShell
      eyebrow="ONE MORE STEP"
      headline={
        <>
          거의 다 됐어요,
          <br />
          한 번만 확인할게요
        </>
      }
      storySub={
        <>
          처음 오신 분께만 묻는 것들이에요.
          <br />
          다음부터는 바로 들어와요.
        </>
      }
      app={app}
      note={
        <>
          <strong>NOTE</strong>
          비밀번호는 만들지 않아요.
          <br />
          {pending ? `${PROVIDER_LABEL[pending.provider] ?? pending.provider} 계정으로 로그인합니다.` : ""}
        </>
      }
    >
      <h2 className="auth-title">가입 확인</h2>

      {expired ? (
        <>
          <p className="auth-sub">가입 정보가 만료됐어요. 다시 로그인해 주세요.</p>
          <div className="auth-links">
            <Link href={withQs("/login")}>로그인으로</Link>
          </div>
        </>
      ) : !pending ? (
        <p className="auth-sub">불러오는 중…</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) void submit();
          }}
        >
          <div className="auth-field">
            <label className="auth-label" htmlFor="name">
              이름 (별칭) <Mark required />
            </label>
            <input id="name" className="auth-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoComplete="nickname" />
            <p className="auth-hint">서비스 안에서 보이는 이름이에요. 나중에 바꿀 수 있어요.</p>
          </div>

          {needsEmail ? (
            <div className="auth-field">
              <label className="auth-label" htmlFor="email">
                이메일 <Mark required />
              </label>
              <input id="email" className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="name@example.com" />
              <p className="auth-hint">{PROVIDER_LABEL[pending.provider] ?? pending.provider} 계정에서 확인된 이메일을 받지 못했어요. 인증 메일을 보내드릴게요.</p>
            </div>
          ) : (
            <p className="auth-hint" style={{ margin: "0 0 14px" }}>
              이메일 <strong>{pending.email}</strong> 은 {PROVIDER_LABEL[pending.provider] ?? pending.provider}에서 확인된 주소라 그대로 씁니다.
            </p>
          )}

          <div style={{ display: "grid", gap: 10, margin: "8px 0 18px" }}>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "0.9rem", lineHeight: 1.5 }}>
              <input type="checkbox" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} style={{ marginTop: 3 }} />
              <span>
                만 14세 이상입니다 <Mark required />
                <span style={{ display: "block", fontSize: "0.78rem", color: "var(--text-dim)" }}>만 14세 미만 자녀는 가입 후 보호자 계정에서 프로필로 추가해요.</span>
              </span>
            </label>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "0.9rem", lineHeight: 1.5 }}>
              <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} style={{ marginTop: 3 }} />
              <span>
                <Link href="/legal/terms" target="_blank">이용약관</Link>에 동의합니다 <Mark required />
              </span>
            </label>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "0.9rem", lineHeight: 1.5 }}>
              <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} style={{ marginTop: 3 }} />
              <span>
                <Link href="/legal/privacy" target="_blank">개인정보 수집·이용</Link>에 동의합니다 <Mark required />
              </span>
            </label>
          </div>

          <button type="submit" className="auth-btn" disabled={busy || !ageOk || !agreeTerms || !agreePrivacy || !name.trim() || (needsEmail && !email.trim())}>
            {busy ? "만드는 중…" : "가입하고 시작하기"}
          </button>
          {msg ? <p className="auth-msg">{msg}</p> : null}

          <div className="auth-links">
            <div>
              <Link href={withQs("/login")}>다른 방법으로 로그인</Link>
            </div>
          </div>
        </form>
      )}
    </AuthShell>
  );
}

export default function SocialSignupPage() {
  return (
    <Suspense fallback={null}>
      <SocialSignupForm />
    </Suspense>
  );
}
