import type { ReactNode } from "react";
import "./ig-theme.css";

/** `/ig-tidy/*` 전체 — 인스타그램 테마로 감싼다(토큰만 바꿔 끼운다 → ./ig-theme.css). 2026-11-08 */
export default function IgTidyLayout({ children }: { children: ReactNode }) {
  return <div className="ig-theme">{children}</div>;
}
