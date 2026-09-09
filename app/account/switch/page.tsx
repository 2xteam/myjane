"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { ProfilePicker, type Profile } from "@/components/ProfilePicker";
import { buildReturnUrl, getApp } from "@/lib/apps";
import { hasUsableSession, saveSession, type SessionUser } from "@/lib/session";

/**
 * 프로필 전환 — 로그인한 상태에서 본인 ↔ 자녀를 바꾼다.
 * 자녀 세션에서 보호자로 돌아갈 때는 보호자 비밀번호를 다시 받는다 (`/api/auth/switch`).
 * 앱에서 `?from=<앱>&next=<경로>` 로 오면 바꾼 뒤 그 앱으로 돌려보낸다.
 */
function SwitchForm() {
  const params = useSearchParams();
  const app = getApp(params.get("from"));
  const returnUrl = buildReturnUrl(app, params.get("next"));

  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [isChild, setIsChild] = useState(false);
  const [target, setTarget] = useState<Profile | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!hasUsableSession()) {
      window.location.replace("/login?next=" + encodeURIComponent("/account/switch"));
      return;
    }
    void (async () => {
      const res = await fetch("/api/auth/switch");
      const json = (await res.json()) as { ok: boolean; profiles?: Profile[]; current?: string; isChild?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setMsg(json.error ?? "프로필을 불러오지 못했어요.");
        setProfiles([]);
        return;
      }
      setProfiles(json.profiles ?? []);
      setCurrent(json.current ?? null);
      setIsChild(Boolean(json.isChild));
    })();
  }, []);

  const doSwitch = useCallback(
    async (p: Profile, pw?: string) => {
      setBusy(true);
      setMsg(null);
      try {
        const res = await fetch("/api/auth/switch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ profileId: p.id, ...(pw ? { password: pw } : {}) }),
        });
        const json = (await res.json()) as { ok: boolean; user?: SessionUser; needsPassword?: boolean; error?: string };
        if (json.needsPassword) {
          setTarget(p);
          if (pw) setMsg(json.error ?? "비밀번호가 올바르지 않습니다.");
          return;
        }
        if (!res.ok || !json.ok || !json.user) {
          setMsg(json.error ?? "전환에 실패했습니다.");
          return;
        }
        saveSession(json.user);
        window.location.href = app ? returnUrl : "/";
      } catch {
        setMsg("네트워크 오류입니다.");
      } finally {
        setBusy(false);
      }
    },
    [app, returnUrl],
  );

  return (
    <AuthShell
      eyebrow="WHO IS HERE"
      headline={
        <>
          누구의 기록을
          <br />
          볼까요?
        </>
      }
      storySub={
        <>
          한 계정 안의 프로필을
          <br />
          바꿔서 들어갑니다.
        </>
      }
      app={app}
      note={
        <>
          <strong>NOTE</strong>
          자녀 프로필에서 보호자로 돌아올 때는
          <br />
          보호자 비밀번호를 한 번 더 확인해요.
        </>
      }
    >
      <h2 className="auth-title">프로필 전환</h2>
      {profiles === null ? (
        <p className="auth-sub">불러오는 중…</p>
      ) : profiles.length <= 1 ? (
        <>
          <p className="auth-sub">전환할 프로필이 없어요. 자녀를 추가하면 여기서 고를 수 있습니다.</p>
          <div className="auth-links">
            <Link href="/account/children">자녀 관리</Link>
          </div>
        </>
      ) : (
        <>
          <ProfilePicker profiles={profiles} current={current} busy={busy} onPick={(p) => void doSwitch(p)} />
          {target ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!busy) void doSwitch(target, password);
              }}
              style={{ marginTop: 16 }}
            >
              <div className="auth-field">
                <label className="auth-label" htmlFor="gpw">
                  보호자 비밀번호 — <strong>{target.name}</strong> 프로필로 바꾸려면
                </label>
                <input
                  id="gpw"
                  className="auth-input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
              </div>
              <button type="submit" className="auth-btn" disabled={busy}>
                {busy ? "확인 중…" : "전환"}
              </button>
            </form>
          ) : null}
          {msg ? <p className="auth-msg">{msg}</p> : null}
          <div className="auth-links">
            {!isChild ? (
              <div>
                <Link href="/account/children">자녀 관리</Link>
              </div>
            ) : null}
            <div>
              <Link href="/">메인으로</Link>
            </div>
          </div>
        </>
      )}
    </AuthShell>
  );
}

export default function SwitchPage() {
  return (
    <Suspense fallback={null}>
      <SwitchForm />
    </Suspense>
  );
}
