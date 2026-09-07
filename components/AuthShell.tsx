import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type { AppInfo } from "@/lib/apps";
import { ScrollProgress } from "@/components/ScrollProgress";

/**
 * 인증 화면 껍데기.
 *
 * 결쩜사(kyulzzumsa.co.kr) 로그인 페이지 구성을 실제 렌더링 기준으로 옮겼다.
 *   데스크톱: 어두운 스토리 패널 + 흰 폼 카드가 한 덩어리로 붙는다
 *   모바일  : 스토리 패널이 위, 폼 카드가 아래
 */
export function AuthShell({
  eyebrow,
  headline,
  storySub,
  app,
  children,
  note,
}: {
  /** 스토리 패널의 금색 영문 라벨 */
  eyebrow: string;
  /** 스토리 패널의 헤드라인 — 줄바꿈 위치까지 설계 대상 */
  headline: ReactNode;
  storySub: ReactNode;
  app?: AppInfo | null;
  children: ReactNode;
  note?: ReactNode;
}) {
  return (
    <>
      <header className="auth-topbar">
        <Link href="/" className="auth-brand">
          <Image src="/myjane-icon.png" alt="" width={26} height={26} />
          <span className="brand-word">
            my<span>jane</span>
          </span>
        </Link>
        <Link href="/" className="auth-home">
          ← 메인으로
        </Link>
        {/* 스크롤 진행 띠 — 헤더가 sticky 라서 그 아래 변에 붙는다.
            루트 페이지에만 두면 페이지마다 껍데기가 달라 보인다 */}
        <ScrollProgress />
      </header>

      <main className="auth">
        <div className="auth-shell">
          <aside className="auth-story">
            <div className="auth-story-body">
              <p className="auth-eyebrow">{eyebrow}</p>
              <h1 className="auth-headline">{headline}</h1>
              <p className="auth-story-sub">{storySub}</p>
            </div>
          </aside>

          <section className="auth-card">
            {app ? (
              <div className="auth-app">
                <Image src={app.icon} alt="" width={20} height={20} />
                <span>
                  {app.name}
                  {app.particle ?? "으로"} 계속하기
                </span>
              </div>
            ) : null}

            {children}
          </section>
        </div>

        {note ? <div className="auth-note">{note}</div> : null}
      </main>
    </>
  );
}

/** 로그인 ↔ 회원가입 탭 */
export function AuthTabs({
  current,
  qs,
}: {
  current: "login" | "signup";
  qs: string;
}) {
  const href = (p: string) => (qs ? `${p}?${qs}` : p);
  return (
    <nav className="auth-tabs">
      <Link
        href={href("/login")}
        className="auth-tab"
        aria-current={current === "login" ? "page" : undefined}
      >
        로그인
      </Link>
      <Link
        href={href("/signup")}
        className="auth-tab"
        aria-current={current === "signup" ? "page" : undefined}
      >
        회원가입
      </Link>
    </nav>
  );
}
