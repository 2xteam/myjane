"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { loadSession } from "@/lib/session";

/**
 * 비밀번호를 바꾼 지 오래된 사람에게 띄우는 **포털의 안내 띠**.
 *
 * ⚠️ **강제하지 않는다.** 주기적 강제 변경은 NIST SP 800-63B 가 권장하지 않는다 —
 * 사람이 `pw1!` → `pw2!` 로 바꿔서 오히려 약해진다. 그래서 바꾸거나 미루거나를
 * 본인이 고른다. "3개월 연장" 을 누르면 3개월 뒤에 다시 묻는다
 * → app/api/auth/password-prompt/route.ts
 *
 * ⚠️ **여기(포털)에만 둔다.** 여섯 앱이 각자 물으면 같은 사람에게 여섯 번 묻는다.
 * `EmailPrompt.tsx` 와 같은 원칙이고 모양도 같다.
 *
 * 이메일 안내와 **함께 뜨지 않게** 한다 — 띠가 둘이면 화면 아래가 막힌다.
 * 이메일 쪽이 먼저다(비밀번호를 잊었을 때 되찾을 길이 그쪽이라 더 급하다).
 */

const HIDE_ON = ["/login", "/signup", "/verify-email", "/account", "/admin"];

export function PasswordPrompt() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [ageDays, setAgeDays] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const muted = HIDE_ON.some((p) => pathname === p || pathname.startsWith(p + "/"));

  useEffect(() => {
    if (muted) return;
    /* 로그인하지 않았으면 묻지도 않는다 — 401 만 늘어난다 */
    if (!loadSession()) return;

    let alive = true;

    void (async () => {
      try {
        /*
          이메일 안내가 뜰 상황이면 이쪽은 접는다. 띠를 둘 겹치지 않는다.
          이메일이 더 급하다 — 비밀번호를 잊었을 때 되찾을 길이 그쪽이다.
        */
        const emailRes = await fetch("/api/auth/email-prompt");
        if (emailRes.ok) {
          const e = (await emailRes.json()) as { ok: boolean; show: boolean };
          if (e.ok && e.show) return;
        }

        const res = await fetch("/api/auth/password-prompt");
        if (!res.ok) return;
        const json = (await res.json()) as {
          ok: boolean;
          show: boolean;
          ageDays: number | null;
        };
        if (!alive || !json.ok || !json.show) return;
        setAgeDays(json.ageDays);
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

  const extend = () => {
    setDismissed(true);
    /* 서버에 3개월 미뤄 둔다. 기기를 바꿔도 유지된다 */
    void fetch("/api/auth/password-prompt", { method: "POST" }).catch(() => {});
  };

  const months = ageDays !== null ? Math.floor(ageDays / 30) : null;

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
        {months !== null
          ? `비밀번호를 바꾸신 지 ${months}개월이 지났어요.`
          : "비밀번호를 바꾸신 지 오래됐어요."}{" "}
        새로 정해 두시겠어요?
      </span>

      <Link
        href="/account/email"
        style={{
          padding: "8px 16px",
          borderRadius: 10,
          background: "var(--accent)",
          color: "var(--on-accent)",
          fontWeight: 700,
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        변경하기
      </Link>

      <button
        type="button"
        onClick={extend}
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
        3개월 연장
      </button>
    </div>
  );
}
