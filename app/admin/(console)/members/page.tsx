"use client";

import { useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/lib/adminClient";
import { MembersPanel } from "../../MembersPanel";

type Me = { name: string; role: "master" | "operator" };

/** 회원 관리 — **포털 자신의 `user` DB** 를 직접 읽는 유일한 화면이다 */
export default function MembersPage() {
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
        <h1 className="adm-page-title">회원 관리</h1>
        <p className="adm-page-sub">
          다섯 앱이 공유하는 회원이에요. 권한 변경은 마스터만 할 수 있어요.
        </p>
      </div>
      <MembersPanel isMaster={me.role === "master"} />
    </>
  );
}
