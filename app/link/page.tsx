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
 * 게시글에는 "프로필의 링크 확인" 이라고 적는다.
 *
 * **두 칸으로 나뉜다** (2026-09-10).
 *
 * | 위 | `SHARES` — 그때 나누고 있는 링크. 게시글마다 바뀐다. **비우면 시트가 사라진다** |
 * | 아래 | `LINKS` — 앱 소개 링크. 여섯 서비스. **순서도 내용도 그대로 둔다** (새 서비스는 끝에 붙인다) |
 *
 * 위 칸이 생기기 전에는 홍보하는 서비스를 `LINKS` 맨 위로 올렸다. **이제 순서를
 * 홍보에 맞춰 바꾸지 않는다** — 그때그때 바뀌는 것은 위 칸이 맡고, 아래는 자리가
 * 고정되어 있어야 다시 온 사람이 찾기 쉽다.
 *
 * 한 제품처럼 묶어 소개하지 않는다 — 각자 한 줄씩, 계정만 공유한다는 말은 아래 한 줄로만
 * → my-obsidian-vault / 20-Design/서비스 카테고리와 카피 원칙.md · 30-Patterns/SNS 소개 카드와 게시글.md
 */

/**
 * 위 칸 — 지금 나누고 있는 링크.
 *
 * 게시글을 올릴 때 여기 한 칸 넣고, 내릴 때 지운다. **빈 배열로 두면 위 시트가
 * 통째로 사라진다** — 빈 시트를 남기지 않는다.
 *
 * ⚠️ TypeLog 의 `/r/<토큰>` 은 **응시 1건에 붙어 있는 공유 링크**다. 열면
 * `A FRIEND SHARED` 아래에 그때 나온 결과가 함께 보인다. 로그인 없이 바로 풀 수
 * 있는 유일한 주소라서 여기 쓴다. 결과를 바꾸고 싶으면 다시 응시해 새 링크를 만든다.
 * → my-obsidian-vault / 30-Patterns/SNS 소개 카드와 게시글.md
 */
const SHARES = [
  {
    /** 눌러서 만날 것의 이름. 질문지 제목처럼 */
    title: "나는 어떤 러너일까?",
    /** 어느 서비스에서 온 것인지 */
    from: "TypeLog",
    emoji: "🏃",
    href: "https://typelog.myjane.co.kr/r/orGgEBkFe2ZFZL-mOKrpYuny2htf239S",
    desc: "네 가지만 답하면 16가지 러너 유형 중 하나가 나와요. 누구와 · 어떤 거리 · 얼마나 자주 · 어떤 마음으로.",
    /** 눌러도 될지 판단에 필요한 조건. 없으면 안 그린다 */
    badge: "가입 없이 한 번",
  },
] as const;

/**
 * 아래 칸 — 앱 소개 링크.
 *
 * 각 서비스의 **소개 페이지**로 보낸다 (`/home` 이 아니다 — 처음 온 사람은 로그인 전이다).
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
  {
    name: "CalmTouch",
    role: "마음 쉼",
    href: "https://calmtouch.myjane.co.kr",
    domain: "calmtouch.myjane.co.kr",
    icon: "/calmtouch-icon.png",
    desc: "물감·물결·별·슬라임을 손끝으로 만져요. 손을 떼면 잔잔해져요. 로그인 없이 바로.",
  },
] as const;

/** 두 칸의 카드가 같은 모양이어야 한다 — 한 곳에 둔다 */
const cardStyle = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: "16px 18px",
  borderRadius: 18,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  textDecoration: "none",
} as const;

const nameRowStyle = {
  display: "flex",
  alignItems: "baseline",
  gap: 8,
  flexWrap: "wrap",
} as const;

const roleStyle = { fontSize: "0.78rem", color: "var(--accent-ink)", fontWeight: 700 } as const;

const descStyle = {
  display: "block",
  marginTop: 4,
  fontSize: "0.86rem",
  lineHeight: 1.55,
  color: "var(--text-dim)",
} as const;

const listStyle = {
  listStyle: "none",
  padding: 0,
  margin: "22px 0 0",
  display: "grid",
  gap: 12,
} as const;

export default function LinkPage() {
  /**
   * 나누는 링크가 있으면 그게 이 페이지의 머리글이 된다 — 게시글을 보고 온 사람이
   * 찾는 것이 그것이기 때문이다. 없으면 서비스 목록이 다시 `h1` 을 가져간다.
   */
  const hasShares = SHARES.length > 0;
  const AppsHeading = hasShares ? "h2" : "h1";

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
        {hasShares ? (
          <section className="sheet sheet--tint">
            <p className="eyebrow">NOW SHARING</p>
            <h1 className="headline" style={{ fontSize: "clamp(1.6rem, 4.5vw, 2.2rem)" }}>
              지금 나누고 있어요
            </h1>
            <p className="lead">게시글에서 보신 그것이에요. 눌러서 바로 해볼 수 있어요.</p>

            <ul style={listStyle}>
              {SHARES.map((s) => (
                <li key={s.href}>
                  <a href={s.href} style={cardStyle}>
                    <span
                      aria-hidden="true"
                      style={{
                        flex: "0 0 auto",
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: "var(--accent-subtle)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 26,
                        lineHeight: 1,
                      }}
                    >
                      {s.emoji}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={nameRowStyle}>
                        <strong style={{ fontSize: "1.02rem" }}>{s.title}</strong>
                        <span style={roleStyle}>{s.from}</span>
                      </span>
                      <span style={descStyle}>{s.desc}</span>
                      {s.badge ? (
                        <span
                          style={{
                            display: "inline-block",
                            marginTop: 8,
                            padding: "3px 10px",
                            borderRadius: 999,
                            border: "1px solid var(--border)",
                            background: "var(--surface-hover)",
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            color: "var(--accent-ink)",
                          }}
                        >
                          {s.badge}
                        </span>
                      ) : null}
                    </span>
                    <span aria-hidden="true" style={{ color: "var(--text-dim)" }}>
                      →
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="sheet">
          <p className="eyebrow">ALL SERVICES</p>
          <AppsHeading className="headline" style={{ fontSize: "clamp(1.6rem, 4.5vw, 2.2rem)" }}>
            필요한 기록만, 골라서
          </AppsHeading>
          <p className="lead">myjane 에서 만든 기록 서비스들이에요. 하나만 써도 충분해요.</p>

          <ul style={listStyle}>
            {LINKS.map((l) => (
              <li key={l.name}>
                <a href={l.href} style={cardStyle}>
                  <Image src={l.icon} alt="" width={48} height={48} style={{ borderRadius: 12, flex: "0 0 auto" }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={nameRowStyle}>
                      <strong style={{ fontSize: "1.02rem" }}>{l.name}</strong>
                      <span style={roleStyle}>{l.role}</span>
                    </span>
                    <span style={descStyle}>{l.desc}</span>
                    <span
                      style={{
                        display: "block",
                        marginTop: 6,
                        fontSize: "0.76rem",
                        color: "var(--text-dim)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
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
            <Link href="/share">지금 함께 해볼 수 있는 공유 링크 →</Link>
          </p>
          <p style={{ marginTop: 10, fontSize: "0.82rem" }}>
            <Link href="/legal/privacy">개인정보처리방침</Link> · <Link href="/legal/terms">이용약관</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
