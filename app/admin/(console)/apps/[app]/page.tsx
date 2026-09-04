"use client";

import { use, useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/lib/adminClient";
import { AppPanel, type AdminFeature } from "../../../AppPanel";
import { QuizPanel } from "./QuizPanel";

/**
 * 서버가 주는 기능 목록은 `AppPanel` 이 아는 것보다 넓다(`quizzes` 가 더 있다).
 * 그래서 경계에서는 문자열로 받고, `AppPanel` 에 넘길 때만 좁힌다.
 */
type AppInfo = { key: string; name: string; features: string[] };

const PANEL_FEATURES: AdminFeature[] = ["stats", "notices", "inquiries", "events"];

/**
 * 앱 하나의 관리 화면.
 *
 * 요약·공지·문의는 앱이 `stats`·`tables` 모양으로 돌려주므로 `AppPanel` 이 그대로
 * 그린다. **질문지 등록만 다르다** — 큰 JSON 입력창·검증 리포트·분포 히스토그램은
 * 그 모양에 들어가지 않아 전용 화면(`QuizPanel`)을 둔다.
 *
 * 어느 쪽이든 저장·검사는 그 앱의 `/api/admin/*` 이 한다. 포털은 화면만 갖는다.
 * → my-obsidian-vault / 30-Patterns/통합 admin.md
 */
export default function AppAdminPage({ params }: { params: Promise<{ app: string }> }) {
  const { app: appKey } = use(params);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await adminApi<{ apps: AppInfo[] }>("/api/admin/me");
        const found = res.apps.find((a) => a.key === appKey);
        if (!found) {
          setError("그 앱은 관리 대상이 아니에요.");
          return;
        }
        setInfo(found);
      } catch (err) {
        setError(adminErrorMessage(err));
      }
    })();
  }, [appKey]);

  if (error) return <p className="adm-card-sub">{error}</p>;
  if (!info) return null;

  const panelFeatures = PANEL_FEATURES.filter((f) => info.features.includes(f));
  const hasQuizzes = info.features.includes("quizzes");

  return (
    <>
      <div className="adm-page-head">
        <h1 className="adm-page-title">{info.name}</h1>
        <p className="adm-page-sub">
          데이터와 검증은 {info.name} 에 있어요. 이 화면은 그 앱의 관리 API 를 거쳐요.
        </p>
      </div>

      {hasQuizzes ? <QuizPanel appKey={appKey} /> : null}

      {panelFeatures.length ? (
        <AppPanel key={appKey} appKey={appKey} appName={info.name} features={panelFeatures} />
      ) : null}
    </>
  );
}
