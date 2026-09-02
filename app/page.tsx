import Image from "next/image";
import Link from "next/link";

/**
 * myjane 포털 랜딩.
 *
 * 결쩜사(kyulzzumsa.co.kr) 구조를 따른다 — 옅은 배경 위에 둥근 시트를 쌓고
 * 어두운 푸터로 닫는다. 시트마다 eyebrow → 헤드라인 → 콘텐츠 순서.
 * 근거: my-obsidian-vault → 20-Design/결쩜사 페이지 패턴.md
 */

type App = {
  name: string;
  domain: string;
  href: string;
  icon: string;
  description: string;
  chips: string[];
};

const APPS: App[] = [
  {
    name: "SnapWord",
    domain: "snapword.myjane.co.kr",
    href: "https://snapword.myjane.co.kr/home",
    icon: "/snapword-icon.png",
    description:
      "교재나 화면을 찍으면 단어를 뽑아 단어장으로 만들어요. 학습과 테스트, 오답 관리까지 이어져요.",
    chips: ["사진으로 단어 추출", "단어장", "학습·테스트"],
  },
  {
    name: "SnapNote",
    domain: "snapnote.myjane.co.kr",
    href: "https://snapnote.myjane.co.kr/home",
    icon: "/snapnote-icon.png",
    description:
      "틀린 문제를 찍어 모노톤으로 정리해 나만의 오답노트를 만들어요. 폴더로 묶고 인쇄해서 다시 풀어요.",
    chips: ["오답노트", "이미지 정리", "인쇄"],
  },
  {
    name: "FitLog",
    domain: "fitlog.myjane.co.kr",
    href: "https://fitlog.myjane.co.kr/home",
    icon: "/fitlog-icon.png",
    description:
      "인바디 결과지를 찍으면 수치를 읽어 기록해요. 체중과 체성분이 어떻게 변해왔는지 한눈에 봐요.",
    chips: ["인바디 기록", "체중 추이", "그래프"],
  },
];

const FEATURES = [
  {
    icon: "✦",
    title: "찍으면 정리돼요",
    body: "교재도, 오답도, 인바디 결과지도 사진 한 장이면 돼요.",
  },
  {
    icon: "◇",
    title: "계정 하나로 충분해요",
    body: "세 서비스를 같은 계정으로 오가며 사용해요.",
  },
  {
    icon: "○",
    title: "쌓이면 보여요",
    body: "지나간 기록이 모여 변화를 알려줘요.",
  },
  {
    icon: "△",
    title: "가볍게 시작해요",
    body: "복잡한 설정 없이 바로 첫 기록을 남겨요.",
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
          <Link href="/login">로그인</Link>
          <Link href="/signup" className="cta">
            회원가입
          </Link>
        </nav>
      </header>

      <main className="sheets">
        {/* 히어로 — 짙은 시트 (변형 A) */}
        <section className="sheet sheet--dark">
          <Ornament light />
          <p className="hero-badge">✦ 계정 하나로 세 가지 기록</p>
          <h1 className="headline">
            찍어두면,
            <br />
            나중에 알려줘요
          </h1>
          <p className="lead">
            단어도 오답도 몸의 변화도, 그때그때 사진으로 남겨요.
            <br />
            쌓인 기록이 무엇이 달라졌는지 대신 말해줘요.
          </p>
          <div className="btn-row">
            <Link href="/signup" className="btn btn-primary">
              지금 시작하기 <span className="arrow">→</span>
            </Link>
            <Link href="/login" className="btn btn-ghost">
              로그인
            </Link>
          </div>
        </section>

        {/* 서비스 — 흰 시트 */}
        <section className="sheet">
          <Ornament />
          <div className="center">
            <p className="eyebrow">SERVICES</p>
            <h2 className="headline">
              세 가지 기록,
              <br />
              <span>하나의 계정</span>
            </h2>
            <p className="lead">필요한 것부터 하나씩 써도 좋아요.</p>
          </div>

          <nav className="apps" aria-label="서비스 바로가기">
            {APPS.map((app) => (
              <a key={app.name} className="card" href={app.href}>
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
            ))}
          </nav>
        </section>

        {/* 특징 — 연보라 시트 */}
        <section className="sheet sheet--tint">
          <div className="center">
            <p className="eyebrow">WHY MYJANE</p>
            <h2 className="headline">기록은 가볍게, 확인은 확실하게</h2>
          </div>

          <div className="features">
            {FEATURES.map((f) => (
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

        {/* 마무리 CTA */}
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
      </main>

      <footer className="site-footer">
        <div className="site-footer-brand">
          <Image src="/myjane-icon.png" alt="" width={24} height={24} />
          myjane
        </div>
        <div>
          <Link href="/login">로그인</Link> · <Link href="/signup">회원가입</Link>
        </div>
        <div>© {new Date().getFullYear()} MyJane. All rights reserved.</div>
      </footer>
    </div>
  );
}
