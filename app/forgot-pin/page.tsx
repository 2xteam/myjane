"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useCallback, useState } from "react";

type Step = "form" | "done";

export default function ForgotPinPage() {
  const [step, setStep] = useState<Step>("form");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setBusy(true);
    setMsg(null);

    if (!phone.trim()) {
      setMsg("전화번호를 입력해 주세요.");
      setBusy(false);
      return;
    }
    if (!email.trim()) {
      setMsg("이메일을 입력해 주세요.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/forgot-pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, email }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setMsg(json.error ?? "요청에 실패했습니다.");
        return;
      }
      setStep("done");
    } catch {
      setMsg("네트워크 오류입니다.");
    } finally {
      setBusy(false);
    }
  }, [phone, email]);

  return (
    <main style={mainStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.5rem", color: "var(--text-primary)" }}>
          PIN 찾기
        </h1>

        {step === "done" ? (
          <>
            <p style={{ margin: "1rem 0", color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
              PIN 변경 링크를 이메일로 발송했습니다.<br />이메일을 확인하여 PIN을 변경해 주세요.
            </p>
            <Link href="/" style={linkStyle}>로그인으로</Link>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 1.25rem", color: "var(--text-secondary)", fontSize: 14 }}>
              가입 시 등록한 전화번호와 이메일을 입력하면 PIN 변경 링크를 이메일로 보내드립니다.
            </p>

            <label style={lab}>
              전화번호
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01012345678"
                style={inp}
              />
            </label>

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
              {busy ? "발송 중…" : "PIN 변경 링크 발송"}
            </button>

            <Link href="/" style={{ ...linkStyle, marginTop: "1rem" }}>로그인으로</Link>

            {msg ? <p style={{ margin: "1rem 0 0", color: "var(--danger)", fontSize: 13 }}>{msg}</p> : null}
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
  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)",
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
  color: "var(--accent)",
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
    color: "#000",
    fontWeight: 600,
    cursor: busy ? "default" : "pointer",
  };
}
