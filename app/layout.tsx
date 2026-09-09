import type { Metadata, Viewport } from "next";
import "./globals.css";
// globals.css **다음에** 온다 — .sheet--point 처럼 특이도가 같은 규칙이
// globals.css 의 .sheet 를 이겨야 한다. globals.css 안에서 @import 하면
// (import 는 파일 맨 앞이라야 하므로) 늘 먼저 들어가 진다.
import "./elements.css";
import { EmailPrompt } from "@/components/EmailPrompt";
import { PasswordPrompt } from "@/components/PasswordPrompt";
import { PolicyPrompt } from "@/components/PolicyPrompt";

const SITE_URL = "https://www.myjane.co.kr";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "myjane — 공부 · 건강 · 습관 · 성향 기록",
  description:
    "공부 기록(단어장 SnapWord, 오답노트 SnapNote), 건강 기록(인바디·피검사 FitLog), 습관 기록(스티커 2hbk), 성향 기록(타입 TypeLog)을 한 계정으로 쓰는 myjane 서비스 안내 페이지입니다.",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "myjane",
    title: "myjane — 공부 · 건강 · 습관 · 성향 기록",
    description: "공부 기록 SnapWord · SnapNote, 건강 기록 FitLog, 습관 기록 2hbk, 성향 기록 TypeLog 바로가기",
  },
  alternates: { canonical: SITE_URL },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  // 라이트 전용 사이트
  themeColor: "#f7fbfb",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" style={{ colorScheme: "light" }}>
      <head>
        {/*
          결쩜사와 동일한 서체 조합.
          본문·라벨은 Pretendard, 큰 헤드라인은 Gowun Batang(명조) 700.
          이 조합이 인상의 큰 축이다 — 헤드라인까지 산세리프로 쓰면 다른 사이트가 된다.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css"
        />
      </head>
      <body>
        {children}
        {/*
          이메일 안내 띠. 로그인한 사람에게 해당될 때만, 하루에 한 번만 보인다.
          해당 없으면 아무것도 그리지 않는다 → components/EmailPrompt.tsx
        */}
        <EmailPrompt />
        {/*
          비밀번호 갱신 안내 띠. 3개월이 지났을 때만 뜨고 강제하지 않는다.
          이메일 안내가 뜰 상황이면 스스로 접는다 — 띠를 둘 겹치지 않는다
          → components/PasswordPrompt.tsx
        */}
        <PasswordPrompt />
        {/*
          방침·약관 개정 안내 띠. 아직 새 판을 확인하지 않은 회원에게만 뜨고,
          이메일 안내가 뜰 상황이면 양보한다 → components/PolicyPrompt.tsx
        */}
        <PolicyPrompt />
      </body>
    </html>
  );
}
