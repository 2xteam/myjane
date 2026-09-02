import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://www.myjane.co.kr";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "myjane — SnapWord · SnapNote",
  description:
    "영어 단어장 SnapWord와 오답노트 SnapNote로 이동할 수 있는 myjane 서비스 안내 페이지입니다.",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "myjane",
    title: "myjane — SnapWord · SnapNote",
    description: "영어 단어장 SnapWord, 오답노트 SnapNote 바로가기",
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
        {/* Pretendard — 결쩜사와 동일한 본문 서체 */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
