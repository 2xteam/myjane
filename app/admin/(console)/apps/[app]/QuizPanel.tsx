"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/lib/adminClient";
import { AdminModal } from "@/app/admin/AdminModal";
import { LicensePanel } from "./LicensePanel";
import { NotePanel } from "./NotePanel";

/**
 * 질문지 — 요약 카드 안의 「등록된 질문지」 목록 · 등록 다이얼로그 · 상세 다이얼로그(사용자 2026-11-18).
 *
 *   목록     상태(공개 · 공개 해제 · 종료) · 문항 · 응시 · 완주 · 「상세」. 전엔 요약의 「질문지별 응시」 표와
 *            위쪽 「등록된 질문지」 목록이 따로 있었다 → 하나로
 *   등록     「질문지 등록」 버튼 → 다이얼로그. JSON 을 붙여넣고 [검사] 한 뒤 [등록]
 *   상세     목록의 「상세」 → 다이얼로그. 화면 방식(experience)으로 데이터 칸을 고른다 —
 *            running → 러닝 자격증 목록, note → 러닝 노트 카드 목록
 *
 * 세부 검증은 그 앱의 검증기가 한다. 이 화면은 결과만 그린다.
 * 규격은 볼트에 있다 → my-obsidian-vault / 30-Patterns/설문지 JSON 작성 지침.md
 */

type Finding = { path: string; message: string };
type Report = {
  errors: Finding[];
  warnings: Finding[];
  distribution?: { code: string; count: number; pct: number }[];
  meanConfidence?: number | null;
  summary?: { itemCount: number; scoringItems: number; estimatedMinutes: number };
};
export type QuizRow = {
  slug: string;
  title: string;
  emoji?: string | null;
  /** 화면 방식 — running(러닝 자격증) · note(러닝 노트) · null(일반) */
  experience?: "running" | "note" | null;
  completed?: number;
  status: "draft" | "published" | "closed";
  itemCount: number;
  revision: number;
  contentRevision: number;
  attempts: number;
};

export const EXPERIENCE_LABEL: Record<string, string> = { running: "🏅 러닝 자격증", note: "☕ 러닝 노트" };

export const STATUS_LABEL: Record<QuizRow["status"], string> = {
  draft: "작성 중",
  published: "공개",
  closed: "종료",
};

/** 목록을 다시 읽게 하는 신호 — 등록 다이얼로그에서 등록하면 목록이 새로 고쳐진다 */
export function useQuizRows(appKey: string) {
  const [rows, setRows] = useState<QuizRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const data = await adminApi<{ quizzes: QuizRow[] }>(`/api/admin/apps/${appKey}/quizzes`);
      setRows(data.quizzes ?? []);
      setError(null);
    } catch (err) {
      setError(adminErrorMessage(err));
    }
  }, [appKey]);
  useEffect(() => {
    void load();
  }, [load]);
  return { rows, error, reload: load };
}

/** 요약 카드 안 — 등록된 질문지 목록 */
export function QuizList({
  appKey,
  rows,
  error,
  reload,
}: {
  appKey: string;
  rows: QuizRow[] | null;
  error: string | null;
  reload: () => Promise<void>;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [detail, setDetail] = useState<QuizRow | null>(null);

  const changeStatus = useCallback(
    async (slug: string, action: "publish" | "unpublish" | "close") => {
      try {
        await adminApi(`/api/admin/apps/${appKey}/quiz-status`, { method: "PATCH", body: { slug, action } });
        setMsg(null);
        await reload();
      } catch (err) {
        setMsg(adminErrorMessage(err));
      }
    },
    [appKey, reload],
  );

  return (
    <div style={{ marginTop: 22 }}>
      <p className="adm-card-title" style={{ marginBottom: 8 }}>
        등록된 질문지
      </p>
      {error ? <p className="adm-note adm-note--error">{error}</p> : null}
      {msg ? <p className="adm-msg adm-msg--bad">{msg}</p> : null}
      {rows === null ? null : rows.length === 0 ? (
        <p className="adm-card-sub">아직 없어요.</p>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table adm-quiz-table">
            <thead>
              <tr>
                <th>질문지</th>
                <th>상태</th>
                <th>문항</th>
                <th>응시</th>
                <th>완주</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.slug}>
                  <td>
                    <button type="button" className="adm-quiz-name" onClick={() => setDetail(q)}>
                      {q.emoji ? `${q.emoji} ` : ""}
                      {q.title}
                    </button>
                    <div className="adm-quiz-meta">
                      <code>{q.slug}</code>
                      {q.experience ? <span className="adm-chip">{EXPERIENCE_LABEL[q.experience] ?? q.experience}</span> : null}
                    </div>
                  </td>
                  <td>
                    <div className="adm-quiz-status">
                      <span className="adm-chip" data-tone={q.status === "published" ? "gold" : undefined}>
                        {STATUS_LABEL[q.status]}
                      </span>
                      {q.status === "published" ? (
                        <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => void changeStatus(q.slug, "unpublish")}>
                          공개 해제
                        </button>
                      ) : (
                        <button type="button" className="adm-btn adm-btn--sm" onClick={() => void changeStatus(q.slug, "publish")}>
                          공개
                        </button>
                      )}
                    </div>
                  </td>
                  <td>{q.itemCount}</td>
                  <td>{q.attempts.toLocaleString()}</td>
                  <td>
                    <b>{(q.completed ?? 0).toLocaleString()}</b>
                  </td>
                  <td>
                    <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setDetail(q)}>
                      상세
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail ? (
        <AdminModal
          wide={!!detail.experience}
          title={`${detail.emoji ? `${detail.emoji} ` : ""}${detail.title}`}
          sub={
            <>
              <code>{detail.slug}</code>
              {detail.experience ? ` · ${EXPERIENCE_LABEL[detail.experience] ?? detail.experience} 화면` : " · 일반 응시 화면"}
            </>
          }
          onClose={() => setDetail(null)}
        >
          <QuizDetail appKey={appKey} quiz={rows?.find((r) => r.slug === detail.slug) ?? detail} onStatus={changeStatus} />
        </AdminModal>
      ) : null}
    </div>
  );
}

/** 질문지 상세 — 숫자 · 상태 바꾸기 · 그 질문지의 데이터 칸 */
export function QuizDetail({
  appKey,
  quiz,
  onStatus,
}: {
  appKey: string;
  quiz: QuizRow;
  onStatus: (slug: string, action: "publish" | "unpublish" | "close") => Promise<void>;
}) {
  return (
    <>
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
          <p className="adm-stat-label">응시 · 완주</p>
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
      <div className="adm-row" style={{ marginTop: 12 }}>
        {quiz.status === "published" ? (
          <>
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => void onStatus(quiz.slug, "unpublish")}>
              공개 해제
            </button>
            <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => void onStatus(quiz.slug, "close")}>
              종료
            </button>
          </>
        ) : (
          <button type="button" className="adm-btn adm-btn--sm" onClick={() => void onStatus(quiz.slug, "publish")}>
            공개
          </button>
        )}
      </div>

      {quiz.experience === "running" ? <LicensePanel appKey={appKey} /> : null}
      {quiz.experience === "note" ? <NotePanel appKey={appKey} slug={quiz.slug} /> : null}
      {!quiz.experience ? <p className="adm-card-sub" style={{ marginTop: 16 }}>이 질문지는 따로 모아 볼 데이터가 아직 없어요. 응시 수는 위 숫자로 봐요.</p> : null}
    </>
  );
}

/** 질문지 등록 — 다이얼로그 안. 등록은 언제나 작성 중으로 들어간다 */
export function QuizRegister({ appKey, onSaved }: { appKey: string; onSaved: () => Promise<void> }) {
  const base = `/api/admin/apps/${appKey}/quizzes`;
  const [json, setJson] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState<"" | "check" | "save">("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const submit = useCallback(
    async (dryRun: boolean) => {
      setBusy(dryRun ? "check" : "save");
      setMsg(null);
      try {
        const parsed = JSON.parse(json);
        const data = await adminApi<{ report?: Report; slug?: string }>(`${base}${dryRun ? "?dryRun=1" : ""}`, {
          method: "POST",
          body: parsed,
        });
        if (data.report) setReport(data.report);
        setMsg({ text: dryRun ? "검사를 통과했어요. 등록할 수 있어요." : `"${data.slug}" 를 등록했어요.`, ok: true });
        if (!dryRun) {
          setJson("");
          setReport(null);
          await onSaved();
        }
      } catch (err) {
        // 검증 실패도 이 길로 온다 — 리포트가 함께 오면 그려 준다
        const withReport = err as { payload?: { report?: Report } };
        if (withReport?.payload?.report) setReport(withReport.payload.report);
        setMsg({ text: err instanceof SyntaxError ? "JSON 형식이 아니에요." : adminErrorMessage(err), ok: false });
      } finally {
        setBusy("");
      }
    },
    [json, base, onSaved],
  );

  const canSave = report != null && report.errors.length === 0;

  return (
    <>
      <p className="adm-card-sub">
        규격에 맞는 JSON 을 붙여넣고 검사해요. 새 질문지는 언제나 <strong>작성 중</strong> 으로 들어가고, 공개는 목록에서 따로 눌러요.
        공개된 질문지의 문장 · 화면 방식 · 순서는 <code>mode: &quot;content&quot;</code> 로 고쳐요.
      </p>
      <textarea
        className="adm-textarea"
        value={json}
        onChange={(e) => setJson(e.target.value)}
        placeholder={'{ "$schema": "typelog/quiz/v1", "mode": "upsert", "quiz": { … } }'}
        spellCheck={false}
      />
      <div className="adm-row" style={{ marginTop: 12 }}>
        <button type="button" className="adm-btn adm-btn--ghost" onClick={() => void submit(true)} disabled={!json.trim() || busy !== ""}>
          {busy === "check" ? "검사 중…" : "검사"}
        </button>
        <button type="button" className="adm-btn" onClick={() => void submit(false)} disabled={!canSave || busy !== ""}>
          {busy === "save" ? "등록 중…" : "등록"}
        </button>
      </div>
      {msg ? <p className={msg.ok ? "adm-msg adm-msg--ok" : "adm-msg adm-msg--bad"}>{msg.text}</p> : null}
      {report ? <ReportCard report={report} /> : null}
    </>
  );
}

function ReportCard({ report }: { report: Report }) {
  const { errors, warnings, distribution, meanConfidence, summary } = report;
  return (
    <div style={{ marginTop: 18 }}>
      <p className="adm-card-title">{errors.length ? `오류 ${errors.length}개를 고쳐야 해요` : "검사를 통과했어요"}</p>

      {summary ? (
        <div className="adm-row" style={{ marginTop: 10 }}>
          <span className="adm-chip">문항 {summary.itemCount}</span>
          <span className="adm-chip">채점 문항 {summary.scoringItems}</span>
          <span className="adm-chip">예상 {summary.estimatedMinutes}분</span>
          {meanConfidence != null ? (
            <span className="adm-chip" data-tone="gold">
              1·2등 평균 격차 {meanConfidence}
            </span>
          ) : null}
        </div>
      ) : null}

      <FindingList title="오류 — 고쳐야 등록돼요" items={errors} tone="bad" />
      <FindingList title="경고 — 등록은 되지만 봐 두세요" items={warnings} tone="warn" />

      {distribution?.length ? (
        <div style={{ marginTop: 20 }}>
          <p className="adm-sub-label">무작위 응답 2,000회 결과 분포</p>
          <div className="adm-bars">
            {distribution.map((d) => (
              <div key={d.code} className="adm-bar-row">
                <code className="adm-bar-code">{d.code}</code>
                <div className="adm-bar-track">
                  <div className="adm-bar-fill" data-hot={d.pct > 40} style={{ width: `${Math.min(d.pct, 100)}%` }} />
                </div>
                <span className="adm-bar-pct">{d.pct}%</span>
              </div>
            ))}
          </div>
          <p className="adm-card-sub" style={{ marginTop: 10 }}>
            무작위 응답은 실제 사람의 분포와 달라요. <strong>극단적으로 치우쳤는지만</strong> 봐요 — 한 코드가 40%를 넘거나 2% 미만이면 가중치를 다시 봐야 해요.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function FindingList({ title, items, tone }: { title: string; items: Finding[]; tone: "bad" | "warn" }) {
  if (!items.length) return null;
  return (
    <div style={{ marginTop: 16 }}>
      <p className="adm-sub-label" data-tone={tone}>
        {title}
      </p>
      <ul className="adm-findings">
        {items.map((f, i) => (
          <li key={`${f.path}-${i}`}>
            <code>{f.path}</code>
            <span>{f.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
