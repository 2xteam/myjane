"use client";

import Link from "next/link";
import { use, useCallback, useState } from "react";
import { adminApi, adminErrorMessage } from "@/lib/adminClient";
import { EXPERIENCE_LABEL, QuizDetail, useQuizRows } from "../../QuizPanel";

/**
 * 질문지 상세 — 주소로 바로 열 때(북마크 · 링크 공유). 평소에는 요약 목록의 「상세」 다이얼로그로 연다.
 * 내용은 다이얼로그와 같은 `QuizDetail` 하나다.
 */
export default function QuizDetailPage({ params }: { params: Promise<{ app: string; slug: string }> }) {
  const { app: appKey, slug } = use(params);
  const { rows, error, reload } = useQuizRows(appKey);
  const [msg, setMsg] = useState<string | null>(null);
  const quiz = rows?.find((q) => q.slug === slug) ?? null;

  const onStatus = useCallback(
    async (s: string, action: "publish" | "unpublish" | "close") => {
      try {
        await adminApi(`/api/admin/apps/${appKey}/quiz-status`, { method: "PATCH", body: { slug: s, action } });
        setMsg(null);
        await reload();
      } catch (err) {
        setMsg(adminErrorMessage(err));
      }
    },
    [appKey, reload],
  );

  return (
    <>
      <div className="adm-page-head">
        <Link className="adm-crumb" href={`/admin/apps/${appKey}`}>
          ← 질문지 목록
        </Link>
        <h1 className="adm-page-title">{quiz ? `${quiz.emoji ? `${quiz.emoji} ` : ""}${quiz.title}` : slug}</h1>
        <p className="adm-page-sub">
          <code>{slug}</code>
          {quiz?.experience ? ` · ${EXPERIENCE_LABEL[quiz.experience] ?? quiz.experience} 화면` : " · 일반 응시 화면"}
        </p>
      </div>
      {error || msg ? <p className="adm-card-sub">{error ?? msg}</p> : null}
      {rows && !quiz ? <p className="adm-card-sub">그 질문지가 없어요.</p> : null}
      {quiz ? (
        <section className="adm-card">
          <QuizDetail appKey={appKey} quiz={quiz} onStatus={onStatus} />
        </section>
      ) : null}
    </>
  );
}
