"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/lib/adminClient";

type AppInfo = { key: string; name: string; features: string[] };
type Me = { name: string; role: "master" | "operator" };

const FEATURE_LABEL: Record<string, string> = {
  stats: "요약",
  notices: "공지",
  inquiries: "문의",
  events: "이벤트",
  quizzes: "질문지",
};

/**
 * 대시보드.
 *
 * **여기서 다섯 앱을 한꺼번에 부르지 않는다.** 앱 하나가 배포 중이면 대시보드
 * 전체가 느려지거나 실패한다. 회원 수만 포털 자기 DB 에서 읽고, 앱은 카드로
 * 안내만 한다 — 숫자는 그 앱 화면에 들어가서 본다.
 */
export default function AdminDashboard() {
  const [me, setMe] = useState<Me | null>(null);
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [users, setUsers] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await adminApi<{ me: Me; apps: AppInfo[] }>("/api/admin/me");
        setMe(res.me);
        setApps(res.apps);
        const u = await adminApi<{ total: number }>("/api/admin/users");
        setUsers(u.total);
      } catch (err) {
        setError(adminErrorMessage(err));
      }
    })();
  }, []);

  if (error) {
    return (
      <div className="adm-card" style={{ maxWidth: 460 }}>
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
    );
  }

  return (
    <>
      <div className="adm-page-head">
        <h1 className="adm-page-title">요약</h1>
        <p className="adm-page-sub">
          {me ? `${me.name} 님, 어서 오세요.` : ""} 앱별 숫자는 각 앱 화면에서 봐요.
        </p>
      </div>

      <div className="adm-tiles">
        <Link href="/admin/members" className="adm-tile">
          <span className="adm-tile-label">회원</span>
          <span className="adm-tile-value">{users ?? "…"}</span>
          <span className="adm-tile-note">다섯 앱 공용</span>
        </Link>
        <div className="adm-tile adm-tile--plain">
          <span className="adm-tile-label">앱</span>
          <span className="adm-tile-value">{apps.length || "…"}</span>
          <span className="adm-tile-note">관리 API 가 붙은 앱</span>
        </div>
      </div>

      <div className="adm-section">
        <p className="adm-section-label">앱</p>
        <div className="adm-app-grid">
          {apps.map((a) => (
            <Link key={a.key} href={`/admin/apps/${a.key}`} className="adm-app-card">
              <span className="adm-app-name">{a.name}</span>
              <span className="adm-app-features">
                {a.features.map((f) => (
                  <span key={f} className="adm-chip">
                    {FEATURE_LABEL[f] ?? f}
                  </span>
                ))}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
