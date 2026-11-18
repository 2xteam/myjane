"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/lib/adminClient";
import { EXPERIENCE_LABEL, STATUS_LABEL, type QuizRow } from "../../QuizPanel";
import { LicensePanel } from "../../LicensePanel";
import { NotePanel } from "../../NotePanel";

/**
 * 질문지 상세 — 질문지마다 쌓인 데이터는 여기서 본다(사용자 2026-11-18).
 *
 * 전에는 앱 화면에 질문지 목록과 러닝 자격증 목록이 한꺼번에 보였다. 이제는
 *   러닝 자격증 질문지(experience: running) 상세 → 러닝 자격증 목록
 *   러닝 노트 질문지(experience: note) 상세     → 러닝 노트 카드 목록
 * 어떤 칸을 보여 줄지는 질문지의 화면 방식으로 정한다(slug 를 코드에 박지 않는다).
 */
export default function QuizDetailPage({ params }: { params: Promise<{ app: string; slug: string }> }) {
  const { app: appKey, slug } = use(params);
  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await adminApi<{ quizzes: QuizRow[] }>(`/api/admin/apps/${appKey}/quizzes`);
        const found = (data.quizzes ?? []).find((q) => q.slug === slug);
        if (!found) setError("그 질문지가 없어요.");
        else setQuiz(found);
      } catch (err) {
        setError(adminErrorMessage(err));
      }
    })();
  }, [appKey, slug]);

  return (
    <>
      <div className="adm-page-head">
        <Link className="adm-crumb" href={`/admin/apps/${appKey}`}>
          ← 질문지 목록
        </Link>
        <h1 className="adm-page-title">
          {quiz ? `${quiz.emoji ? `${quiz.emoji} ` : ""}${quiz.title}` : slug}
        </h1>
        <p className="adm-page-sub">
          <code>{slug}</code>
          {quiz?.experience ? ` · ${EXPERIENCE_LABEL[quiz.experience] ?? quiz.experience} 화면` : " · 일반 응시 화면"}
        </p>
      </div>

      {error ? <p className="adm-card-sub">{error}</p> : null}

      {quiz ? (
        <section className="adm-card">
          <div className="adm-stats">
            <div className="adm-stat">
              <p className="adm-stat-label">상태</p>
              <p className="adm-stat-value">{STATUS_LABEL[quiz.status]}</p>
            </div>
            <div className="adm-stat">
              <p className="adm-stat-label">문항</p>
              <p className="adm-stat-value">{quiz.itemCount}</p>
            </div>
            <div className="adm-stat">
              <p className="adm-stat-label">응답 · 끝낸 것</p>
              <p className="adm-stat-value">
                {quiz.attempts} · {quiz.completed ?? "—"}
              </p>
            </div>
            <div className="adm-stat">
              <p className="adm-stat-label">rev · 문장 rev</p>
              <p className="adm-stat-value">
                {quiz.revision} · {quiz.contentRevision}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {quiz?.experience === "running" ? <LicensePanel appKey={appKey} /> : null}
      {quiz?.experience === "note" ? <NotePanel appKey={appKey} slug={slug} /> : null}
      {quiz && !quiz.experience ? (
        <p className="adm-card-sub">이 질문지는 따로 모아 볼 데이터가 아직 없어요. 응답 수는 위 숫자로 봐요.</p>
      ) : null}
    </>
  );
}
