"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { loadSession, saveSession } from "@/lib/session";

/**
 * 이미 쓰던 계정에 이메일을 받는 화면. **포털에만 있다.**
 *
 * 여섯 앱이 각자 물으면 같은 사람에게 여섯 번 묻는다. 앱들은 배너로 이 주소의
 * 링크만 보여 준다 → components/EmailPrompt.tsx
 *
 * 흐름 — 이메일 입력 → 인증 메일 → (메일에서 인증) → 비밀번호 설정
 *
 * ⚠️ 로그인을 막지 않는다. 언제든 "나중에 하기"로 빠져나갈 수 있고, 하루 뒤에
 * 다시 묻는다 → app/api/auth/email-prompt/route.ts
 */

/**
 * "나중에 하기". 링크처럼 보이는 버튼이다.
 *
 * `globals.css` 에 클래스를 새로 만들지 않았다 — 지금 A 작업(디자인 요소 추가)이
 * 같은 파일을 고치고 있어서, 여기서 규칙을 더하면 충돌한다.
 * 자리를 잡으면 `.auth-links button` 으로 옮길 것.
 */
function LaterButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        font: "inherit",
        color: "var(--text-dim)",
        textDecoration: "underline",
        cursor: "pointer",
      }}
    >
      나중에 하기
    </button>
  );
}

type Status = {
  state: "missing" | "pending" | "unverified" | null;
  email: string | null;
  pendingEmail: string | null;
  resendCooldownMs: number;
  hasPassword: boolean;
};

export default function AccountEmailPage() {
  const router = useRouter();

  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordDone, setPasswordDone] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/email-prompt");
      if (res.status === 401) {
        setNeedsLogin(true);
        return;
      }
      const json = (await res.json()) as { ok: boolean } & Status;
      if (json.ok) {
        setStatus(json);
        setCooldown(Math.ceil((json.resendCooldownMs ?? 0) / 1000));
      }
    } catch {
      setMsg("상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submitEmail = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/update-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        retryAfterMs?: number;
      };
      if (!res.ok || !json.ok) {
        if (json.retryAfterMs) setCooldown(Math.ceil(json.retryAfterMs / 1000));
        setMsg(json.error ?? "등록에 실패했어요.");
        return;
      }
      setMsg(`${email} 으로 인증 메일을 보냈어요. 메일함을 확인해 주세요.`);
      setCooldown(60);
      await refresh();
    } catch {
      setMsg("네트워크 오류입니다.");
    } finally {
      setBusy(false);
    }
  }, [email, refresh]);

  const resend = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/send-verification", { method: "POST" });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        retryAfterMs?: number;
        cooldownMs?: number;
      };
      if (!res.ok || !json.ok) {
        if (json.retryAfterMs) setCooldown(Math.ceil(json.retryAfterMs / 1000));
        setMsg(json.error ?? "메일을 보내지 못했어요.");
        return;
      }
      setCooldown(Math.ceil((json.cooldownMs ?? 60000) / 1000));
      setMsg("인증 메일을 다시 보냈어요.");
    } catch {
      setMsg("네트워크 오류입니다.");
    } finally {
      setBusy(false);
    }
  }, []);

  const submitPassword = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, passwordConfirm }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setMsg(json.error ?? "비밀번호를 설정하지 못했어요.");
        return;
      }
      setPasswordDone(true);
      setMsg(null);
    } catch {
      setMsg("네트워크 오류입니다.");
    } finally {
      setBusy(false);
    }
  }, [password, passwordConfirm]);

  const snooze = useCallback(async () => {
    try {
      await fetch("/api/auth/email-prompt", { method: "POST" });
    } catch {
      /* 미루기가 실패해도 화면은 떠나게 둔다 */
    }
    router.replace("/");
  }, [router]);

  /*
    인증이 끝나면 세션 쿠키의 `email` 도 맞춰 준다. 헤더 같은 자리가 쿠키의
    값을 읽기 때문이다. 토큰은 넘기지 않는다 — `saveSession` 이 이미 있는 것을
    살려 준다 → lib/session.ts
  */
  useEffect(() => {
    if (!status?.email) return;
    const s = loadSession();
    if (s && s.email !== status.email) saveSession({ ...s, email: status.email });
  }, [status?.email]);

  const shell = (children: React.ReactNode) => (
    <AuthShell
      eyebrow="KEEP YOUR ACCOUNT"
      headline={
        <>
          이메일을
          <br />
          하나 남겨 주세요
        </>
      }
      storySub={
        <>
          비밀번호를 잊었을 때
          <br />
          되찾을 수 있는 유일한 길이에요.
        </>
      }
      note={
        <>
          <strong>NOTE</strong>
          지금 쓰시던 방법(전화번호 + PIN)은 <strong>그대로 쓸 수 있어요.</strong>
          <br />
          없애지 않아요. 이메일은 되찾기용으로만 더해 둡니다.
        </>
      }
    >
      {children}
    </AuthShell>
  );

  if (loading) return shell(<p className="auth-sub">확인하고 있어요…</p>);

  if (needsLogin) {
    return shell(
      <>
        <h2 className="auth-title">로그인이 필요해요</h2>
        <p className="auth-sub">
          이메일을 등록하려면 먼저 로그인해 주세요.
        </p>
        <Link href="/login" className="auth-btn" style={{ display: "block", textAlign: "center" }}>
          로그인
        </Link>
      </>,
    );
  }

  // 비밀번호까지 끝났다
  if (passwordDone) {
    return shell(
      <>
        <h2 className="auth-title">다 끝났어요</h2>
        <p className="auth-sub">
          이제 이메일과 비밀번호로도 로그인할 수 있어요. 쓰시던 전화번호와 PIN 도
          그대로 됩니다.
        </p>
        <Link href="/" className="auth-btn" style={{ display: "block", textAlign: "center" }}>
          메인으로
        </Link>
      </>,
    );
  }

  /*
    인증이 끝났는데 비밀번호가 없다 → 이제 정한다.
    이미 있는 사람에게는 묻지 않는다 — 바꾸라는 말처럼 읽힌다.
  */
  if (status?.state === null && status.hasPassword) {
    return shell(
      <>
        <h2 className="auth-title">다 되어 있어요</h2>
        <p className="auth-sub">
          {status.email} 인증까지 끝났어요. 더 하실 일이 없습니다.
        </p>
        <Link href="/" className="auth-btn" style={{ display: "block", textAlign: "center" }}>
          메인으로
        </Link>
      </>,
    );
  }

  if (status?.state === null) {
    return shell(
      <>
        <h2 className="auth-title">인증이 끝났어요</h2>
        <p className="auth-sub">
          {status.email} 을 확인했어요. 이 주소로 쓸 비밀번호를 정해 주세요.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) void submitPassword();
          }}
        >
          <div className="auth-field">
            <label className="auth-label" htmlFor="password">
              비밀번호
            </label>
            <input
              id="password"
              className="auth-input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="auth-hint">8자 이상, 영문과 숫자를 함께 넣어 주세요.</p>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="passwordConfirm">
              비밀번호 확인
            </label>
            <input
              id="passwordConfirm"
              className="auth-input"
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="auth-btn" disabled={busy}>
            {busy ? "설정하는 중…" : "비밀번호 설정하기"}
          </button>
        </form>

        {msg ? <p className="auth-msg">{msg}</p> : null}

        <div className="auth-links">
          <div>
            <LaterButton onClick={() => void snooze()} />
          </div>
        </div>
      </>,
    );
  }

  // 메일을 보내 두고 링크를 기다린다
  if (status?.state === "pending" || status?.state === "unverified") {
    const target = status.pendingEmail ?? status.email;
    return shell(
      <>
        <h2 className="auth-title">메일을 확인해 주세요</h2>
        <p className="auth-sub">
          {target} 으로 인증 링크를 보냈어요. 링크를 누르면 끝나요.
        </p>
        <p className="auth-hint">
          메일이 보이지 않으면 스팸함도 확인해 주세요. 링크는 30분 동안 유효해요.
        </p>

        <button
          type="button"
          className="auth-btn"
          onClick={() => void resend()}
          disabled={busy || cooldown > 0}
        >
          {cooldown > 0
            ? `다시 보내기 (${cooldown}초)`
            : busy
              ? "보내는 중…"
              : "인증 메일 다시 받기"}
        </button>

        {msg ? <p className="auth-msg">{msg}</p> : null}

        <div className="auth-field" style={{ marginTop: 24 }}>
          <label className="auth-label" htmlFor="email">
            다른 주소로 바꾸기
          </label>
          <input
            id="email"
            className="auth-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={target ?? "name@example.com"}
          />
          <button
            type="button"
            className="auth-btn"
            onClick={() => void submitEmail()}
            disabled={busy || !email.trim()}
            style={{ marginTop: 8 }}
          >
            이 주소로 다시 보내기
          </button>
        </div>

        <div className="auth-links">
          <div>
            <LaterButton onClick={() => void snooze()} />
          </div>
        </div>
      </>,
    );
  }

  // 이메일이 아예 없다
  return shell(
    <>
      <h2 className="auth-title">이메일을 등록해 주세요</h2>
      <p className="auth-sub">
        비밀번호를 잊었을 때 되찾을 수 있는 유일한 길이에요.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void submitEmail();
        }}
      >
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
            required
          />
          <p className="auth-hint">
            이 주소로 인증 메일을 보내요. 인증을 마치면 등록됩니다.
          </p>
        </div>

        <button type="submit" className="auth-btn" disabled={busy}>
          {busy ? "보내는 중…" : "인증 메일 받기"}
        </button>
      </form>

      {msg ? <p className="auth-msg">{msg}</p> : null}

      <div className="auth-links">
        <div>
          <LaterButton onClick={() => void snooze()} />
        </div>
      </div>
    </>,
  );
}
