import Image from "next/image";
import Link from "next/link";
import {
  ClosingCta,
  FooterAuth,
  HeaderAuth,
  HeroActions,
} from "@/components/LandingAuth";

/**
 * myjane 포털 랜딩.
 *
 * 결쩜사(kyulzzumsa.co.kr) 구조를 따른다 — 옅은 배경 위에 둥근 시트를 쌓고
 * 어두운 푸터로 닫는다. 시트마다 eyebrow → 헤드라인 → 콘텐츠 순서.
 * 근거: my-obsidian-vault → 20-Design/결쩜사 페이지 패턴.md
 *
 * 서비스는 **한 덩어리로 묶지 않는다.** 공부 기록(SnapWord·SnapNote)과
 * 건강 기록(FitLog)은 목적도 데이터도 다르므로 시트를 나눠 따로 설명한다.
 * 공유하는 것은 계정뿐이다.
 */

type App = {
  name: string;
  domain: string;
  href: string;
  icon: string;
  role: string;
  description: string;
  chips: string[];
};

/** 공부 기록 — 교재·시험지를 찍어 학습 자료로 만든다 */
const STUDY_APPS: App[] = [
  {
    name: "SnapWord",
    domain: "snapword.myjane.co.kr",
    href: "https://snapword.myjane.co.kr/home",
    icon: "/snapword-icon.png",
    role: "단어장",
    description:
      "교재나 화면을 찍으면 단어와 뜻을 뽑아 단어장으로 만들어요. 외운 것과 틀린 것을 나눠 테스트까지 이어져요.",
    chips: ["사진으로 단어 추출", "단어장", "학습·테스트"],
  },
  {
    name: "SnapNote",
    domain: "snapnote.myjane.co.kr",
    href: "https://snapnote.myjane.co.kr/home",
    icon: "/snapnote-icon.png",
    role: "오답노트",
    description:
      "틀린 문제를 찍어 모노톤으로 정리해 나만의 오답노트를 만들어요. 폴더로 묶고 인쇄해서 다시 풀어요.",
    chips: ["오답노트", "이미지 정리", "인쇄"],
  },
];

/** 건강 기록 — 측정 결과지를 찍어 몸의 변화를 따라간다 */
const HEALTH_APPS: App[] = [
  {
    name: "FitLog",
    domain: "fitlog.myjane.co.kr",
    href: "https://fitlog.myjane.co.kr/home",
    icon: "/fitlog-icon.png",
    role: "체성분 기록",
    description:
      "인바디 결과지를 찍으면 체중·골격근량·체지방률은 물론 결과지에 인쇄된 항목을 모두 읽어 날짜별로 쌓아둬요. 적정 범위와 겹쳐 지금 위치를 보여주고, 항목별 추이도 그래프로 확인해요.",
    chips: ["인바디 자동 판독", "적정 범위 비교", "항목별 추이"],
  },
];

/** 습관 기록 — 정한 만큼 해냈는지를 스티커로 남긴다 */
const HABIT_APPS: App[] = [
  {
    name: "2hbk",
    domain: "2hbk.myjane.co.kr",
    href: "https://2hbk.myjane.co.kr/home",
    icon: "/2hbk-icon.png",
    role: "스티커 목표",
    description:
      "함히보까 — 목표와 필요한 스티커 수를 정하면 그만큼 빈 칸이 생겨요. 해낼 때마다 목표를 만든 사람이 한 장씩 붙이고, 다 채우면 금색 판으로 바뀌어요. 혼자 해도 되고 친구를 초대해 같이 채워도 돼요.",
    chips: ["스티커판", "혼자·같이", "친구 초대"],
  },
];

/** 카테고리를 넘어 공통으로 해당되는 것만 적는다 */
const NOTES = [
  {
    icon: "◇",
    title: "계정만 공유해요",
    body: "로그인은 여기서 한 번. 기록과 데이터는 서비스마다 따로 쌓여요.",
  },
  {
    icon: "✦",
    title: "골라 쓰면 돼요",
    body: "하나만 써도 충분해요. 쓰지 않는 서비스는 열지 않아도 돼요.",
  },
  {
    icon: "○",
    title: "입력은 사진 한 장",
    body: "교재든 시험지든 결과지든, 찍으면 읽어서 정리해요.",
  },
  {
    icon: "△",
    title: "설정은 없어요",
    body: "몇 칸만 채우면 바로 첫 기록을 남겨요. 고를 것이 없어요.",
  },
];

/** 실(結)을 은유한 얇은 곡선 — 여백에만 놓는다 */
function Ornament({ light = false }: { light?: boolean }) {
  const stroke = light ? "rgba(200,184,255,0.22)" : "rgba(139,92,246,0.16)";
  return (
    <svg className="sheet-ornament" viewBox="0 0 260 150" aria-hidden="true">
      <g fill="none" stroke={stroke} strokeWidth="1">
        <ellipse cx="150" cy="60" rx="130" ry="42" />
        <ellipse cx="150" cy="60" rx="96" ry="26" />
      </g>
      <circle cx="248" cy="52" r="3" fill="#c9a84c" opacity="0.75" />
    </svg>
  );
}

/** 서비스 카드 — 카테고리 시트 안에서 재사용 */
function AppCard({ app }: { app: App }) {
  return (
    <a className="card" href={app.href}>
      <div className="card-head">
        <Image
          className="card-icon"
          src={app.icon}
          alt=""
          width={46}
          height={46}
        />
        <div>
          <h3 className="card-name">{app.name}</h3>
          <p className="card-domain">{app.domain}</p>
        </div>
        <span className="card-role">{app.role}</span>
      </div>

      <p className="card-desc">{app.description}</p>

      <ul className="chips">
        {app.chips.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>

      <span className="card-cta">
        바로가기 <span className="arrow">→</span>
      </span>
    </a>
  );
}

export default function Home() {
  return (
    <div className="site">
      <header className="site-top">
        <Link href="/" className="auth-brand">
          <Image src="/myjane-icon.png" alt="" width={26} height={26} />
          <span className="brand-word">
            my<span>jane</span>
          </span>
        </Link>
        <nav className="site-nav">
          <HeaderAuth />
        </nav>
      </header>

      <main className="sheets">
        {/* 히어로 — 짙은 시트 (변형 A) */}
        <section className="sheet sheet--dark">
          <Ornament light />
          <p className="hero-badge">✦ 공부 · 건강 · 습관 기록</p>
          <h1 className="headline">
            필요한 기록만,
            <br />
            골라서 쌓아요
          </h1>
          <p className="lead">
            myjane은 목적이 다른 기록 서비스를 한 계정으로 열어두는 곳이에요.
            <br />
            공부는 공부끼리, 건강은 건강끼리 따로 쌓입니다.
          </p>
          <HeroActions />
        </section>

        {/* 공부 기록 — 흰 시트 */}
        <section className="sheet">
          <Ornament />
          <div className="center">
            <p className="eyebrow">STUDY · 공부 기록</p>
            <h2 className="headline">
              교재와 시험지를
              <br />
              <span>학습 자료로</span>
            </h2>
            <p className="lead">
              찍어두면 단어장과 오답노트가 돼요. 두 서비스는 함께 써도, 하나만
              써도 됩니다.
            </p>
          </div>

          <nav className="apps apps--pair" aria-label="공부 기록 서비스">
            {STUDY_APPS.map((app) => (
              <AppCard key={app.name} app={app} />
            ))}
          </nav>
        </section>

        {/* 건강 기록 — 연보라 시트 */}
        <section className="sheet sheet--tint">
          <div className="center">
            <p className="eyebrow">HEALTH · 건강 기록</p>
            <h2 className="headline">
              몸의 변화는
              <br />
              <span>숫자로 남겨요</span>
            </h2>
            <p className="lead">
              측정 결과지를 찍으면 수치를 읽어 날짜별로 정리해요. 공부 기록과는
              별개로 동작합니다.
            </p>
          </div>

          <nav className="apps apps--solo" aria-label="건강 기록 서비스">
            {HEALTH_APPS.map((app) => (
              <AppCard key={app.name} app={app} />
            ))}
          </nav>
        </section>

        {/* 습관 기록 — 흰 시트 */}
        <section className="sheet">
          <div className="center">
            <p className="eyebrow">HABIT · 습관 기록</p>
            <h2 className="headline">
              해낸 만큼
              <br />
              <span>칸이 채워져요</span>
            </h2>
            <p className="lead">
              오늘 하나를 해내면 스티커 한 장. 공부·건강 기록과는 별개로 동작합니다.
            </p>
          </div>

          <nav className="apps apps--solo" aria-label="습관 기록 서비스">
            {HABIT_APPS.map((app) => (
              <AppCard key={app.name} app={app} />
            ))}
          </nav>
        </section>

        {/* 공통 안내 — 연보라 시트 */}
        <section className="sheet sheet--tint">
          <div className="center">
            <p className="eyebrow">ABOUT MYJANE</p>
            <h2 className="headline">묶어둔 건 계정뿐이에요</h2>
          </div>

          <div className="features">
            {NOTES.map((f) => (
              <div className="feature" key={f.title}>
                <div className="feature-icon" aria-hidden="true">
                  {f.icon}
                </div>
                <div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 마무리 CTA — 로그인 상태에서는 나오지 않는다 */}
        <ClosingCta />
      </main>

      <footer className="site-footer">
        <div className="site-footer-brand">
          <Image src="/myjane-icon.png" alt="" width={24} height={24} />
          <span className="brand-word">
            my<span>jane</span>
          </span>
        </div>
        <div>
          <FooterAuth />
        </div>
        <div>© {new Date().getFullYear()} MyJane. All rights reserved.</div>
      </footer>
    </div>
  );
}
