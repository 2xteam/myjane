import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ScrollProgress } from "@/components/ScrollProgress";

/**
 * 법적 페이지 껍데기 — 개인정보처리방침 · 이용약관 · 쿠키 안내가 함께 쓴다.
 *
 * 세 페이지는 여섯 앱이 공유하는 문서라 포털(myjane)에 한 벌만 둔다.
 * 각 앱 푸터의 링크가 여기로 온다 → components/SiteFooter.tsx (다섯 앱 복사본)
 *
 * 랜딩과 같은 시트 구조(eyebrow → headline → 본문)를 쓰되 폭만
 * `--content-reading`(760px)으로 좁힌다 → app/globals.css 의 `.legal-*`
 * 근거: my-obsidian-vault → 50-Plans/C 법적 페이지.md
 */

export const LEGAL_PAGES = [
  { href: "/legal/privacy", label: "개인정보처리방침" },
  { href: "/legal/terms", label: "이용약관" },
  { href: "/legal/cookies", label: "쿠키·로컬 저장소 안내" },
] as const;

/**
 * 아직 정하지 않은 값. 공개 전에 사람이 채워야 하는 자리다.
 *
 * ⚠️ 이 표시가 하나라도 남아 있으면 **공개하면 안 된다.**
 * 보관 기간·법적 근거·사업자 정보처럼 코드에서 알아낼 수 없는 값이라
 * 초안 단계에서 추측으로 채우지 않고 눈에 걸리게 남겨 둔다.
 */
export function Todo({ children }: { children: ReactNode }) {
  return <span className="legal-todo">확인 필요 — {children}</span>;
}

export function LegalShell({
  current,
  eyebrow,
  headline,
  lead,
  updated,
  children,
}: {
  /** 지금 보고 있는 페이지의 경로 — 탭에서 표시된다 */
  current: (typeof LEGAL_PAGES)[number]["href"];
  eyebrow: string;
  headline: ReactNode;
  lead: ReactNode;
  /** 최종 개정일. 초안 동안은 작성일이다 */
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="legal">
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

      {/*
        초안 알림. 법률 검토를 받기 전이라는 사실을 읽는 사람에게 먼저 알린다.
        검토가 끝나면 이 블록을 지운다.
      */}
      <div className="legal-draft">
        <p>
          <strong>초안입니다.</strong> 아직 법률 검토를 받지 않았습니다. 본문에
          «확인 필요» 로 표시된 항목은 확정되지 않은 내용이며, 검토를 마친 뒤
          이 알림과 함께 정리됩니다.
        </p>
      </div>

      <nav className="legal-tabs" aria-label="법적 고지">
        {LEGAL_PAGES.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            aria-current={p.href === current ? "page" : undefined}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      <main className="legal-sheets">
        <section className="sheet">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="headline">{headline}</h1>
          <p className="lead">{lead}</p>
          <p className="legal-updated">최종 개정일 {updated}</p>
        </section>

        {children}
      </main>

      <footer className="site-footer">
        <div className="site-footer-brand">
          <Image src="/myjane-icon.png" alt="" width={24} height={24} />
          <span className="brand-word">
            my<span>jane</span>
          </span>
        </div>
        <div className="site-footer-legal">
          {LEGAL_PAGES.map((p) => (
            <Link key={p.href} href={p.href}>
              {p.label}
            </Link>
          ))}
        </div>
        <div>© {new Date().getFullYear()} myjane. All rights reserved.</div>
      </footer>
    </div>
  );
}

/** 시트 하나 — 본문 덩어리를 담는다. 배경은 흰색과 옅은 청록을 번갈아 쓴다 */
export function LegalSection({
  tint,
  title,
  children,
}: {
  tint?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={tint ? "sheet sheet--tint" : "sheet"}>
      <h2 className="headline" style={{ fontSize: "1.28rem", marginBottom: 4 }}>
        {title}
      </h2>
      <div className="legal-body">{children}</div>
    </section>
  );
}
