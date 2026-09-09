"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { hasUsableSession } from "@/lib/session";

/**
 * 방침·약관이 개정됐을 때 아직 새 판을 확인하지 않은 회원에게 띄우는 **포털의 안내 띠**.
 *
 * `EmailPrompt` 와 같은 모양이다. 로그인을 막지 않고, 화면을 가리지 않는다.
 * "확인했어요" 를 누르면 `users.agreedPolicyVersion` 이 현재 판으로 올라가 다시 뜨지 않는다.
 * "나중에" 는 이 브라우저 세션에서만 접는다 — 개정 안내는 결국 한 번은 봐야 한다.
 *
 * 이메일 안내가 뜰 상황이면 그쪽이 먼저다(비밀번호를 되찾을 길이 그쪽). 띠가 둘이면
 * 화면 아래가 막히므로 이메일 안내가 있을 때는 스스로 접는다 — PasswordPrompt 와 같은 규칙.
 * → app/api/auth/policy-prompt/route.ts · 50-Plans/E 개인정보 보호 보강.md 10번
 */

const HIDE_ON = ["/login", "/signup", "/verify-email", "/legal", "/admin", "/account/consent"];
const DISMISS_KEY = "myjane_policy_prompt_dismissed";

export function PolicyPrompt() {
  const pathname = usePathname();
  const [version, setVersion] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const muted = HIDE_ON.some((p) => pathname === p || pathname.startsWith(p + "/"));

  useEffect(() => {
    if (muted) return;
    if (!hasUsableSession()) return;
    try {
      if (window.sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* ignore */
    }

    let alive = true;
    void (async () => {
      try {
        /* 이메일 안내가 뜰 상황이면 양보한다 */
        const email = await fetch("/api/auth/email-prompt");
        if (email.ok) {
          const e = (await email.json()) as { ok: boolean; show: boolean };
          if (e.ok && e.show) return;
        }
        const res = await fetch("/api/auth/policy-prompt");
        if (!res.ok) return;
        const json = (await res.json()) as { ok: boolean; show: boolean; version: string };
        if (!alive || !json.ok || !json.show) return;
        setVersion(json.version);
        setShow(true);
      } catch {
        /* 안내는 부가 기능이다. 실패하면 조용히 없던 일로 둔다 */
      }
    })();
    return () => {
      alive = false;
    };
  }, [muted, pathname]);

  if (muted || !show || dismissed) return null;

  const confirm = () => {
    setDismissed(true);
    void fetch("/api/auth/policy-prompt", { method: "POST" }).catch(() => {});
  };
  const later = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="status"
      style={{
        position: "sticky",
        bottom: 0,
        zIndex: 40,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        background: "var(--surface)",
        borderTop: "1px solid var(--border-strong)",
        boxShadow: "0 -4px 16px rgba(var(--shadow-rgb), 0.08)",
        fontSize: 14,
        color: "var(--text)",
      }}
    >
      <span style={{ flex: "1 1 240px", lineHeight: 1.5 }}>
        개인정보처리방침과 이용약관이 {version} 에 개정됐어요. 보관 기간과 안전조치를
        구체적으로 적었습니다.{" "}
        <Link href="/legal/privacy" style={{ color: "var(--accent-ink)", fontWeight: 700 }}>
          바뀐 내용 보기
        </Link>
      </span>

      <button
        type="button"
        onClick={confirm}
        style={{
          padding: "8px 16px",
          borderRadius: 10,
          background: "var(--accent)",
          color: "var(--on-accent)",
          fontWeight: 700,
          border: "none",
          font: "inherit",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        확인했어요
      </button>

      <button
        type="button"
        onClick={later}
        style={{
          background: "none",
          border: "none",
          padding: "8px 4px",
          font: "inherit",
          color: "var(--text-dim)",
          textDecoration: "underline",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        나중에
      </button>
    </div>
  );
}
