"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/lib/adminClient";
import { AppPanel, type AdminFeature } from "./AppPanel";
import { MembersPanel } from "./MembersPanel";
import "./admin.css";

type Me = { name: string; email: string | null; role: "master" | "operator" };
type AppInfo = { key: string; name: string; features: AdminFeature[] };

/**
 * 통합 admin — 앱을 탭으로 오가며 관리한다.
 *
 * **회원 탭만 포털 자신의 DB를 읽는다.** 나머지 앱 탭은 모두 그 앱의
 * `/api/admin/*` 을 거친다 — 스키마와 검증이 앱에 남는다.
 * → lib/adminApps.ts · lib/appAdminApi.ts
 *
 * 권한이 없으면 탭 구조조차 그리지 않는다. 무엇이 있는지 보여줄 이유가 없다.
 */
export default function AdminPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [tab, setTab] = useState("members");
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi<{ me: Me; apps: AppInfo[] }>("/api/admin/me");
        setMe(res.me);
        setApps(res.apps);
        setState("ok");
      } catch (err) {
        setError(adminErrorMessage(err));
        setState("denied");
      }
    })();
  }, []);

  if (state === "loading") return null;

  if (state === "denied") {
    return (
      <div className="adm" style={{ maxWidth: 460, paddingTop: 60 }}>
        <div className="adm-card">
          <p className="adm-card-title">관리자만 볼 수 있어요</p>
          <p className="adm-card-sub">{error}</p>
          <div className="adm-row" style={{ marginTop: 14 }}>
            <Link className="adm-btn" href="/login?next=%2Fadmin">
              로그인
            </Link>
            <Link className="adm-btn adm-btn--ghost" href="/">
              메인으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const current = apps.find((a) => a.key === tab) ?? null;

  return (
    <div className="adm">
      <header className="adm-bar">
        <h1 className="adm-title">myjane 관리</h1>
        <div className="adm-who">
          <span>{me?.name}</span>
          <span className="adm-role" data-role={me?.role}>
            {me?.role === "master" ? "마스터" : "운영자"}
          </span>
          <Link href="/" className="adm-muted" style={{ textDecoration: "none" }}>
            ← 메인
          </Link>
        </div>
      </header>

      <nav className="adm-tabs">
        <button
          type="button"
          className="adm-tab"
          data-active={tab === "members"}
          onClick={() => setTab("members")}
        >
          회원
        </button>
        {apps.map((a) => (
          <button
            key={a.key}
            type="button"
            className="adm-tab"
            data-active={tab === a.key}
            onClick={() => setTab(a.key)}
          >
            {a.name}
          </button>
        ))}
      </nav>

      {tab === "members" ? <MembersPanel isMaster={me?.role === "master"} /> : null}

      {current ? (
        <AppPanel
          key={current.key}
          appKey={current.key}
          appName={current.name}
          features={current.features}
        />
      ) : null}
    </div>
  );
}
