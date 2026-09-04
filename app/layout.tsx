import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://www.myjane.co.kr";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "myjane — 공부 · 건강 · 습관 · 성향 기록",
  description:
    "공부 기록(단어장 SnapWord, 오답노트 SnapNote), 건강 기록(인바디 FitLog), 습관 기록(스티커 2hbk), 성향 기록(타입 TypeLog)을 한 계정으로 쓰는 myjane 서비스 안내 페이지입니다.",
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
  themeColor: "#fdfbff",
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
      <body>{children}</body>
    </html>
  );
}
