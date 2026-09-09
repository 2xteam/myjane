"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { AuthShell } from "@/components/AuthShell";
import { hasUsableSession } from "@/lib/session";

/**
 * 자녀 관리 — 보호자 계정 안의 자녀 프로필을 추가·수정·삭제하고, 만 14세부터 독립시킨다.
 * **포털에만 있고 보호자 세션에서만** 열린다 (자녀 세션은 API 가 403).
 *
 * 추가할 때 받는 동의 셋 —
 *   법정대리인(필수)   자녀 정보를 보호자가 대신해 처리하는 데 동의. 시각을 남긴다
 *   건강정보(선택)     FitLog 인바디·피검사 기록. 없으면 FitLog 기록 기능만 막힌다
 *   국외 이전(선택)    사진 인식·AI 대화(OpenAI). 없으면 그 기능만 막힌다
 * → app/api/account/children · lib/family.ts · my-obsidian-vault / 50-Plans/F 보호자·자녀 계정.md
 */

type Child = {
  id: string;
  name: string;
  userId: string | null;
  birthYear: number | null;
  consents: { guardian: boolean; health: boolean; overseas: boolean };
  pendingEmail: string | null;
  createdAt: string | null;
};

const THIS_YEAR = new Date().getFullYear();

export default function ChildrenPage() {
  const [children, setChildren] = useState<Child[] | null>(null);
  const [max, setMax] = useState(5);
  const [forbidden, setForbidden] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 추가 폼
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [guardian, setGuardian] = useState(false);
  const [health, setHealth] = useState(false);
  const [overseas, setOverseas] = useState(false);

  // 독립 폼
  const [indepFor, setIndepFor] = useState<Child | null>(null);
  const [indepEmail, setIndepEmail] = useState("");
  const [indepPw, setIndepPw] = useState("");
  const [indepPw2, setIndepPw2] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/account/children");
    const json = (await res.json()) as { ok: boolean; children?: Child[]; max?: number; child?: boolean; error?: string };
    if (res.status === 403 && json.child) {
      setForbidden(true);
      setChildren([]);
      return;
    }
    if (!res.ok || !json.ok) {
      setMsg(json.error ?? "불러오지 못했어요.");
      setChildren([]);
      return;
    }
    setChildren(json.children ?? []);
    setMax(json.max ?? 5);
  }, []);

  useEffect(() => {
    if (!hasUsableSession()) {
      window.location.replace("/login?next=" + encodeURIComponent("/account/children"));
      return;
    }
    void load();
  }, [load]);

  const call = useCallback(
    async (input: RequestInfo, init: RequestInit, done?: () => void) => {
      setBusy(true);
      setMsg(null);
      try {
        const res = await fetch(input, { ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
        const json = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setMsg(json.error ?? "실패했어요.");
          return false;
        }
        done?.();
        await load();
        return true;
      } catch {
        setMsg("네트워크 오류입니다.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const add = () =>
    call("/api/account/children", {
      method: "POST",
      body: JSON.stringify({ name, birthYear: birthYear || null, consents: { guardian, health, overseas } }),
    }, () => {
      setName("");
      setBirthYear("");
      setGuardian(false);
      setHealth(false);
      setOverseas(false);
    });

  const toggle = (c: Child, key: "health" | "overseas") =>
    call(`/api/account/children/${c.id}`, { method: "PATCH", body: JSON.stringify({ [key]: !c.consents[key] }) });

  const remove = (c: Child) => {
    if (!window.confirm(`${c.name} 프로필을 지울까요?\n여섯 서비스의 기록이 바로 삭제되고 되돌릴 수 없어요.`)) return;
    void call(`/api/account/children/${c.id}`, { method: "DELETE" });
  };

  const independence = () => {
    if (!indepFor) return;
    void call(`/api/account/children/${indepFor.id}/independence`, {
      method: "POST",
      body: JSON.stringify({ email: indepEmail, password: indepPw, passwordConfirm: indepPw2 }),
    }, () => {
      setIndepFor(null);
      setIndepEmail("");
      setIndepPw("");
      setIndepPw2("");
    });
  };

  return (
    <AuthShell
      eyebrow="FAMILY"
      headline={
        <>
          아이의 기록도,
          <br />
          한 계정 안에서
        </>
      }
      storySub={
        <>
          만 14세 미만 자녀는 보호자 계정에
          <br />
          프로필로 추가해 함께 써요.
        </>
      }
      note={
        <>
          <strong>NOTE</strong>
          자녀 프로필에는 이메일·전화번호가 없어요.
          <br />
          로그인은 보호자가 하고, 들어갈 때 프로필을 고릅니다.
        </>
      }
    >
      <h2 className="auth-title">자녀 관리</h2>

      {forbidden ? (
        <>
          <p className="auth-sub">자녀 프로필로 보고 있어요. 자녀 관리는 보호자 프로필에서만 할 수 있습니다.</p>
          <div className="auth-links">
            <Link href="/account/switch">보호자 프로필로 전환</Link>
          </div>
        </>
      ) : children === null ? (
        <p className="auth-sub">불러오는 중…</p>
      ) : (
        <>
          {children.length === 0 ? (
            <p className="auth-sub">아직 자녀 프로필이 없어요. 아래에서 추가할 수 있습니다.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "grid", gap: 12 }}>
              {children.map((c) => (
                <li key={c.id} style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                    <strong style={{ fontSize: 16 }}>{c.name}</strong>
                    <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                      {c.birthYear ? `${c.birthYear}년생` : "출생연도 없음"}
                    </span>
                  </div>
                  <div style={{ display: "grid", gap: 6, marginTop: 10, fontSize: 13 }}>
                    <label style={rowStyle}>
                      <input type="checkbox" checked={c.consents.health} disabled={busy} onChange={() => void toggle(c, "health")} />
                      건강정보 처리 동의 (FitLog 인바디·피검사)
                    </label>
                    <label style={rowStyle}>
                      <input type="checkbox" checked={c.consents.overseas} disabled={busy} onChange={() => void toggle(c, "overseas")} />
                      개인정보 국외 이전 동의 (사진 인식 · AI 대화)
                    </label>
                  </div>
                  {c.pendingEmail ? (
                    <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--text-dim)" }}>
                      독립 진행 중 — <strong>{c.pendingEmail}</strong> 의 인증 메일을 기다리고 있어요.
                    </p>
                  ) : null}
                  <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 13 }}>
                    <button type="button" style={linkBtn} disabled={busy} onClick={() => setIndepFor(indepFor?.id === c.id ? null : c)}>
                      {indepFor?.id === c.id ? "독립 취소" : "독립시키기 (만 14세부터)"}
                    </button>
                    <button type="button" style={{ ...linkBtn, color: "var(--danger-ink)" }} disabled={busy} onClick={() => remove(c)}>
                      프로필 삭제
                    </button>
                  </div>
                  {indepFor?.id === c.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!busy) independence();
                      }}
                      style={{ marginTop: 12, display: "grid", gap: 10 }}
                    >
                      <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)" }}>
                        자녀가 쓸 이메일과 비밀번호를 정해 주세요. 인증 메일의 링크를 누르면 이 프로필은
                        보호자 계정에서 분리되어 자기 이메일로 로그인하는 계정이 됩니다. 기록은 그대로예요.
                      </p>
                      <input className="auth-input" type="email" placeholder="자녀 이메일" value={indepEmail} onChange={(e) => setIndepEmail(e.target.value)} />
                      <input className="auth-input" type="password" placeholder="비밀번호 (8자 이상, 영문과 숫자)" value={indepPw} onChange={(e) => setIndepPw(e.target.value)} />
                      <input className="auth-input" type="password" placeholder="비밀번호 확인" value={indepPw2} onChange={(e) => setIndepPw2(e.target.value)} />
                      <button type="submit" className="auth-btn" disabled={busy}>
                        {busy ? "확인 중…" : "인증 메일 보내기"}
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {children.length < max ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!busy) void add();
              }}
              style={cardStyle}
            >
              <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>자녀 추가</h3>
              <div className="auth-field">
                <label className="auth-label" htmlFor="cname">이름(별칭)</label>
                <input id="cname" className="auth-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="아이가 알아볼 이름" />
              </div>
              <div className="auth-field">
                <label className="auth-label" htmlFor="cyear">출생연도 <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(선택 — 독립할 때 필요)</span></label>
                <input id="cyear" className="auth-input" inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder={`${THIS_YEAR - 8}`} />
              </div>
              <div style={{ display: "grid", gap: 8, margin: "4px 0 14px", fontSize: 13 }}>
                <label style={rowStyle}>
                  <input type="checkbox" checked={guardian} onChange={(e) => setGuardian(e.target.checked)} />
                  <span>
                    법정대리인으로서 자녀의 개인정보 처리에 동의합니다 <strong style={{ color: "var(--accent-ink)" }}>필수</strong>
                    <span style={{ display: "block", color: "var(--text-dim)" }}>
                      자녀의 기록은 이 프로필에 쌓이고, 보호자가 삭제하면 즉시 폐기됩니다 →{" "}
                      <Link href="/legal/privacy">개인정보처리방침</Link>
                    </span>
                  </span>
                </label>
                <label style={rowStyle}>
                  <input type="checkbox" checked={health} onChange={(e) => setHealth(e.target.checked)} />
                  <span>건강정보 처리 동의 — FitLog 에서 자녀의 인바디·피검사를 기록할 때 <span style={{ color: "var(--text-dim)" }}>선택</span></span>
                </label>
                <label style={rowStyle}>
                  <input type="checkbox" checked={overseas} onChange={(e) => setOverseas(e.target.checked)} />
                  <span>개인정보 국외 이전 동의 — 사진 인식·AI 대화(OpenAI, 미국) <span style={{ color: "var(--text-dim)" }}>선택</span></span>
                </label>
              </div>
              <button type="submit" className="auth-btn" disabled={busy || !guardian || !name.trim()}>
                {busy ? "추가 중…" : "자녀 추가"}
              </button>
            </form>
          ) : (
            <p className="auth-hint">자녀 프로필은 {max}명까지 추가할 수 있어요.</p>
          )}

          {msg ? <p className="auth-msg">{msg}</p> : null}

          <div className="auth-links">
            <div>
              <Link href="/account/switch">프로필 전환</Link>
            </div>
            <div>
              <Link href="/">메인으로</Link>
            </div>
          </div>
        </>
      )}
    </AuthShell>
  );
}

const cardStyle: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "var(--surface)",
};

const rowStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  lineHeight: 1.5,
  cursor: "pointer",
};

const linkBtn: CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  font: "inherit",
  fontSize: 13,
  color: "var(--accent-ink)",
  textDecoration: "underline",
  cursor: "pointer",
};
