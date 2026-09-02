"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useCallback, useState } from "react";

type Step = "verify" | "reset" | "done";

export default function ResetPinPage() {
  const [step, setStep] = useState<Step>("verify");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setBusy(true);
    setMsg(null);

    if (!phone.trim()) { setMsg("전화번호를 입력해 주세요."); setBusy(false); return; }
    if (!name.trim()) { setMsg("이름을 입력해 주세요."); setBusy(false); return; }

    if (step === "verify") {
      try {
        const res = await fetch("/api/auth/verify-identity", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone, name }),
        });
        const json = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setMsg(json.error ?? "확인에 실패했습니다.");
          return;
        }
        setStep("reset");
      } catch {
        setMsg("네트워크 오류입니다.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (newPin.length < 4) { setMsg("새 PIN은 4자 이상이어야 합니다."); setBusy(false); return; }
    if (newPin !== newPin2) { setMsg("새 PIN과 PIN 확인이 일치하지 않습니다."); setBusy(false); return; }

    try {
      const res = await fetch("/api/auth/reset-pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, name, newPin, newPinConfirm: newPin2 }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setMsg(json.error ?? "PIN 변경에 실패했습니다.");
        return;
      }
      setStep("done");
    } catch {
      setMsg("네트워크 오류입니다.");
    } finally {
      setBusy(false);
    }
  }, [step, phone, name, newPin, newPin2]);

  return (
    <main style={mainStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.5rem", color: "var(--text-primary)" }}>
          PIN 변경
        </h1>

        {step === "done" ? (
          <>
            <p style={{ margin: "1rem 0", color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
              PIN이 변경되었습니다.<br />새 PIN으로 로그인해 주세요.
            </p>
            <Link href="/" style={linkStyle}>로그인으로</Link>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 1.25rem", color: "var(--text-secondary)", fontSize: 14 }}>
              {step === "verify"
                ? "등록된 전화번호와 이름을 입력해 주세요."
                : "새로운 PIN을 입력해 주세요."}
            </p>

            <label style={lab}>
              전화번호
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01012345678"
                style={inp}
                disabled={step === "reset"}
              />
            </label>
            <label style={lab}>
              이름
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="등록된 이름"
                style={inp}
                disabled={step === "reset"}
              />
            </label>

            {step === "reset" && (
              <>
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
              </>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={busy}
              style={{
                width: "100%",
                marginTop: "0.5rem",
                padding: "0.85rem",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: busy ? "var(--text-muted)" : "var(--accent)",
                color: "#000",
                fontWeight: 600,
                cursor: busy ? "default" : "pointer",
              }}
            >
              {busy ? "확인 중…" : step === "verify" ? "본인 확인" : "PIN 변경"}
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
