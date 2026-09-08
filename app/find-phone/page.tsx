"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Step = "form" | "done" | "result";

export default function FindPhonePage() {
  return (
    <Suspense fallback={null}>
      <FindPhoneInner />
    </Suspense>
  );
}

function FindPhoneInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [phone, setPhone] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  /*
    메일의 링크로 들어왔다. 전화번호는 **여기서만** 보여 준다 —
    메일 본문에 적지 않는 이유가 그것이다 → app/api/auth/find-phone
  */
  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const res = await fetch(`/api/auth/find-phone?token=${encodeURIComponent(token)}`);
        const json = (await res.json()) as { ok: boolean; phone?: string; error?: string };
        if (!json.ok || !json.phone) {
          setMsg(json.error ?? "링크가 만료되었어요. 다시 요청해 주세요.");
          return;
        }
        setPhone(json.phone);
        setStep("result");
      } catch {
        setMsg("네트워크 오류입니다.");
      }
    })();
  }, [token]);

  const submit = useCallback(async () => {
    setBusy(true);
    setMsg(null);

    if (!email.trim()) {
      setMsg("이메일을 입력해 주세요.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/find-phone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setMsg(json.error ?? "전화번호 찾기에 실패했습니다.");
        return;
      }
      setStep("done");
    } catch {
      setMsg("네트워크 오류입니다.");
    } finally {
      setBusy(false);
    }
  }, [email]);

  return (
    <main style={mainStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.5rem", color: "var(--text-primary)" }}>
          전화번호 찾기
        </h1>

        {step === "result" ? (
          <>
            <p style={{ margin: "1rem 0 0.5rem", color: "var(--text-secondary)", fontSize: 14 }}>
              이 계정에 등록된 전화번호예요.
            </p>
            <div
              style={{
                margin: "0 0 1rem",
                padding: "16px",
                borderRadius: 12,
                background: "var(--bg-secondary)",
                textAlign: "center",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 2,
                color: "var(--text-primary)",
              }}
            >
              {phone}
            </div>
            <Link href="/login" style={linkStyle}>로그인으로</Link>
          </>
        ) : step === "done" ? (
          <>
            <p style={{ margin: "1rem 0", color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
              입력하신 이메일로 등록된 계정이 있으면 확인 링크를 보내드렸어요.
              <br />
              메일의 버튼을 누르시면 전화번호를 보여드립니다.
            </p>
            <Link href="/" style={linkStyle}>로그인으로</Link>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 1.25rem", color: "var(--text-secondary)", fontSize: 14 }}>
              가입 시 등록한 이메일을 입력하면 전화번호를 이메일로 보내드립니다.
            </p>

            <label style={lab}>
              이메일
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                autoComplete="email"
                style={inp}
              />
            </label>

            <button
              type="button"
              onClick={submit}
              disabled={busy}
              style={btnStyle(busy)}
            >
              {busy ? "발송 중…" : "전화번호 찾기"}
            </button>

            <Link href="/" style={{ ...linkStyle, marginTop: "1rem" }}>로그인으로</Link>

            {msg ? <p style={{ margin: "1rem 0 0", color: "var(--danger-ink)", fontSize: 13 }}>{msg}</p> : null}
          </>
        )}
      </div>
    </main>
  );
}

const mainStyle: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "1.5rem",
  background: "var(--bg-primary)",
};

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 400,
  background: "var(--bg-card)",
  borderRadius: "var(--radius-xl)",
  padding: "2rem",
  boxShadow: "0 25px 50px -12px rgba(6,34,40,0.4)",
};

const lab: CSSProperties = {
  display: "grid",
  gap: 6,
  marginBottom: "0.85rem",
  fontSize: 13,
  color: "var(--text-secondary)",
};

const inp: CSSProperties = {
  padding: "0.65rem 0.75rem",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--input-border)",
  background: "var(--input-bg)",
  color: "var(--text-primary)",
  fontSize: 16,
};

const linkStyle: CSSProperties = {
  display: "block",
  textAlign: "center",
  // 밝은 --accent 는 14px 글자에서 2.47:1 이라 잉크를 쓴다
  color: "var(--accent-ink)",
  fontSize: 14,
  textDecoration: "none",
};

function btnStyle(busy: boolean): CSSProperties {
  return {
    width: "100%",
    marginTop: "0.5rem",
    padding: "0.85rem",
    borderRadius: "var(--radius-sm)",
    border: "none",
    background: busy ? "var(--text-muted)" : "var(--accent)",
    color: "var(--on-accent)",
    fontWeight: 600,
    cursor: busy ? "default" : "pointer",
  };
}
