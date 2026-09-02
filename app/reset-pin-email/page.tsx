"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";

function ResetPinEmailForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [newPin, setNewPin] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = useCallback(async () => {
    setBusy(true);
    setMsg(null);

    if (!token) {
      setMsg("유효하지 않은 링크입니다.");
      setBusy(false);
      return;
    }
    if (newPin.length < 4) {
      setMsg("새 PIN은 4자 이상이어야 합니다.");
      setBusy(false);
      return;
    }
    if (newPin !== newPin2) {
      setMsg("새 PIN과 PIN 확인이 일치하지 않습니다.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-pin-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, newPin, newPinConfirm: newPin2 }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setMsg(json.error ?? "PIN 변경에 실패했습니다.");
        return;
      }
      setDone(true);
    } catch {
      setMsg("네트워크 오류입니다.");
    } finally {
      setBusy(false);
    }
  }, [token, newPin, newPin2]);

  if (!token) {
    return (
      <main style={mainStyle}>
        <div style={cardStyle}>
          <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem", color: "var(--text-primary)" }}>
            PIN 변경
          </h1>
          <p style={{ color: "var(--danger)", fontSize: 14 }}>유효하지 않은 링크입니다.</p>
          <Link href="/" style={linkStyle}>로그인으로</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={mainStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.5rem", color: "var(--text-primary)" }}>
          PIN 변경
        </h1>

        {done ? (
          <>
            <p style={{ margin: "1rem 0", color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
              PIN이 변경되었습니다.<br />새 PIN으로 로그인해 주세요.
            </p>
            <Link href="/" style={linkStyle}>로그인으로</Link>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 1.25rem", color: "var(--text-secondary)", fontSize: 14 }}>
              새로운 PIN을 입력해 주세요.
            </p>

            <label style={lab}>
              새 PIN (4자 이상)
              <input
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                style={inp}
                autoFocus
              />
            </label>

            <label style={lab}>
              새 PIN 확인
              <input
                type="password"
                value={newPin2}
                onChange={(e) => setNewPin2(e.target.value)}
                style={inp}
              />
            </label>

            <button
              type="button"
              onClick={submit}
              disabled={busy}
              style={btnStyle(busy)}
            >
              {busy ? "변경 중…" : "PIN 변경"}
            </button>

            {msg ? <p style={{ margin: "1rem 0 0", color: "var(--danger)", fontSize: 13 }}>{msg}</p> : null}
          </>
        )}
      </div>
    </main>
  );
}

export default function ResetPinEmailPage() {
  return (
    <Suspense
      fallback={
        <main style={mainStyle}>
          <div style={cardStyle}>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>로딩 중…</p>
          </div>
        </main>
      }
    >
      <ResetPinEmailForm />
    </Suspense>
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
  marginTop: "1rem",
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
