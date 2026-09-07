"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { loadSession } from "@/lib/session";

/**
 * 이메일이 없거나 아직 인증되지 않은 사람에게 띄우는 **포털의 안내 띠**.
 *
 * ⚠️ 로그인을 막지 않는다. 화면을 가리지도 않는다. 아래에 띠 하나로 붙고,
 * "나중에" 를 누르면 하루 뒤에 다시 묻는다
 * → app/api/auth/email-prompt/route.ts
 *
 * ⚠️ **여기(포털)에만 둔다.** 여섯 앱이 각자 물으면 같은 사람에게 여섯 번 묻는다.
 * 다섯 앱은 자기 배너에서 이 포털의 `/account/email` 링크만 보여 준다.
 *
 * 상태가 정해지기 전에는 **아무것도 그리지 않는다.** 로그인한 사람에게 띠가
 * 한 번 스쳐 보이는 것보다 낫다 — `LandingAuth.tsx` 와 같은 원칙이다.
 */

const HIDE_ON = ["/login", "/signup", "/verify-email", "/account/email", "/admin"];

type State = "missing" | "pending" | "unverified" | null;

export function EmailPrompt() {
  const pathname = usePathname();
  const [state, setState] = useState<State>(null);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const muted = HIDE_ON.some((p) => pathname === p || pathname.startsWith(p + "/"));

  useEffect(() => {
    if (muted) return;
    /*
      로그인하지 않았으면 **묻지도 않는다.** 랜딩은 공개 화면이라 대부분의
      방문자가 익명이고, 그때마다 401 한 번씩을 부르면 콘솔만 시끄럽고
      요청도 낭비다. 쿠키를 믿어서가 아니라 **부를 필요가 없어서** 거른다 —
      실제 판단은 서명 토큰을 보는 서버가 한다.
    */
    if (!loadSession()) return;

    let alive = true;

    void (async () => {
      try {
        const res = await fetch("/api/auth/email-prompt");
        // 401 = 로그인하지 않은 사람. 안내할 것이 없다
        if (!res.ok) return;
        const json = (await res.json()) as { ok: boolean; state: State; show: boolean };
        if (!alive || !json.ok || !json.show) return;
        setState(json.state);
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

  const later = () => {
    setDismissed(true);
    // 서버에 하루 미뤄 둔다. 기기를 바꿔도 유지된다
    void fetch("/api/auth/email-prompt", { method: "POST" }).catch(() => {});
  };

  const text =
    state === "missing"
      ? "이메일을 등록해 두면 비밀번호를 잊어도 되찾을 수 있어요."
      : "이메일 인증이 아직 남아 있어요. 메일함을 확인해 주세요.";

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
      <span style={{ flex: "1 1 240px", lineHeight: 1.5 }}>{text}</span>

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
        {state === "missing" ? "이메일 등록하기" : "인증 마치기"}
      </Link>

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
