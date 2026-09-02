import Image from "next/image";

type App = {
  name: string;
  domain: string;
  href: string;
  icon: string;
  description: string;
  features: string[];
};

const APPS: App[] = [
  {
    name: "SnapWord",
    domain: "snapword.myjane.co.kr",
    href: "https://snapword.myjane.co.kr/home",
    icon: "/snapword-icon.png",
    description:
      "교재나 화면을 찍으면 단어를 뽑아 단어장으로 만들어 줍니다. 학습과 테스트, 오답 관리까지 이어집니다.",
    features: ["사진으로 단어 추출", "단어장", "학습·테스트"],
  },
  {
    name: "SnapNote",
    domain: "snapnote.myjane.co.kr",
    href: "https://snapnote.myjane.co.kr/home",
    icon: "/snapnote-icon.png",
    description:
      "틀린 문제를 찍어 모노톤으로 정리해 나만의 오답노트를 만듭니다. 폴더로 묶고 인쇄해서 다시 풀 수 있습니다.",
    features: ["오답노트", "이미지 정리", "인쇄"],
  },
];

export default function Home() {
  return (
    <main className="page">
      <header className="hero">
        <Image
          className="mark"
          src="/myjane-mark.svg"
          alt=""
          width={76}
          height={76}
          priority
        />
        <h1 className="wordmark">
          my<span>jane</span>
        </h1>
        <p className="tagline">
          공부를 조금 더 가볍게. 사진 한 장으로 시작하는 단어장과 오답노트입니다.
        </p>
      </header>

      <nav className="apps" aria-label="서비스 바로가기">
        {APPS.map((app) => (
          <a key={app.name} className="card" href={app.href}>
            <div className="card-head">
              <Image
                className="card-icon"
                src={app.icon}
                alt=""
                width={52}
                height={52}
                priority
              />
              <div>
                <h2 className="card-name">{app.name}</h2>
                <p className="card-domain">{app.domain}</p>
              </div>
            </div>

            <p className="card-desc">{app.description}</p>

            <ul className="card-features">
              {app.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>

            <span className="card-cta">
              바로가기 <span className="arrow" aria-hidden="true">→</span>
            </span>
          </a>
        ))}
      </nav>

      <footer className="footer">
        <p>© {new Date().getFullYear()} myjane</p>
      </footer>
    </main>
  );
}
