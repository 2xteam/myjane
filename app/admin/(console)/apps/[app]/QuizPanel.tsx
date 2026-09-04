"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/lib/adminClient";

/**
 * 질문지 등록 — JSON 을 붙여넣고 [검사] 한 뒤 [등록] 한다.
 *
 * 관리자는 문항을 하나하나 확인하지 않는다. 세부는 **그 앱의 검증기**가 본다.
 * 이 화면은 결과만 그린다 — 오류·경고 목록과 무작위 응답 분포 히스토그램.
 *
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
type QuizRow = {
  slug: string;
  title: string;
  status: "draft" | "published" | "closed";
  itemCount: number;
  revision: number;
  contentRevision: number;
  attempts: number;
};

const STATUS_LABEL: Record<QuizRow["status"], string> = {
  draft: "작성 중",
  published: "공개",
  closed: "종료",
};

export function QuizPanel({ appKey }: { appKey: string }) {
  const base = `/api/admin/apps/${appKey}/quizzes`;
  const statusUrl = `/api/admin/apps/${appKey}/quiz-status`;

  const [rows, setRows] = useState<QuizRow[] | null>(null);
  const [json, setJson] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState<"" | "check" | "save">("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminApi<{ quizzes: QuizRow[] }>(base);
      setRows(data.quizzes ?? []);
    } catch (err) {
      setMsg({ text: adminErrorMessage(err), ok: false });
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(
    async (dryRun: boolean) => {
      setBusy(dryRun ? "check" : "save");
      setMsg(null);
      try {
        const parsed = JSON.parse(json);
        const data = await adminApi<{ report?: Report; slug?: string }>(
          `${base}${dryRun ? "?dryRun=1" : ""}`,
          { method: "POST", body: parsed },
        );
        if (data.report) setReport(data.report);
        setMsg({
          text: dryRun ? "검사를 통과했어요. 등록할 수 있어요." : `"${data.slug}" 를 등록했어요.`,
          ok: true,
        });
        if (!dryRun) {
          setJson("");
          setReport(null);
          await load();
        }
      } catch (err) {
        // 검증 실패도 이 길로 온다 — 리포트가 함께 오면 그려 준다
        const withReport = err as { payload?: { report?: Report } };
        if (withReport?.payload?.report) setReport(withReport.payload.report);
        setMsg({
          text: err instanceof SyntaxError ? "JSON 형식이 아니에요." : adminErrorMessage(err),
          ok: false,
        });
      } finally {
        setBusy("");
      }
    },
    [json, base, load],
  );

  const changeStatus = useCallback(
    async (slug: string, action: "publish" | "unpublish" | "close") => {
      try {
        await adminApi(statusUrl, { method: "PATCH", body: { slug, action } });
        setMsg(null);
        await load();
      } catch (err) {
        setMsg({ text: adminErrorMessage(err), ok: false });
      }
    },
    [statusUrl, load],
  );

  const canSave = report != null && report.errors.length === 0;

  return (
    <section className="adm-section">
      <p className="adm-section-label">질문지</p>

      <div className="adm-card">
        <p className="adm-card-title">JSON 으로 등록</p>
        <p className="adm-card-sub">
          규격에 맞는 JSON 을 붙여넣고 검사해요. 등록은 언제나 <strong>작성 중</strong> 상태로
          들어가고, 공개는 아래 목록에서 따로 눌러요.
        </p>
        <textarea
          className="adm-textarea"
          value={json}
          onChange={(e) => setJson(e.target.value)}
          placeholder={'{ "$schema": "typelog/quiz/v1", "mode": "upsert", "quiz": { … } }'}
          spellCheck={false}
        />
        <div className="adm-row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="adm-btn adm-btn--ghost"
            onClick={() => void submit(true)}
            disabled={!json.trim() || busy !== ""}
          >
            {busy === "check" ? "검사 중…" : "검사"}
          </button>
          <button
            type="button"
            className="adm-btn"
            onClick={() => void submit(false)}
            disabled={!canSave || busy !== ""}
          >
            {busy === "save" ? "등록 중…" : "등록"}
          </button>
        </div>
        {msg ? (
          <p className={msg.ok ? "adm-msg adm-msg--ok" : "adm-msg adm-msg--bad"}>{msg.text}</p>
        ) : null}
      </div>

      {report ? <ReportCard report={report} /> : null}

      <div className="adm-card">
        <p className="adm-card-title">등록된 질문지</p>
        {rows === null ? null : rows.length === 0 ? (
          <p className="adm-card-sub">아직 없어요.</p>
        ) : (
          <div className="adm-list">
            {rows.map((q) => (
              <div key={q.slug} className="adm-list-row">
                <span className="adm-chip" data-tone={q.status === "published" ? "gold" : undefined}>
                  {STATUS_LABEL[q.status]}
                </span>
                <span className="adm-list-title">{q.title}</span>
                <code className="adm-list-code">{q.slug}</code>
                <span className="adm-list-meta">
                  문항 {q.itemCount} · 응답 {q.attempts} · rev {q.revision}/{q.contentRevision}
                </span>
                <span className="adm-list-gap" />
                {q.status === "draft" ? (
                  <button
                    type="button"
                    className="adm-btn adm-btn--sm"
                    onClick={() => void changeStatus(q.slug, "publish")}
                  >
                    공개
                  </button>
                ) : null}
                {q.status === "published" ? (
                  <>
                    <button
                      type="button"
                      className="adm-btn adm-btn--ghost adm-btn--sm"
                      onClick={() => void changeStatus(q.slug, "unpublish")}
                    >
                      공개 해제
                    </button>
                    <button
                      type="button"
                      className="adm-btn adm-btn--ghost adm-btn--sm"
                      onClick={() => void changeStatus(q.slug, "close")}
                    >
                      종료
                    </button>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ReportCard({ report }: { report: Report }) {
  const { errors, warnings, distribution, meanConfidence, summary } = report;
  return (
    <div className="adm-card">
      <p className="adm-card-title">
        {errors.length ? `오류 ${errors.length}개를 고쳐야 해요` : "검사를 통과했어요"}
      </p>

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
                  <div
                    className="adm-bar-fill"
                    data-hot={d.pct > 40}
                    style={{ width: `${Math.min(d.pct, 100)}%` }}
                  />
                </div>
                <span className="adm-bar-pct">{d.pct}%</span>
              </div>
            ))}
          </div>
          <p className="adm-card-sub" style={{ marginTop: 10 }}>
            무작위 응답은 실제 사람의 분포와 달라요. <strong>극단적으로 치우쳤는지만</strong> 봐요 —
            한 코드가 40%를 넘거나 2% 미만이면 가중치를 다시 봐야 해요.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function FindingList({
  title,
  items,
  tone,
}: {
  title: string;
  items: Finding[];
  tone: "bad" | "warn";
}) {
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
