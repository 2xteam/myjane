import Link from "next/link";
import Image from "next/image";
import { AdminNav } from "./AdminNav";
import "../admin.css";

/**
 * 관리 콘솔 껍데기 — 좌측 사이드바 + 상단 헤더 + 본문.
 *
 * 예전에는 한 페이지에 탭을 쌓았다. 리소스가 늘어나자 **새로고침하면 첫 탭으로
 * 돌아가고, 북마크도 뒤로가기도 되지 않았다.** 그래서 리소스마다 URL 을 준다.
 * 구조는 klead 의 관리 콘솔(`src/app/admin/(console)`)을 따랐다.
 *
 * → my-obsidian-vault / 30-Patterns/통합 admin.md
 */
export default function ConsoleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="adm-shell">
      <aside className="adm-side">
        <div className="adm-side-head">
          <Link href="/admin" className="adm-side-brand">
            <Image src="/myjane-icon.png" alt="" width={26} height={26} className="adm-side-icon" />
            <span className="adm-side-word">
              my<span>jane</span>
            </span>
            <span className="adm-side-tag">Admin</span>
          </Link>
        </div>
        <AdminNav />
      </aside>

      <div className="adm-main">
        <header className="adm-head">
          <span className="adm-head-label">관리자 콘솔</span>
          <div className="adm-head-right">
            <Link href="/" className="adm-head-link">
              사이트 보기 ↗
            </Link>
          </div>
        </header>
        <main className="adm-body">{children}</main>
      </div>
    </div>
  );
}
