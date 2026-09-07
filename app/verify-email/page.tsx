"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { buildReturnUrl, getApp } from "@/lib/apps";

/**
 * 메일로 받은 인증 링크가 닿는 자리. `/verify-email?token=…`
 *
 * **로그인을 요구하지 않는다.** 메일은 다른 기기에서 열리는 일이 흔하고,
 * 여기서 로그인부터 시키면 인증하러 온 사람이 그 자리에서 막힌다.
 * 토큰이 곧 그 이메일함에 접근했다는 증거다 → app/api/auth/verify-email/route.ts
 *
 * 재발송만 세션이 필요하다. 남의 주소로 메일을 보낼 수 없어야 하기 때문이다.
 */

type Phase = "checking" | "done" | "failed" | "noToken";

function VerifyEmailBody() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const app = getApp(params.get("from"));
  const returnUrl = buildReturnUrl(app, params.get("next"));

  const [phase, setPhase] = useState<Phase>(token ? "checking" : "noToken");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  /*
    React 18 의 개발 모드는 이펙트를 두 번 실행한다. 토큰은 한 번 쓰면 폐기되므로
    그대로 두면 두 번째 호출이 "이미 사용된 링크"로 실패하고, 방금 인증한 사람이
    실패 화면을 본다. 한 번만 보내도록 잠근다.
  */
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;

    void (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          email?: string;
          error?: string;
        };
        if (!res.ok || !json.ok) {
          setMsg(json.error ?? "인증에 실패했습니다.");
          setPhase("failed");
          return;
        }
        setEmail(json.email ?? "");
        setPhase("done");
      } catch {
        setMsg("네트워크 오류입니다. 잠시 후 다시 시도해 주세요.");
        setPhase("failed");
      }
    })();
  }, [token]);

  // 재발송 쿨다운 카운트다운
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resend = useCallback(async () => {
    setResendBusy(true);
    setResendMsg(null);
    try {
      const res = await fetch("/api/auth/send-verification", { method: "POST" });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        retryAfterMs?: number;
        cooldownMs?: number;
        alreadyVerified?: boolean;
      };

      if (res.status === 401) {
        setResendMsg("로그인한 뒤에 다시 보낼 수 있어요.");
        return;
      }
      if (!res.ok || !json.ok) {
        if (json.retryAfterMs) setCooldown(Math.ceil(json.retryAfterMs / 1000));
        setResendMsg(json.error ?? "메일을 보내지 못했습니다.");
        return;
      }
      if (json.alreadyVerified) {
        setPhase("done");
        return;
      }
      setCooldown(Math.ceil((json.cooldownMs ?? 60000) / 1000));
      setResendMsg("인증 메일을 다시 보냈어요. 메일함을 확인해 주세요.");
    } catch {
      setResendMsg("네트워크 오류입니다.");
    } finally {
      setResendBusy(false);
    }
  }, []);

  const goHref = app ? returnUrl : "/";
  const goLabel = app ? `${app.name}${app.particle ?? "으로"} 돌아가기` : "메인으로";

  return (
    <AuthShell
      eyebrow="ONE MORE STEP"
      headline={
        <>
          메일 주소를
          <br />
          확인해요
        </>
      }
      storySub={
        <>
          비밀번호를 잊었을 때
          <br />이 주소로 다시 찾아요.
        </>
      }
      app={app}
      note={
        <>
          <strong>NOTE</strong>
          인증하지 않아도 로그인은 그대로 돼요.
          <br />
          다만 비밀번호를 잊었을 때 재설정 링크를 받으려면 인증이 필요해요.
        </>
      }
    >
      {phase === "checking" ? (
        <>
          <h2 className="auth-title">확인하고 있어요</h2>
          <p className="auth-sub">잠시만 기다려 주세요.</p>
        </>
      ) : null}

      {phase === "done" ? (
        <>
          <h2 className="auth-title">인증이 끝났어요</h2>
          <p className="auth-sub">
            {email ? `${email} 주소를 확인했어요.` : "이메일 주소를 확인했어요."}
          </p>
          <Link href={goHref} className="auth-btn" style={{ display: "block", textAlign: "center" }}>
            {goLabel}
          </Link>
        </>
      ) : null}

      {phase === "noToken" || phase === "failed" ? (
        <>
          <h2 className="auth-title">인증하지 못했어요</h2>
          <p className="auth-sub">
            {phase === "noToken"
              ? "인증 링크가 올바르지 않아요. 메일의 버튼을 다시 눌러 주세요."
              : msg}
          </p>

          <button
            type="button"
            className="auth-btn"
            onClick={() => void resend()}
            disabled={resendBusy || cooldown > 0}
          >
            {cooldown > 0
              ? `다시 보내기 (${cooldown}초)`
              : resendBusy
                ? "보내는 중…"
                : "인증 메일 다시 받기"}
          </button>

          {resendMsg ? <p className="auth-msg">{resendMsg}</p> : null}

          <div className="auth-links">
            <div>
              <Link href="/login">로그인</Link>
              {" · "}
              <Link href="/">메인으로</Link>
            </div>
          </div>
        </>
      ) : null}
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailBody />
    </Suspense>
  );
}
