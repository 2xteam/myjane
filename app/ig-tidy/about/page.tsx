import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ScrollProgress } from "@/components/ScrollProgress";

export const metadata: Metadata = {
  title: "IG Tidy 소개",
  description: "허용된 myjane 회원이 쓰는 인스타그램 정리 · 소통 도우미(윈도우 앱) 소개와 기본 사용법.",
  robots: { index: false },
};

/**
 * `/ig-tidy/about` — IG Tidy 소개 · 기본 설명 (2026-11-08).
 *
 * 앱 메뉴 「보기 → IG Tidy 소개」 와 첫 공지가 이 화면을 가리킨다. /ig-tidy(설치)와 같은 껍데기 모양에
 * 시트를 여러 장 쌓는다. 지인 배포라 검색 색인은 막는다.
 * 탭 이름 · 메뉴 위치는 앱(ig-tidy-desktop)의 화면과 맞춘다 — 앱 화면을 바꾸면 여기도 본다.
 * → my-obsidian-vault / 10-Projects/IG Tidy.md
 */

const FEATURES: { name: string; badge?: string; body: string }[] = [
  { name: "팔로우 정리", body: "맞팔이 아닌 계정 · 나를 떠난 사람 · 글이 오래 없는 맞팔 · 팔로워 비중으로 가르기 중에서 골라 하나씩 정리해요." },
  { name: "새로 팔로우", body: "홈 피드나 태그 검색에서 새 계정을 찾아 팔로우해요. 원하면 좋아요 · 댓글 · 인사 메시지도 함께." },
  { name: "좋아요", body: "나를 팔로우하는 사람 · 맞팔 · 홈 피드 · 스토리에 좋아요를 눌러 관계를 이어 가요." },
  { name: "AI 댓글 · AI 답글", badge: "AI", body: "글과 사진을 읽고 그 글에 맞는 댓글을, 내 글에 달린 댓글에는 답글을 AI 가 만들어요. 글의 언어에 맞춰 써요." },
  { name: "맞춤 스타일", badge: "AI", body: "내 글에 내가 단 댓글을 읽어 평소 말투를 지침으로 만들어요. AI 가 그 말투로 써요." },
  { name: "검토함", body: "AI 가 만든 문구를 바로 달지 않고 모아 둬요. 왼쪽에 그 글을 보며 고치고, 고른 것만 달아요." },
  { name: "예약 · 알림", body: "정한 시각에 저절로 시작하고, 끝나거나 멈추면 Windows 알림으로 알려 줘요." },
  { name: "대시보드 · 주간 리포트", body: "팔로워 · 맞팔 변화, 날마다 한 일, AI 사용량을 이번 주 · 지난주로 견줘 봐요." },
  { name: "🛡 보호 목록", body: "가족 · 친구 · 거래처처럼 건드리면 안 되는 계정은 어떤 기능에서도 건너뛰어요." },
  { name: "여러 PC 에서 이어 하기", body: "기록은 myjane 계정에 저장돼요. 다른 PC 에서 로그인하면 하던 곳부터 이어서 해요." },
];

const START = [
  { title: "설치하고 myjane 으로 로그인", body: "설치 파일을 받아 실행하고, 앱 첫 화면에서 myjane 계정으로 로그인해요. 허용된 회원만 쓸 수 있어요 — 허용 전이면 기다리는 화면이 떠요.", badges: ["설치 안내"] },
  { title: "왼쪽 화면에서 인스타그램 로그인", body: "앱 왼쪽은 인스타그램, 오른쪽은 IG Tidy 패널이에요. 왼쪽에서 평소처럼 로그인하면 패널 위쪽에 내 아이디가 떠요.", badges: [] },
  { title: "탭을 고르고 적게 시작", body: "할 일을 탭에서 고르고 ① 대상 ② 설정 ③ 속도를 정한 뒤 「시작」. 처음에는 최대 건수를 20~50 정도로 작게 잡고 기록을 보며 늘려요.", badges: ["처음엔 적게"] },
];

const SAFE = [
  ["인스타그램은 한도를 공개하지 않아요", "계정 나이 · 그날 행동에 따라 달라요. IG Tidy 는 하루 상한과 간격을 두고, 제한 신호가 보이면 그 자리에서 멈춰요."],
  ["돌아가는 동안 왼쪽 화면은 그대로", "창을 뒤로 두거나 최소화해도 계속 돌아요. 다만 왼쪽 화면을 직접 누르면 작업이 꼬일 수 있어요 — 그사이 인스타그램은 「인스타 창 더 보기」 로 보세요."],
  ["AI 문구는 처음엔 검토함으로", "「만든 댓글은 → 검토함에 모으기」 로 몇 번 돌려 문구를 보고, 마음에 들면 「바로 달기」 로 바꿔요."],
  ["AI 는 하루 한도가 있어요", "글만 1단위 · 사진 포함 4단위로 세요. 남은 양은 AI 탭과 대시보드에서 보여요."],
];

const FAQ = [
  ["누가 쓸 수 있나요?", "관리자가 허용한 myjane 회원만 써요. 가입하고 앱에서 로그인하면 허용을 요청할 수 있어요."],
  ["휴대폰에서도 되나요?", "아니요. 윈도우 PC 앱이에요. 휴대폰 인스타그램은 평소처럼 쓰면 돼요."],
  ["업데이트는 어떻게 받나요?", "새 버전이 나오면 앱 위쪽에 알림이 떠요. 「지금 업데이트」 를 누르면 저절로 설치되고 다시 열려요. 화면 · 자동화의 작은 수정은 앱을 다시 깔지 않고도 저절로 받아요."],
  ["제 기록은 어디에 남나요?", "이 PC 와 myjane 서버(내 계정)에 남아요. 메뉴 「계정 → 백업」 으로 파일로 받아 둘 수도 있어요."],
];

export default function IgTidyAboutPage() {
  return (
    <div className="legal">
      <header className="auth-topbar">
        <Link href="/" className="auth-brand">
          <Image src="/myjane-icon.png" alt="" width={26} height={26} />
          <span className="brand-word">
            my<span>jane</span>
          </span>
        </Link>
        <ScrollProgress />
      </header>

      <main className="legal-sheets" style={{ marginTop: 28 }}>
        {/* 히어로 — 짙은 시트 */}
        <section className="sheet sheet--dark sheet--point">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <Image src="/ig-tidy-icon.png" alt="" width={44} height={44} style={{ borderRadius: 11 }} />
            <p className="eyebrow" style={{ margin: 0 }}>IG TIDY · 윈도우 앱</p>
          </div>
          <h1 className="headline">
            인스타그램 정리와 소통,
            <br />
            맡겨 두고 다른 일 하세요
          </h1>
          <p className="lead">
            IG Tidy 는 허용된 myjane 회원이 쓰는 인스타그램 도우미예요. 맞팔 정리 · 좋아요 · 새 팔로우를 사람처럼
            천천히 돌리고, AI 가 내 말투로 댓글과 답글을 만들어요. 모든 건 정한 한도 안에서, 내가 고른 대로만 해요.
          </p>
          <div className="btn-row" style={{ marginTop: 20 }}>
            <Link href="/ig-tidy" className="btn btn-primary">설치 · 시작하기</Link>
            <Link href="/ig-tidy/updates" className="btn btn-ghost">업데이트 내역</Link>
          </div>
        </section>

        {/* 할 수 있는 것 — 카드를 담은 시트 */}
        <section className="sheet sheet--point">
          <p className="eyebrow">FEATURES · 할 수 있는 것</p>
          <h2 className="headline">
            귀찮은 반복은 <span className="mark">IG Tidy 가</span>
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: "18px 0 0", display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {FEATURES.map((f) => (
              <li key={f.name} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", background: "var(--surface)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <b>{f.name}</b>
                  {f.badge ? (
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, padding: "1px 8px", borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent-ink)" }}>{f.badge}</span>
                  ) : null}
                </div>
                <p style={{ margin: 0, fontSize: "0.92rem", lineHeight: 1.65, color: "var(--text-dim)" }}>{f.body}</p>
              </li>
            ))}
          </ul>
          <p className="lead" style={{ marginTop: 14, fontSize: "0.88rem" }}>
            <b>AI</b> 표시 기능은 관리자의 AI 허용과 하루 한도 안에서 써요.
          </p>
        </section>

        {/* 시작하는 순서 — 3단계 타임라인 */}
        <section className="sheet">
          <p className="eyebrow">HOW IT WORKS · 시작하는 순서</p>
          <h2 className="headline">세 단계면 시작해요</h2>
          <ol className="flow">
            {START.map((s, i) => (
              <li className="flow-step" key={s.title}>
                <span className="flow-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  {s.badges.length ? (
                    <div className="flow-badges">
                      {s.badges.map((b) => <span className="flow-badge" key={b}>{b}</span>)}
                    </div>
                  ) : null}
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* 안전하게 쓰기 */}
        <section className="sheet sheet--tint">
          <p className="eyebrow">SAFETY · 안전하게 쓰기</p>
          <h2 className="headline">계정을 지키는 쪽으로</h2>
          <dl style={{ margin: "16px 0 0", display: "grid", gap: 14 }}>
            {SAFE.map(([t, d]) => (
              <div key={t}>
                <dt style={{ fontWeight: 700 }}>{t}</dt>
                <dd style={{ margin: "4px 0 0", lineHeight: 1.7, color: "var(--text-dim)" }}>{d}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 자주 묻는 것 */}
        <section className="sheet">
          <p className="eyebrow">FAQ · 자주 묻는 것</p>
          <h2 className="headline">궁금한 것</h2>
          <dl style={{ margin: "16px 0 0", display: "grid", gap: 14 }}>
            {FAQ.map(([q, a]) => (
              <div key={q}>
                <dt style={{ fontWeight: 700 }}>{q}</dt>
                <dd style={{ margin: "4px 0 0", lineHeight: 1.7, color: "var(--text-dim)" }}>{a}</dd>
              </div>
            ))}
          </dl>
          <p className="lead" style={{ marginTop: 18 }}>
            더 자세한 사용법은 앱 메뉴 <b>보기 → 설명서</b> 에 있어요.
          </p>
        </section>
      </main>
    </div>
  );
}
