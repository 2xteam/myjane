import { IgTidyBrand } from "./IgTidyBrand";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ScrollProgress } from "@/components/ScrollProgress";

/** `/ig-tidy` 화면들의 껍데기 — `/share` 와 같은 모양(상단 띠 + 시트 하나) */
export function IgTidyShell({ children }: { children: ReactNode }) {
  return (
    <div className="legal">
      <header className="auth-topbar">
        <IgTidyBrand />
        <ScrollProgress />
      </header>
      <main className="legal-sheets" style={{ marginTop: 28 }}>
        <section className="sheet">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <Image src="/ig-tidy-icon.png" alt="" width={40} height={40} style={{ borderRadius: 10 }} />
            <p className="eyebrow" style={{ margin: 0 }}>IG TIDY</p>
          </div>
          {children}
          {/* 어느 IG Tidy 화면에서든 소개 · 업데이트 내역으로(2026-11-08) */}
          <p className="lead" style={{ marginTop: 22, fontSize: "0.88rem", display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Link href="/ig-tidy/about">IG Tidy 소개</Link>
            <Link href="/ig-tidy/updates">업데이트 내역</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
