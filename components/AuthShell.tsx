import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type { AppInfo } from "@/lib/apps";

/**
 * 인증 화면의 공통 껍데기.
 *
 * 결쩜사(kyulzzumsa.co.kr) 로그인 페이지 구성을 따른다.
 *   ← 메인으로 → 영문 eyebrow → 줄바꿈을 설계한 헤드라인 → 서브카피 → 카드
 * 색은 myjane 팔레트(남색 + 앰버).
 */
export function AuthShell({
  eyebrow,
  headline,
  sub,
  app,
  children,
  note,
}: {
  /** 영문 대문자 라벨 */
  eyebrow: string;
  /** 2~3줄로 끊어 쓴 헤드라인 */
  headline: ReactNode;
  sub: ReactNode;
  /** 어느 앱에서 왔는지 (있으면 배지로 표시) */
  app?: AppInfo | null;
  children: ReactNode;
  note?: ReactNode;
}) {
  return (
    <main className="auth">
      <div className="auth-inner">
        <Link href="/" className="auth-back">
          ← 메인으로
        </Link>

        <p className="auth-eyebrow">{eyebrow}</p>
        <h1 className="auth-headline">{headline}</h1>
        <p className="auth-sub">{sub}</p>

        <div className="auth-card">
          {app ? (
            <div className="auth-app">
              <Image src={app.icon} alt="" width={22} height={22} />
              <span>
                <strong>{app.name}</strong>으로 계속하기
              </span>
            </div>
          ) : null}
          {children}
        </div>

        {note ? <div className="auth-note">{note}</div> : null}
      </div>
    </main>
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
