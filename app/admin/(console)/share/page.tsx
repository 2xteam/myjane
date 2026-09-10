"use client";

import { useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/lib/adminClient";
import { SharePanel } from "../../SharePanel";

type Me = { name: string; role: "master" | "operator" };

/** 공유 링크 관리 — `/share` 공개 화면의 목록. 포털 자신의 데이터(`user` DB `share_links`) */
export default function SharePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await adminApi<{ me: Me }>("/api/admin/me");
        setMe(res.me);
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
        <h1 className="adm-page-title">공유 링크</h1>
        <p className="adm-page-sub">
          SNS 프로필에서 열리는 <code>/share</code> 목록이에요. 앱에서 만든 공유 링크를 등록하고 순서를 정해요.
        </p>
      </div>
      <SharePanel />
    </>
  );
}
