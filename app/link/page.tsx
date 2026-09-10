import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ScrollProgress } from "@/components/ScrollProgress";

export const metadata: Metadata = {
  title: "myjane 링크",
  description: "myjane 에서 만든 기록 서비스들의 주소. SNS 프로필 링크에서 열립니다.",
  robots: { index: false },
};

/**
 * `/link` — SNS 프로필에 걸어 두는 **링크 모음 한 장** (2026-09-09).
 *
 * 인스타그램 게시글 본문에는 링크를 넣을 수 없다. 그래서 프로필의 링크 하나만 이 주소로 두고,
 * 게시글에는 "프로필의 링크 확인" 이라고 적는다. 여기서 각 서비스의 **소개 페이지**로 보낸다
 * (`/home` 이 아니다 — 처음 온 사람은 로그인 전이다).
 *
 * 순서는 그때 홍보하는 서비스를 맨 위에 둔다. 지금은 TypeLog(러너 16유형 게시글).
 * 한 제품처럼 묶어 소개하지 않는다 — 각자 한 줄씩, 계정만 공유한다는 말은 아래 한 줄로만
 * → my-obsidian-vault / 20-Design/서비스 카테고리와 카피 원칙.md · 30-Patterns/SNS 소개 카드와 게시글.md
 */
const LINKS = [
  {
    name: "TypeLog",
    role: "성향 기록",
    href: "https://typelog.myjane.co.kr",
    domain: "typelog.myjane.co.kr",
    icon: "/typelog-icon.png",
    desc: "질문에 답하면 나와 가까운 타입이 나와요. 러너 16유형도 있어요. 다시 하면 그 변화가 쌓여요.",
  },
  {
    name: "FitLog",
    role: "건강 기록",
    href: "https://fitlog.myjane.co.kr",
    domain: "fitlog.myjane.co.kr",
    icon: "/fitlog-icon.png",
    desc: "인바디·피검사 결과지를 찍으면 항목을 읽어 날짜별로 쌓고, 벗어난 수치에 근거 있는 권장사항을 붙여요.",
  },
  {
    name: "SnapWord",
    role: "공부 기록",
    href: "https://snapword.myjane.co.kr",
    domain: "snapword.myjane.co.kr",
    icon: "/snapword-icon.png",
    desc: "교재나 화면을 찍으면 단어와 뜻을 뽑아 단어장으로. 테스트까지 이어져요.",
  },
  {
    name: "SnapNote",
    role: "공부 기록",
    href: "https://snapnote.myjane.co.kr",
    domain: "snapnote.myjane.co.kr",
    icon: "/snapnote-icon.png",
    desc: "틀린 문제를 찍어 모노톤으로 정리한 나만의 오답노트. 폴더로 묶고 인쇄해요.",
  },
  {
    name: "2hbk",
    role: "습관 기록",
    href: "https://2hbk.myjane.co.kr",
    domain: "2hbk.myjane.co.kr",
    icon: "/2hbk-icon.png",
    desc: "목표에 스티커를 모아 채워요. 혼자 해도, 친구와 같이 해도 돼요.",
  },
] as const;

export default function LinkPage() {
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
          메인으로 →
        </Link>
        <ScrollProgress />
      </header>

      <main className="legal-sheets" style={{ marginTop: 28 }}>
        <section className="sheet">
          <p className="eyebrow">LINKS</p>
          <h1 className="headline" style={{ fontSize: "clamp(1.6rem, 4.5vw, 2.2rem)" }}>
            필요한 기록만, 골라서
          </h1>
          <p className="lead">myjane 에서 만든 기록 서비스들이에요. 하나만 써도 충분해요.</p>

          <ul style={{ listStyle: "none", padding: 0, margin: "22px 0 0", display: "grid", gap: 12 }}>
            {LINKS.map((l) => (
              <li key={l.name}>
                <a
                  href={l.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "16px 18px",
                    borderRadius: 18,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--text)",
                    textDecoration: "none",
                  }}
                >
                  <Image src={l.icon} alt="" width={48} height={48} style={{ borderRadius: 12, flex: "0 0 auto" }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "1.02rem" }}>{l.name}</strong>
                      <span style={{ fontSize: "0.78rem", color: "var(--accent-ink)", fontWeight: 700 }}>{l.role}</span>
                    </span>
                    <span style={{ display: "block", marginTop: 4, fontSize: "0.86rem", lineHeight: 1.55, color: "var(--text-dim)" }}>
                      {l.desc}
                    </span>
                    <span style={{ display: "block", marginTop: 6, fontSize: "0.76rem", color: "var(--text-dim)", fontVariantNumeric: "tabular-nums" }}>
                      {l.domain}
                    </span>
                  </span>
                  <span aria-hidden="true" style={{ color: "var(--text-dim)" }}>
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>

          <p className="lead" style={{ marginTop: 26, fontSize: "0.9rem" }}>
            계정만 공유해요. 기록과 데이터는 서비스마다 따로 쌓이고, 쓰지 않는 서비스는 열지 않아도 돼요.
          </p>
          <p style={{ marginTop: 10, fontSize: "0.82rem" }}>
            <Link href="/legal/privacy">개인정보처리방침</Link> · <Link href="/legal/terms">이용약관</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
