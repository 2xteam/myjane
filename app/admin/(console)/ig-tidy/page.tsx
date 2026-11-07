"use client";

import { useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/lib/adminClient";
import { IgTidyPanel } from "../../IgTidyPanel";

type Me = { name: string; role: "master" | "operator" };

/** IG Tidy 관리 — 포털 자신의 데이터(`igtidy` DB). 데스크톱 앱이라 앱 탭이 아니라 운영 묶음에 둔다 */
export default function IgTidyPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setMe((await adminApi<{ me: Me }>("/api/admin/me")).me);
      } catch (err) {
        setError(adminErrorMessage(err));
      }
    })();
  }, []);

  if (error) return <p className="adm-card-sub">{error}</p>;
  if (!me) return null;

  return (
    <>
      <div className="adm-page-head">
        <h1 className="adm-page-title">IG Tidy</h1>
        <p className="adm-page-sub">
          인스타그램 정리 도우미(윈도우 앱)를 쓰는 사람 · 실행 · 운영 설정 · 배포 버전이에요.
        </p>
      </div>
      <IgTidyPanel />
    </>
  );
}
