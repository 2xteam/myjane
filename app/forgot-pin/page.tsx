"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { CONTACT_EMAIL } from "@/lib/contact";

type Step = "form" | "done";

export default function ForgotPinPage() {
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setBusy(true);
    setMsg(null);

    if (!email.trim()) {
      setMsg("이메일을 입력해 주세요.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/forgot-pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
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
  }, [email]);

  return (
    <main style={mainStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.5rem", color: "var(--text-primary)" }}>
          비밀번호 찾기
        </h1>

        {step === "done" ? (
          <>
            <p style={{ margin: "1rem 0", color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
              입력하신 주소로 가입된 계정이 있으면 비밀번호 재설정 링크를 보냈어요.<br />메일함(스팸함 포함)을 확인해 주세요. 링크는 30분 동안 유효합니다.
            </p>
            <Link href="/login" style={linkStyle}>로그인으로</Link>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 1.25rem", color: "var(--text-secondary)", fontSize: 14 }}>
              가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다.
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
              {busy ? "발송 중…" : "재설정 링크 발송"}
            </button>

            <div style={noteStyle}>
              <strong>전화번호와 PIN으로만 쓰셨나요?</strong>
              <br />
              이메일이 없는 계정은 링크를 받을 수 없어요. PIN을 알고 있다면{" "}
              <Link href="/migrate" style={{ color: "var(--accent-ink)" }}>이메일 계정으로 전환</Link>
              하시고, PIN도 잊으셨다면{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--accent-ink)" }}>{CONTACT_EMAIL}</a>
              로 가입 전화번호와 함께 메일을 보내 주세요. 이메일을 등록해 드리고 회신합니다.
            </div>

            <Link href="/login" style={{ ...linkStyle, marginTop: "1rem" }}>로그인으로</Link>

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

const noteStyle: CSSProperties = {
  marginTop: "1rem",
  padding: "0.85rem 1rem",
  borderRadius: "var(--radius-sm)",
  background: "var(--bg-primary)",
  color: "var(--text-secondary)",
  fontSize: 13,
  lineHeight: 1.6,
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
