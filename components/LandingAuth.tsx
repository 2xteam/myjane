"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearSession, loadSession, type SessionUser } from "@/lib/session";

/**
 * 랜딩에서 로그인 상태에 따라 갈리는 조각들.
 *
 * 세션은 클라이언트가 읽는 쿠키에 있어 서버 렌더 시점에는 알 수 없다.
 * 그래서 상태가 정해지기 전에는 **아무것도 그리지 않는다.**
 * 로그인한 사람에게 "로그인" 버튼이 한 번 스쳐 보이는 것보다 낫다.
 */
function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(loadSession());
    setReady(true);
  }, []);

  return { user, ready };
}

/** 우측 상단 — 로그아웃(로그인 시) / 로그인·회원가입(비로그인 시) */
export function HeaderAuth() {
  const { user, ready } = useSession();

  // 높이가 흔들리지 않게 자리만 잡아둔다
  if (!ready) return <span className="site-nav-placeholder" aria-hidden="true" />;

  if (user) {
    return (
      <button
        type="button"
        className="site-nav-logout"
        onClick={() => {
          clearSession();
          window.location.reload();
        }}
      >
        로그아웃
      </button>
    );
  }

  return (
    <>
      <Link href="/login">로그인</Link>
      <Link href="/signup" className="cta">
        회원가입
      </Link>
    </>
  );
}

/** 히어로 버튼 — 로그인 상태에서는 감춘다 */
export function HeroActions() {
  const { user, ready } = useSession();
  if (!ready || user) return null;

  return (
    <div className="btn-row">
      <Link href="/signup" className="btn btn-primary">
        지금 시작하기 <span className="arrow">→</span>
      </Link>
      <Link href="/login" className="btn btn-ghost">
        로그인
      </Link>
    </div>
  );
}

/** 마무리 회원가입 시트 — 로그인 상태에서는 통째로 감춘다 */
export function ClosingCta() {
  const { user, ready } = useSession();
  if (!ready || user) return null;

  return (
    <section className="sheet center">
      <p className="eyebrow">START</p>
      <h2 className="headline">첫 기록을 남겨볼까요?</h2>
      <p className="lead">가입은 전화번호와 PIN이면 돼요.</p>
      <div className="btn-row" style={{ justifyContent: "center" }}>
        <Link href="/signup" className="btn btn-primary">
          회원가입 <span className="arrow">→</span>
        </Link>
      </div>
    </section>
  );
}

/** 푸터 링크 — 로그인 상태에서는 로그아웃만 */
export function FooterAuth() {
  const { user, ready } = useSession();
  if (!ready) return null;

  if (user) {
    return (
      <button
        type="button"
        className="site-footer-logout"
        onClick={() => {
          clearSession();
          window.location.reload();
        }}
      >
        로그아웃
      </button>
    );
  }

  return (
    <>
      <Link href="/login">로그인</Link> · <Link href="/signup">회원가입</Link>
    </>
  );
}
