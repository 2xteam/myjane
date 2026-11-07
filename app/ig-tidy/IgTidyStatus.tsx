"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Me = {
  ok: boolean;
  code?: string;
  user?: { name: string; email: string | null };
  allowed?: boolean;
  release?: { version: string; notes: string; size: number; publishedAt: string | null } | null;
};

const LOGIN = "/login?from=ig-tidy&next=/ig-tidy";
const SIGNUP = "/signup?from=ig-tidy&next=/ig-tidy";

/**
 * 로그인 상태에 따라 갈리는 조각. 상태가 정해지기 전에는 아무것도 그리지 않는다
 * (로그인한 사람에게 「로그인」 버튼이 스쳐 보이지 않게 — LandingAuth 와 같은 원칙).
 */
export function IgTidyStatus() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    /* 세션 표지가 없으면 부르지 않는다 — 공개 화면이 401 로 콘솔을 시끄럽게 하지 않게.
       판단은 여전히 서버가 한다(표지는 "부를 필요가 있나" 만 정한다) → 30-Patterns/인증과 세션 공유.md */
    if (!/(?:^|;\s*)snap_auth=1/.test(document.cookie)) {
      setMe({ ok: false, code: "login_required" });
      return;
    }
    void (async () => {
      try {
        const res = await fetch("/api/ig-tidy/me", { cache: "no-store" });
        setMe((await res.json()) as Me);
      } catch {
        setMe({ ok: false, code: "network" });
      }
    })();
  }, []);

  if (!me) return <div style={{ minHeight: 160 }} />;

  if (me.code === "login_required") {
    return (
      <>
        <h1 className="headline" style={{ fontSize: "clamp(1.6rem, 4.5vw, 2.2rem)" }}>인스타그램 정리 도우미</h1>
        <p className="lead">myjane 계정으로 로그인하면 허용 여부를 확인하고 설치 파일을 받을 수 있어요.</p>
        <div className="btn-row" style={{ marginTop: 20 }}>
          <Link className="btn btn-primary" href={LOGIN}>로그인</Link>
          <Link className="btn btn-ghost" href={SIGNUP}>회원가입</Link>
        </div>
      </>
    );
  }

  if (!me.ok) {
    return <p className="lead">상태를 확인하지 못했어요. 잠시 뒤 새로고침해 주세요.</p>;
  }

  if (!me.allowed) {
    return (
      <>
        <h1 className="headline" style={{ fontSize: "clamp(1.6rem, 4.5vw, 2.2rem)" }}>관리자 확인을 기다리고 있어요</h1>
        <p className="lead">
          {me.user?.name ? `${me.user.name}님, ` : ""}가입은 끝났어요. IG Tidy 는 허용된 분만 쓸 수 있어서,
          관리자가 확인하면 바로 설치 파일을 받을 수 있어요.
        </p>
        <p className="lead" style={{ marginTop: 12 }}>
          로그인한 계정: <b>{me.user?.email ?? "이메일 없음"}</b> — 다른 계정이면 로그아웃 후 다시 로그인해 주세요.
        </p>
      </>
    );
  }

  const r = me.release;
  return (
    <>
      <h1 className="headline" style={{ fontSize: "clamp(1.6rem, 4.5vw, 2.2rem)" }}>IG Tidy 를 쓸 수 있어요</h1>
      <p className="lead">
        윈도우용 설치 파일을 받아 실행하세요. 앱을 처음 열면 myjane 계정으로 한 번 로그인하고, 인스타그램에 로그인하면 바로 시작돼요.
      </p>
      {r ? (
        <>
          <div className="btn-row" style={{ marginTop: 20 }}>
            <a className="btn btn-primary" href="/api/ig-tidy/download">
              설치 파일 받기 · {r.version}
            </a>
          </div>
          {r.notes ? <p className="lead" style={{ marginTop: 14, whiteSpace: "pre-line" }}>바뀐 점 — {r.notes}</p> : null}
        </>
      ) : (
        <p className="lead" style={{ marginTop: 16 }}>설치 파일을 준비하고 있어요. 곧 올라와요.</p>
      )}
      <p className="lead" style={{ marginTop: 16, fontSize: "0.92rem" }}>
        설치할 때 「Windows의 PC 보호」 창이 뜨면 <b>추가 정보 → 실행</b> 을 눌러 주세요. 지인용이라 서명 인증서가 없어서 뜨는 안내예요.
        한 번 설치하면 새 버전은 앱이 알려 주고 버튼 하나로 올라가요.
      </p>
    </>
  );
}
