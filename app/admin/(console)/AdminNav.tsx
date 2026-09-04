"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminClient";

/**
 * 사이드바 내비 — 그룹으로 묶는다.
 *
 * 앱 목록은 서버가 준다(`/api/admin/me`). 지원하지 않는 기능을 링크로 두면
 * 앱이 죽은 것과 구분이 안 되는 404 를 부르게 되므로, **앱이 선언한 기능만** 그린다.
 * → my-obsidian-vault / 30-Patterns/통합 admin.md
 */

type AppInfo = { key: string; name: string; features: string[] };
type Me = { name: string; role: "master" | "operator" };

export function AdminNav() {
  const pathname = usePathname();
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await adminApi<{ me: Me; apps: AppInfo[] }>("/api/admin/me");
        setMe(res.me);
        setApps(res.apps);
      } catch {
        /* 권한이 없으면 각 화면이 스스로 안내한다 */
      }
    })();
  }, []);

  const groups: { label: string; items: { href: string; label: string; hint?: string }[] }[] = [
    {
      label: "대시보드",
      items: [{ href: "/admin", label: "요약" }],
    },
    {
      label: "운영",
      items: [{ href: "/admin/members", label: "회원 관리" }],
    },
    {
      label: "앱",
      items: apps.map((a) => ({
        href: `/admin/apps/${a.key}`,
        label: a.name,
        hint: a.features.includes("quizzes") ? "질문지" : undefined,
      })),
    },
  ];

  return (
    <nav className="adm-nav">
      {groups.map((g) => (
        <div key={g.label} className="adm-nav-group">
          <p className="adm-nav-label">{g.label}</p>
          <ul className="adm-nav-list">
            {g.items.length === 0 ? (
              <li className="adm-nav-empty">불러오는 중…</li>
            ) : (
              g.items.map((it) => {
                const active =
                  it.href === "/admin"
                    ? pathname === "/admin"
                    : pathname === it.href || pathname.startsWith(`${it.href}/`);
                return (
                  <li key={it.href}>
                    <Link href={it.href} className="adm-nav-item" data-active={active}>
                      <span>{it.label}</span>
                      {it.hint ? <span className="adm-nav-hint">{it.hint}</span> : null}
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ))}

      {me ? (
        <div className="adm-nav-me">
          <span className="adm-nav-me-name">{me.name}</span>
          <span className="adm-role" data-role={me.role}>
            {me.role === "master" ? "마스터" : "운영자"}
          </span>
        </div>
      ) : null}
    </nav>
  );
}
