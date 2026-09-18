import Link from "next/link";

/**
 * 없는 주소 — **나가는 길을 준다.**
 *
 * Next 의 기본 404 는 흰 화면에 영문 한 줄이라 사이트가 죽은 것처럼 보인다.
 * 주소를 잘못 눌렀을 뿐인 사람이 그 화면에서 되돌아갈 방법을 찾지 못한다.
 *
 * `app/not-found.tsx` 하나가 **모든 경로**를 받는다 — 매칭되지 않은 주소와
 * 라우트에서 `notFound()` 를 부른 경우 둘 다다.
 *
 * ⚠️ **짙은 시트를 쓴다.** `.btn-ghost` 는 짙은 면 위에 놓이는 전제로 만들어져
 * 반투명 배경 + 흰 글자다(`app/globals.css`). 흰 시트에 얹으면 보조 버튼이
 * 사실상 보이지 않는다. 히어로와 같은 조합을 그대로 쓴다.
 *
 * ⚠️ 링크는 **포털 안쪽 경로로만** 건다. 없는 주소로 들어온 사람에게 다른
 * 서비스를 늘어놓으면 어디로 가라는 건지 흐려진다. 서비스 목록은 메인에 있다.
 *
 * → my-obsidian-vault / 20-Design/결쩜사 페이지 패턴.md
 */
export default function NotFound() {
  return (
    <main className="sheets">
      <section className="sheet sheet--dark sheet--point">
        <p className="hero-badge">✦ 404</p>
        <h1 className="headline">
          찾는 페이지가
          <br />
          없어요
        </h1>
        <p className="lead">
          주소가 바뀌었거나 잘못 눌렸을 수 있어요.
          <br />
          아래에서 가려던 곳으로 갈 수 있어요.
        </p>
        <div className="btn-row">
          <Link className="btn btn-primary" href="/">
            메인으로 →
          </Link>
          <Link className="btn btn-ghost" href="/link">
            서비스 바로가기
          </Link>
        </div>
      </section>

      <section className="sheet">
        <div className="center">
          <p className="eyebrow">WHERE TO GO</p>
          <h2 className="headline">이런 걸 찾으셨나요?</h2>
        </div>
        {/* 랜딩의 `.feature` 와 같은 구조다 — 아이콘과 본문을 형제로 두면
            flex 가 제목과 설명을 가로로 늘어놓는다 */}
        <div className="features">
          {LINKS.map((l) => (
            <Link className="feature" key={l.href} href={l.href} style={{ textDecoration: "none" }}>
              <div className="feature-icon" aria-hidden="true">
                {l.icon}
              </div>
              <div>
                <h3>{l.title}</h3>
                <p>{l.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

const LINKS = [
  { icon: "◇", href: "/link", title: "서비스 바로가기", desc: "쓰고 있는 서비스로 바로 넘어가요." },
  { icon: "✦", href: "/login", title: "로그인", desc: "계정 하나로 모든 서비스에 들어가요." },
  { icon: "○", href: "/signup", title: "회원가입", desc: "처음이라면 여기서 시작해요." },
  { icon: "△", href: "/legal/privacy", title: "개인정보처리방침", desc: "어떤 정보를 어떻게 다루는지 적어 뒀어요." },
];
