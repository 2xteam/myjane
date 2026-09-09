"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { getApp } from "@/lib/apps";
import { CONTACT_EMAIL } from "@/lib/contact";

/**
 * 전화번호+PIN 계정 → 이메일+비밀번호 계정 **전환**.
 *
 * 로그인이 이메일로만 되면서(2026-09-09) 전화번호로만 가입했던 사람이 들어올 길이 필요하다.
 * 전화번호·PIN 으로 본인을 확인하고 새 이메일·비밀번호를 정하면 인증 메일이 간다.
 * 링크를 누르면 PIN 은 사라지고 그 뒤로는 이메일로 로그인한다.
 * → app/api/auth/migrate-pin/route.ts
 */
function MigrateForm() {
  const params = useSearchParams();
  const app = getApp(params.get("from"));
  const qs = params.toString();
  const withQs = (path: string) => (qs ? `${path}?${qs}` : path);

  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/migrate-pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, pin, email, password, passwordConfirm }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; pendingEmail?: string };
      if (!res.ok || !json.ok) {
        setMsg(json.error ?? "전환에 실패했습니다.");
        return;
      }
      setDone(json.pendingEmail ?? email);
    } catch {
      setMsg("네트워크 오류입니다.");
    } finally {
      setBusy(false);
    }
  }, [phone, pin, email, password, passwordConfirm]);

  return (
    <AuthShell
      eyebrow="SWITCH TO EMAIL"
      headline={
        <>
          이제는,
          <br />
          이메일로 들어와요
        </>
      }
      storySub={
        <>
          전화번호와 PIN으로 쓰던 계정을
          <br />
          이메일 계정으로 바꿉니다.
        </>
      }
      app={app}
      note={
        <>
          <strong>NOTE</strong>
          기록은 그대로예요. 로그인 방법만 바뀝니다.
          <br />
          인증 메일의 링크를 누르면 PIN은 더 쓰지 않아요.
        </>
      }
    >
      <h2 className="auth-title">이메일 계정으로 전환</h2>

      {done ? (
        <>
          <p className="auth-sub">
            <strong>{done}</strong> 로 인증 메일을 보냈어요. 메일의 링크를 누르면 전환이 끝나고,
            그 뒤로는 이메일과 새 비밀번호로 로그인합니다.
          </p>
          <p className="auth-hint">메일이 오지 않으면 스팸함을 확인해 주세요. 링크는 30분 동안 유효합니다.</p>
          <div className="auth-links">
            <Link href={withQs("/login")}>로그인으로</Link>
          </div>
        </>
      ) : (
        <>
          <p className="auth-sub">
            지금 쓰는 전화번호와 PIN으로 본인을 확인하고, 앞으로 쓸 이메일과 비밀번호를 정해 주세요.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy) void submit();
            }}
          >
            <div className="auth-field">
              <label className="auth-label" htmlFor="phone">전화번호</label>
              <input
                id="phone"
                className="auth-input"
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01012345678"
              />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="pin">PIN</label>
              <input
                id="pin"
                className="auth-input"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="지금 쓰는 PIN"
              />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="email">새 이메일</label>
              <input
                id="email"
                className="auth-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
              <p className="auth-hint">이 주소로 인증 메일을 보내요. 앞으로 로그인과 비밀번호 찾기에 쓰입니다.</p>
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="password">새 비밀번호</label>
              <input
                id="password"
                className="auth-input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8자 이상, 영문과 숫자"
              />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="passwordConfirm">새 비밀번호 확인</label>
              <input
                id="passwordConfirm"
                className="auth-input"
                type="password"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="한 번 더"
              />
            </div>

            <button type="submit" className="auth-btn" disabled={busy}>
              {busy ? "확인 중…" : "인증 메일 받기"}
            </button>
          </form>

          {msg ? <p className="auth-msg">{msg}</p> : null}

          <div className="auth-links">
            <div>
              전화번호로 계정이 여러 개이거나 PIN을 잊으셨다면{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> 로 메일을 보내 주세요.
              이메일을 등록해 드리고 회신합니다.
            </div>
            <div>
              <Link href={withQs("/login")}>로그인으로</Link>
            </div>
          </div>
        </>
      )}
    </AuthShell>
  );
}

export default function MigratePage() {
  return (
    <Suspense fallback={null}>
      <MigrateForm />
    </Suspense>
  );
}
