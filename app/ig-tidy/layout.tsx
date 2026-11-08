import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./ig-theme.css";

/**
 * `/ig-tidy/*` 공유 미리보기 · 아이콘 — myjane 것을 물려받지 않고 IG Tidy 로(2026-11-08 사용자 요청).
 * 카톡 · 메신저에 링크를 붙이면 이 제목 · 설명 · 그림(public/ig-tidy-og.png, 1200×630)이 뜬다.
 * 화면마다 제목 · 설명 · 주소는 각 page 의 metadata 가 덮는다.
 */
const OG_DESC = "인스타그램 팔로우 정리 · 좋아요 · AI 댓글을 사람처럼 천천히 대신 눌러 주는 윈도우 앱. 허용된 회원 전용.";
export const metadata: Metadata = {
  title: "IG Tidy",
  description: OG_DESC,
  alternates: { canonical: "/ig-tidy" },
  openGraph: {
    type: "website",
    url: "/ig-tidy",
    siteName: "IG Tidy",
    title: "IG Tidy — 인스타그램 정리 도우미",
    description: OG_DESC,
    images: [{ url: "/ig-tidy-og.png", width: 1200, height: 630, alt: "IG Tidy — 인스타그램 정리 도우미" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "IG Tidy — 인스타그램 정리 도우미",
    description: OG_DESC,
    images: ["/ig-tidy-og.png"],
  },
  icons: { icon: [{ url: "/ig-tidy-icon.png", type: "image/png" }], apple: "/ig-tidy-icon.png" },
};

/** `/ig-tidy/*` 전체 — 인스타그램 테마로 감싼다(토큰만 바꿔 끼운다 → ./ig-theme.css). 2026-11-08 */
export default function IgTidyLayout({ children }: { children: ReactNode }) {
  return <div className="ig-theme">{children}</div>;
}
