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
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#1e0938" },
    { media: "(prefers-color-scheme: light)", color: "#fdfbff" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
