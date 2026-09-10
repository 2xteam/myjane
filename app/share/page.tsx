import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ScrollProgress } from "@/components/ScrollProgress";
import { connectDB } from "@/lib/db";
import { listShareLinks, SHARE_APP_LABEL } from "@/lib/shareLinks";

export const metadata: Metadata = {
  title: "myjane 공유 링크",
  description: "지금 함께 해볼 수 있는 공유 링크들. SNS 프로필 링크에서 열립니다.",
  robots: { index: false },
};

/** 운영자가 admin 에서 고칠 때마다 곧 반영되게 — 캐시 60초 */
export const revalidate = 60;

/**
 * `/share` — 공유형 링크 모음 (2026-09-10).
 *
 * `/link` 는 서비스 소개 페이지 목록이고, 여기는 **앱 안에서 만들어진 공유 링크**를 모은다.
 * 첫 항목은 TypeLog 러닝 성향 결과 공유(`/r/<token>`) — 친구가 나눈 타입을 보고 로그인 없이 바로 참여한다.
 * 목록은 admin(`/admin/share`)에서 등록·수정한다. 켜진 것만 보인다.
 * → models/ShareLink.ts · my-obsidian-vault / 10-Projects/MyJane.md "/share"
 */
export default async function SharePage() {
  await connectDB();
  const links = await listShareLinks(true);

  return (
    <div className="legal">
      <header className="auth-topbar">
        <Link href="/" className="auth-brand">
          <Image src="/myjane-icon.png" alt="" width={26} height={26} />
          <span className="brand-word">
            my<span>jane</span>
          </span>
        </Link>
        <Link href="/link" className="auth-home">
          서비스 링크 →
        </Link>
        <ScrollProgress />
      </header>

      <main className="legal-sheets" style={{ marginTop: 28 }}>
        <section className="sheet">
          <p className="eyebrow">SHARE</p>
          <h1 className="headline" style={{ fontSize: "clamp(1.6rem, 4.5vw, 2.2rem)" }}>
            지금 함께 해볼 수 있어요
          </h1>
          <p className="lead">누군가 나눈 결과를 보고, 나도 바로 해볼 수 있는 링크들이에요. 로그인 없이 열려요.</p>

          {links.length === 0 ? (
            <p className="lead" style={{ marginTop: 22 }}>아직 올린 링크가 없어요. 곧 채울게요.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: "22px 0 0", display: "grid", gap: 12 }}>
              {links.map((l) => (
                <li key={l.id}>
                  <a
                    href={l.url}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      padding: "16px 18px",
                      borderRadius: 18,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "var(--text)",
                      textDecoration: "none",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        flex: "0 0 auto",
                        display: "grid",
                        placeItems: "center",
                        background: "var(--sheet-dark, #116271)",
                        color: "#fff",
                        fontSize: l.emoji ? 26 : 18,
                        fontWeight: 800,
                      }}
                    >
                      {l.emoji || "↗"}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "1.02rem" }}>{l.title}</strong>
                        <span style={{ fontSize: "0.76rem", color: "var(--accent-ink)", fontWeight: 700 }}>
                          {SHARE_APP_LABEL[l.app] ?? l.app}
                        </span>
                      </span>
                      {l.description ? (
                        <span style={{ display: "block", marginTop: 4, fontSize: "0.86rem", lineHeight: 1.55, color: "var(--text-dim)" }}>
                          {l.description}
                        </span>
                      ) : null}
                    </span>
                    <span aria-hidden="true" style={{ color: "var(--text-dim)" }}>
                      →
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}

          <p className="lead" style={{ marginTop: 26, fontSize: "0.9rem" }}>
            기록으로 남기려면 myjane 계정으로 로그인하면 돼요. 서비스 소개는{" "}
            <Link href="/link">서비스 링크</Link>에 있어요.
          </p>
        </section>
      </main>
    </div>
  );
}
