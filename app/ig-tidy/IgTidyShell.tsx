import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ScrollProgress } from "@/components/ScrollProgress";

/** `/ig-tidy` 화면들의 껍데기 — `/share` 와 같은 모양(상단 띠 + 시트 하나) */
export function IgTidyShell({ children }: { children: ReactNode }) {
  return (
    <div className="legal">
      <header className="auth-topbar">
        <Link href="/" className="auth-brand">
          <Image src="/myjane-icon.png" alt="" width={26} height={26} />
          <span className="brand-word">
            my<span>jane</span>
          </span>
        </Link>
        <ScrollProgress />
      </header>
      <main className="legal-sheets" style={{ marginTop: 28 }}>
        <section className="sheet">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <Image src="/ig-tidy-icon.png" alt="" width={40} height={40} style={{ borderRadius: 10 }} />
            <p className="eyebrow" style={{ margin: 0 }}>IG TIDY</p>
          </div>
          {children}
        </section>
      </main>
    </div>
  );
}
