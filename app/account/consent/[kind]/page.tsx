"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { AuthShell } from "@/components/AuthShell";
import { CONSENT_COPY, isConsentKind, type ConsentKind } from "@/lib/consents";
import { loadSession } from "@/lib/session";

/**
 * 분리 동의 화면 — **포털에만 있다.**
 *
 * 세 동의가 한 화면을 쓴다. 문구는 `lib/consents.ts` 한 곳에서 온다 —
 * 화면과 방침이 다른 말을 하면 어느 쪽이 진짜인지 알 수 없다.
 *
 * 국외 이전은 FitLog 만의 일이 아니다. SnapWord 단어장 사진과 SnapNote 문제
 * 사진도 같은 경로로 나가서, 세 앱이 이 화면을 함께 쓴다. 앱마다 두면
 * 같은 사람에게 세 번 묻는다 → 각 앱 lib/portal.ts 의 consentUrl()
 *
 * ⚠️ **동의를 거부할 수 있다는 것과 그때 무엇이 막히는지를 반드시 보여 준다.**
 * 그것을 알리지 않은 동의는 받은 것으로 보기 어렵다.
 *
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */
export default function ConsentPage() {
  return (
    <Suspense fallback={null}>
      <ConsentInner />
    </Suspense>
  );
}

function ConsentInner() {
  const params = useParams<{ kind: string }>();
  const search = useSearchParams();
  const kind = params?.kind;

  const [checked, setChecked] = useState(false);
  const [agreed, setAgreed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  /* 동의한 뒤 돌아갈 곳. 이 앱 밖으로는 보내지 않는다 — 오픈 리다이렉트 방지 */
  const rawNext = search.get("next") ?? "";
  const next =
    rawNext.startsWith("http://") || rawNext.startsWith("https://") ? rawNext : null;

  const valid = isConsentKind(kind);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/consents");
      if (!res.ok) {
        setMsg(res.status === 403 ? "자녀 프로필의 동의는 보호자 프로필에서 '자녀 관리'로 설정해요." : "로그인이 필요해요.");
        return;
      }
      const json = (await res.json()) as {
        ok: boolean;
        consents: Record<string, { agreed: boolean }>;
      };
      if (!json.ok || !valid) return;
      setAgreed(json.consents[kind as ConsentKind]?.agreed ?? false);
    } catch {
      setMsg("상태를 불러오지 못했어요.");
    }
  }, [kind, valid]);

  useEffect(() => {
    if (!loadSession()) {
      setMsg("로그인이 필요해요.");
      return;
    }
    void load();
  }, [load]);

  const submit = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/consents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setMsg(json.error ?? "동의 처리에 실패했어요.");
        return;
      }
      setAgreed(true);
      /* 쓰려던 자리로 돌려보낸다 */
      if (next) window.location.href = next;
    } catch {
      setMsg("동의 처리에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }, [kind, next]);

  const withdraw = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/account/consents?kind=${kind}`, { method: "DELETE" });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setMsg(json.error ?? "철회에 실패했어요.");
        return;
      }
      setAgreed(false);
      setChecked(false);
      setMsg("동의를 철회했어요. 이미 저장된 기록은 그대로 있습니다.");
    } catch {
      setMsg("철회에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }, [kind]);

  if (!valid) {
    return (
      <AuthShell
        eyebrow="ACCOUNT · 동의"
        headline={<>없는 동의 항목이에요</>}
        storySub={<>주소를 다시 확인해 주세요.</>}
      >
        <div className="auth-links">
          <Link href="/">돌아가기</Link>
        </div>
      </AuthShell>
    );
  }

  const copy = CONSENT_COPY[kind as ConsentKind];

  return (
    <AuthShell
      eyebrow="ACCOUNT · 동의"
      headline={<>{copy.title}</>}
      storySub={<>가입 동의와 따로 받는 항목입니다.</>}
    >
      <ul style={listStyle}>
        {copy.items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>

      {/*
        거부할 수 있다는 것과 그때 막히는 것을 알린다.
        이것을 안 보여주면 동의를 받은 것으로 보기 어렵다.
      */}
      <div style={refuseStyle}>
        <p style={{ margin: 0, fontSize: "0.82rem", lineHeight: 1.75 }}>{copy.refuse}</p>
      </div>

      {agreed ? (
        <>
          <p style={okStyle}>이미 동의하셨어요.</p>
          <button type="button" className="auth-btn" onClick={withdraw} disabled={busy}>
            {busy ? "처리 중…" : "동의 철회하기"}
          </button>
          <p style={hintStyle}>
            철회하면 앞으로 처리하지 않습니다.{" "}
            <strong>이미 저장된 기록은 지워지지 않아요</strong> — 지우시려면 각
            기록에서 삭제하거나 <Link href="/account/withdraw">탈퇴</Link>해 주세요.
          </p>
        </>
      ) : (
        <>
          <label style={checkRowStyle}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              style={checkStyle}
            />
            <span>{copy.checkbox}</span>
          </label>
          <button
            type="button"
            className="auth-btn"
            onClick={submit}
            disabled={busy || !checked}
          >
            {busy ? "처리 중…" : "동의하고 계속하기"}
          </button>
        </>
      )}

      {msg ? <p className="auth-msg">{msg}</p> : null}

      <div className="auth-links">
        <Link href="/legal/privacy">개인정보처리방침 보기</Link>
      </div>
    </AuthShell>
  );
}

const listStyle: CSSProperties = {
  margin: "0 0 16px",
  paddingLeft: "1.05rem",
  fontSize: "0.84rem",
  lineHeight: 1.8,
  color: "var(--text-dim)",
  wordBreak: "keep-all",
};

const refuseStyle: CSSProperties = {
  margin: "0 0 18px",
  padding: "12px 14px",
  border: "1px solid var(--border)",
  borderLeft: "3px solid var(--accent)",
  borderRadius: "var(--radius-sm)",
  background: "var(--accent-soft)",
  color: "var(--text)",
};

const checkRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 9,
  margin: "0 0 14px",
  fontSize: "0.86rem",
  lineHeight: 1.7,
  color: "var(--text)",
  cursor: "pointer",
  wordBreak: "keep-all",
};

const checkStyle: CSSProperties = {
  marginTop: 4,
  width: 16,
  height: 16,
  flexShrink: 0,
  accentColor: "var(--accent)",
  cursor: "pointer",
};

const okStyle: CSSProperties = {
  margin: "0 0 12px",
  fontSize: "0.86rem",
  fontWeight: 700,
  color: "var(--accent-ink)",
};

const hintStyle: CSSProperties = {
  margin: "12px 0 0",
  fontSize: "0.78rem",
  lineHeight: 1.7,
  color: "var(--text-muted)",
  wordBreak: "keep-all",
};
