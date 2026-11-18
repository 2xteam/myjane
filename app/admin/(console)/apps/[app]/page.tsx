"use client";

import { use, useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/lib/adminClient";
import { AdminModal } from "@/app/admin/AdminModal";
import { AppPanel, type AdminFeature } from "../../../AppPanel";
import { QuizList, QuizRegister, useQuizRows } from "./QuizPanel";
import { ReferralPanel } from "./ReferralPanel";

/**
 * 서버가 주는 기능 목록은 `AppPanel` 이 아는 것보다 넓다(`quizzes` 가 더 있다).
 * 그래서 경계에서는 문자열로 받고, `AppPanel` 에 넘길 때만 좁힌다.
 */
type AppInfo = { key: string; name: string; features: string[] };

const PANEL_FEATURES: AdminFeature[] = ["stats", "notices", "inquiries", "events"];

/**
 * 앱 하나의 관리 화면.
 *
 * 요약·공지·문의는 앱이 `stats`·`tables` 모양으로 돌려주므로 `AppPanel` 이 그대로 그린다.
 * 질문지가 있는 앱(TypeLog)은 화면을 한 장으로 줄였다(사용자 2026-11-18):
 *   위     「질문지 등록」 · 「공유 성과」 버튼 → 다이얼로그
 *   요약   숫자 + 「등록된 질문지」 목록(상태 · 응시 · 완주 · 상세 → 다이얼로그)
 *
 * 어느 쪽이든 저장·검사는 그 앱의 `/api/admin/*` 이 한다. 포털은 화면만 갖는다.
 * → my-obsidian-vault / 30-Patterns/통합 admin.md
 */
export default function AppAdminPage({ params }: { params: Promise<{ app: string }> }) {
  const { app: appKey } = use(params);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<"" | "register" | "referrals">("");

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
  return <AppAdmin appKey={appKey} info={info} open={open} setOpen={setOpen} />;
}

function AppAdmin({
  appKey,
  info,
  open,
  setOpen,
}: {
  appKey: string;
  info: AppInfo;
  open: "" | "register" | "referrals";
  setOpen: (v: "" | "register" | "referrals") => void;
}) {
  const panelFeatures = PANEL_FEATURES.filter((f) => info.features.includes(f));
  const hasQuizzes = info.features.includes("quizzes");
  const hasReferrals = info.features.includes("referrals");
  const quizzes = useQuizRows(appKey);

  const quizList = hasQuizzes ? <QuizList appKey={appKey} rows={quizzes.rows} error={quizzes.error} reload={quizzes.reload} /> : null;

  return (
    <>
      <div className="adm-page-head adm-page-head--actions">
        <div>
          <h1 className="adm-page-title">{info.name}</h1>
          <p className="adm-page-sub">데이터와 검증은 {info.name} 에 있어요. 이 화면은 그 앱의 관리 API 를 거쳐요.</p>
        </div>
        {hasQuizzes || hasReferrals ? (
          <div className="adm-row">
            {hasQuizzes ? (
              <button type="button" className="adm-btn" onClick={() => setOpen("register")}>
                ＋ 질문지 등록
              </button>
            ) : null}
            {hasReferrals ? (
              <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setOpen("referrals")}>
                공유 성과
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {panelFeatures.length ? (
        <AppPanel key={appKey} appKey={appKey} appName={info.name} features={panelFeatures} statsExtra={quizList} />
      ) : (
        quizList
      )}

      {open === "register" ? (
        <AdminModal title="질문지 등록" sub="JSON 으로 등록 · 검사" onClose={() => setOpen("")}>
          <QuizRegister appKey={appKey} onSaved={quizzes.reload} />
        </AdminModal>
      ) : null}
      {open === "referrals" ? (
        <AdminModal wide title="공유 성과" sub="결과 링크로 들어와 참여 · 가입까지" onClose={() => setOpen("")}>
          <div className="adm-modal-plain">
            <ReferralPanel appKey={appKey} />
          </div>
        </AdminModal>
      ) : null}
    </>
  );
}
