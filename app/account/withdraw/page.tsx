"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import { AuthShell } from "@/components/AuthShell";
import { clearSession, loadSession } from "@/lib/session";

/**
 * 회원 탈퇴 화면. **포털에만 있다.**
 *
 * 탈퇴는 여섯 서비스 공통이라 화면도 한 곳이라야 한다. 여섯 앱에 각각 두면
 * "여기서 탈퇴하면 여섯 곳이 다 닫힙니다" 를 여섯 번 다르게 쓰게 되고,
 * 한 곳만 고치면 갈라진다. 앱들은 my 화면에서 이 주소 링크만 보여 준다
 * → 각 앱 lib/portal.ts 의 withdrawUrl()
 *
 * 계정을 지우지 않고 표시만 남긴다. 방침 5항에 "6개월 보관한 뒤 폐기하고
 * 그 안에는 되살릴 수 있다" 고 적었다 → lib/accountLifecycle.ts
 *
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */

const CONFIRM_PHRASE = "탈퇴합니다";

type Status = {
  withdrawn: boolean;
  purgeAt: string | null;
  restoreDaysLeft: number | null;
  canRestore: boolean;
  verifyWith: "password" | "pin" | "none";
};

export default function WithdrawPage() {
  return (
    <Suspense fallback={null}>
      <WithdrawInner />
    </Suspense>
  );
}

function WithdrawInner() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status | null>(null);
  const [secret, setSecret] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState<{ purgeAt: string | null } | null>(null);
  /* 확인 메일을 보낸 뒤 — 아직 탈퇴된 것이 아니다 */
  const [sentTo, setSentTo] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/withdraw");
      const json = (await res.json()) as Status & { ok: boolean; error?: string };
      if (!json.ok) {
        setMsg(json.error ?? "상태를 불러오지 못했어요.");
        return;
      }
      setStatus(json);
    } catch {
      setMsg("상태를 불러오지 못했어요.");
    }
  }, []);

  /* 메일 링크로 들어왔다 — 세션이 없어도 토큰만으로 확정한다 */
  const confirmToken = useCallback(async (t: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/account/withdraw", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: t }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; purgeAt?: string };
      if (!json.ok) {
        setMsg(json.error ?? "확인에 실패했어요.");
        return;
      }
      clearSession();
      setDone({ purgeAt: json.purgeAt ?? null });
    } catch {
      setMsg("확인에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      void confirmToken(token);
      return;
    }
    /* 로그인하지 않았으면 부르지 않는다 — 401 만 늘어난다 */
    if (!loadSession()) {
      setMsg("로그인이 필요해요.");
      return;
    }
    void load();
  }, [token, confirmToken, load]);

  const submit = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/withdraw", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret, confirm }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        purgeAt?: string;
        needsEmailConfirm?: boolean;
        email?: string;
      };
      if (!json.ok) {
        setMsg(json.error ?? "탈퇴 처리에 실패했어요.");
        return;
      }
      /*
        메일을 보냈을 뿐 아직 닫히지 않았다. 세션을 지우면 안 된다 —
        링크를 누르기 전에 마음이 바뀔 수 있고, 그때 되돌아올 자리가 없어진다.
      */
      if (json.needsEmailConfirm) {
        setSentTo(json.email ?? null);
        return;
      }
      /*
        공유 쿠키를 지운다. 이걸 안 하면 여섯 앱이 30일짜리 쿠키로 계속
        열려 있는 것처럼 보인다 — 서버는 막지만 화면이 어긋난다.
      */
      clearSession();
      setDone({ purgeAt: json.purgeAt ?? null });
    } catch {
      setMsg("탈퇴 처리에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }, [secret, confirm]);

  const restore = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/withdraw", { method: "DELETE" });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setMsg(json.error ?? "복구에 실패했어요.");
        return;
      }
      setMsg("계정을 되살렸어요. 다시 이용하실 수 있습니다.");
      await load();
    } catch {
      setMsg("복구에 실패했어요.");
    } finally {
      setBusy(false);
    }
  }, [load]);

  if (sentTo) {
    return (
      <AuthShell
        eyebrow="ACCOUNT · 탈퇴"
        headline={<>확인 메일을 보냈어요</>}
        storySub={<>아직 탈퇴되지 않았습니다.</>}
      >
        <p style={bodyStyle}>
          <strong>{sentTo}</strong> 로 확인 메일을 보냈어요. 메일의 링크를 누르면
          탈퇴가 완료됩니다. 링크는 <strong>30분</strong> 동안 유효해요.
        </p>
        <p style={bodyStyle}>
          메일이 오지 않으면 스팸함을 확인해 주세요. 링크를 누르지 않으시면
          계정은 그대로 유지됩니다.
        </p>
        <div className="auth-links">
          <Link href="/">돌아가기</Link>
        </div>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell
        eyebrow="ACCOUNT · 탈퇴"
        headline={<>탈퇴 처리됐어요</>}
        storySub={<>그동안 이용해 주셔서 고맙습니다.</>}
      >
        <p style={bodyStyle}>
          기록은 <strong>6개월 동안 보관한 뒤 폐기</strong>합니다.
          {done.purgeAt ? ` (${done.purgeAt.slice(0, 10)} 폐기 예정)` : null}
        </p>
        <p style={bodyStyle}>
          그 안에 마음이 바뀌시면 <Link href="/login">로그인</Link> 화면에서 되살릴
          수 있어요.
        </p>
      </AuthShell>
    );
  }

  if (status?.withdrawn) {
    return (
      <AuthShell
        eyebrow="ACCOUNT · 탈퇴"
        headline={<>이미 탈퇴한 계정이에요</>}
        storySub={<>되살리면 여섯 서비스를 다시 쓰실 수 있습니다.</>}
      >
        <p style={bodyStyle}>
          {status.canRestore ? (
            <>
              되살릴 수 있는 기간이 <strong>{status.restoreDaysLeft}일</strong>{" "}
              남았어요.
            </>
          ) : (
            <>되살릴 수 있는 기간이 지났습니다.</>
          )}
        </p>
        {status.canRestore ? (
          <button
            type="button"
            className="auth-btn"
            onClick={restore}
            disabled={busy}
          >
            {busy ? "처리 중…" : "계정 되살리기"}
          </button>
        ) : null}
        {msg ? <p className="auth-msg">{msg}</p> : null}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="ACCOUNT · 탈퇴"
      headline={<>정말 탈퇴하시겠어요?</>}
      storySub={<>탈퇴는 여섯 서비스에 함께 적용됩니다.</>}
    >
      <div style={warnStyle}>
        <p style={{ margin: "0 0 8px", fontWeight: 700, color: "var(--danger-ink)" }}>
          탈퇴하면 이렇게 됩니다
        </p>
        <ul style={listStyle}>
          <li>
            <strong>여섯 서비스가 함께 닫힙니다</strong> — myjane · SnapWord ·
            SnapNote · FitLog · 2hbk · TypeLog. 계정이 하나이기 때문입니다
          </li>
          <li>
            단어장·오답노트·인바디와 피검사 기록·목표와 스티커·질문지 응답을 더
            이상 보실 수 없습니다
          </li>
          <li>
            기록은 <strong>6개월 동안 보관한 뒤 폐기</strong>합니다. 그 안에는
            로그인 화면에서 되살릴 수 있어요
          </li>
        </ul>
      </div>

      {status?.verifyWith !== "none" ? (
        <div className="auth-field">
          <label className="auth-label" htmlFor="secret">
            {status?.verifyWith === "pin" ? "PIN" : "비밀번호"} 확인
          </label>
          <input
            id="secret"
            className="auth-input"
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoComplete="current-password"
          />
        </div>
      ) : null}

      <div className="auth-field">
        <label className="auth-label" htmlFor="confirm">
          확인을 위해 <strong>{CONFIRM_PHRASE}</strong> 를 입력해 주세요
        </label>
        <input
          id="confirm"
          className="auth-input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={CONFIRM_PHRASE}
        />
      </div>

      <button
        type="button"
        className="auth-btn"
        onClick={submit}
        disabled={busy || confirm.trim() !== CONFIRM_PHRASE}
      >
        {busy ? "처리 중…" : "탈퇴하기"}
      </button>

      {msg ? <p className="auth-msg">{msg}</p> : null}

      <div className="auth-links">
        <Link href="/">돌아가기</Link>
      </div>
    </AuthShell>
  );
}

const bodyStyle: CSSProperties = {
  margin: "0 0 10px",
  fontSize: "0.88rem",
  lineHeight: 1.8,
  color: "var(--text-dim)",
  wordBreak: "keep-all",
};

const warnStyle: CSSProperties = {
  margin: "0 0 18px",
  padding: "14px 16px",
  border: "1px solid var(--danger-subtle)",
  borderRadius: "var(--radius-sm)",
  background: "var(--danger-subtle)",
};

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: "1.05rem",
  fontSize: "0.8rem",
  lineHeight: 1.75,
  color: "var(--text)",
  wordBreak: "keep-all",
};
