"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, adminErrorMessage, shortDate } from "@/lib/adminClient";

export type AdminFeature = "stats" | "notices" | "inquiries" | "events";

type Stat = { label: string; value: number };
/** 타일로는 못 담는 순위·추이. 앱이 보내면 그대로 그린다 */
type Table = { title: string; columns: string[]; rows: (string | number)[][] };
type Notice = { id: string; title: string; content: string; pinned: boolean; createdAt: string | null };
type Inquiry = {
  id: string;
  name: string;
  phone: string;
  category: string;
  title: string;
  content: string;
  status: string;
  answer: string;
  answeredAt: string | null;
  createdAt: string | null;
};

const FEATURE_LABEL: Record<AdminFeature, string> = {
  stats: "요약",
  notices: "공지",
  inquiries: "문의",
  events: "이벤트",
};

/**
 * 앱 탭 — 요약·공지·문의를 다룬다.
 *
 * 포털은 앱의 DB를 직접 읽지 않는다. 모두 그 앱의 `/api/admin/*` 을 거친다.
 * 그래서 스키마와 검증이 앱에 남고, 포털은 화면만 그린다.
 */
export function AppPanel({
  appKey,
  appName,
  features,
}: {
  appKey: string;
  appName: string;
  features: AdminFeature[];
}) {
  const available = features.filter((f) => f !== "events");
  const [view, setView] = useState<AdminFeature>(available[0] ?? "stats");

  // 앱을 바꾸면 그 앱이 지원하는 첫 화면으로 되돌린다
  useEffect(() => {
    setView(available[0] ?? "stats");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appKey]);

  return (
    <>
      {available.length > 1 ? (
        <div className="adm-subtabs">
          {available.map((f) => (
            <button
              key={f}
              type="button"
              className="adm-subtab"
              data-active={view === f}
              onClick={() => setView(f)}
            >
              {FEATURE_LABEL[f]}
            </button>
          ))}
        </div>
      ) : null}

      {view === "stats" ? <StatsView appKey={appKey} appName={appName} /> : null}
      {view === "notices" ? <NoticesView appKey={appKey} appName={appName} /> : null}
      {view === "inquiries" ? <InquiriesView appKey={appKey} appName={appName} /> : null}
    </>
  );
}

/* ────────────────────────────── 요약 ────────────────────────────── */

function StatsView({ appKey, appName }: { appKey: string; appName: string }) {
  const [stats, setStats] = useState<Stat[] | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [dbName, setDbName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStats(null);
    setTables([]);
    setError(null);
    (async () => {
      try {
        const res = await adminApi<{ stats: Stat[]; tables?: Table[]; dbName?: string }>(
          `/api/admin/apps/${appKey}/stats`,
        );
        setStats(res.stats);
        setTables(res.tables ?? []);
        setDbName(res.dbName ?? null);
      } catch (err) {
        setError(adminErrorMessage(err));
        setStats([]);
      }
    })();
  }, [appKey]);

  return (
    <div className="adm-card">
      <p className="adm-card-title">{appName} 요약</p>
      <p className="adm-card-sub">
        {dbName ? `${dbName} DB의 현재 건수입니다.` : "현재 건수입니다."} 세는 항목은 앱이 정합니다 —
        앱에서 항목을 늘리면 여기에 그대로 나옵니다.
      </p>

      {error ? <p className="adm-note adm-note--error">{error}</p> : null}

      {stats === null ? (
        <p className="adm-empty">불러오는 중…</p>
      ) : stats.length === 0 ? (
        <p className="adm-empty">보여줄 수치가 없습니다.</p>
      ) : (
        <div className="adm-stats">
          {stats.map((s) => (
            <div className="adm-stat" key={s.label}>
              <div className="adm-stat-label">{s.label}</div>
              <div className="adm-stat-value">{s.value.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {tables.map((t) => (
        <div key={t.title} style={{ marginTop: 22 }}>
          <p className="adm-card-title" style={{ marginBottom: 8 }}>
            {t.title}
          </p>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  {t.columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>
                        {typeof cell === "number" ? cell.toLocaleString() : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────── 공지 ────────────────────────────── */

function NoticesView({ appKey, appName }: { appKey: string; appName: string }) {
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await adminApi<{ notices: Notice[] }>(`/api/admin/apps/${appKey}/notices`);
      setNotices(res.notices);
    } catch (err) {
      setError(adminErrorMessage(err));
      setNotices([]);
    }
  }, [appKey]);

  useEffect(() => {
    setNotices(null);
    void load();
  }, [load]);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await adminApi<{ notices: Notice[] }>(`/api/admin/apps/${appKey}/notices`, {
        method: "POST",
        body: { title, content, pinned },
      });
      setNotices(res.notices);
      setTitle("");
      setContent("");
      setPinned(false);
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function togglePin(n: Notice) {
    try {
      const res = await adminApi<{ notices: Notice[] }>(`/api/admin/apps/${appKey}/notices`, {
        method: "PATCH",
        body: { id: n.id, pinned: !n.pinned },
      });
      setNotices(res.notices);
    } catch (err) {
      setError(adminErrorMessage(err));
    }
  }

  async function remove(n: Notice) {
    if (!confirm(`"${n.title}" 공지를 내릴까요?`)) return;
    try {
      const res = await adminApi<{ notices: Notice[] }>(
        `/api/admin/apps/${appKey}/notices?id=${encodeURIComponent(n.id)}`,
        { method: "DELETE" },
      );
      setNotices(res.notices);
    } catch (err) {
      setError(adminErrorMessage(err));
    }
  }

  return (
    <>
      <div className="adm-card">
        <p className="adm-card-title">{appName} 공지 발행</p>
        <p className="adm-card-sub">발행하면 그 앱의 공지 화면에 바로 나갑니다.</p>

        <form onSubmit={publish}>
          <div className="adm-field">
            <label className="adm-label" htmlFor="notice-title">
              제목
            </label>
            <input
              id="notice-title"
              className="adm-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
            />
          </div>

          <div className="adm-field">
            <label className="adm-label" htmlFor="notice-content">
              내용
            </label>
            <textarea
              id="notice-content"
              className="adm-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>

          <div className="adm-row">
            <label className="adm-row" style={{ gap: 6, fontSize: 12.5, cursor: "pointer" }}>
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              맨 위에 고정
            </label>
            <button className="adm-btn" type="submit" disabled={busy}>
              {busy ? "발행하는 중…" : "발행"}
            </button>
          </div>
        </form>

        {error ? (
          <p className="adm-note adm-note--error" style={{ marginTop: 12 }}>
            {error}
          </p>
        ) : null}
      </div>

      <div className="adm-card">
        <p className="adm-card-title">발행된 공지</p>
        {notices === null ? (
          <p className="adm-empty">불러오는 중…</p>
        ) : notices.length === 0 ? (
          <p className="adm-empty">아직 공지가 없습니다.</p>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>제목</th>
                  <th>내용</th>
                  <th>발행일</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {notices.map((n) => (
                  <tr key={n.id}>
                    <td style={{ fontWeight: 700 }}>
                      {n.pinned ? <span className="adm-pill">고정</span> : null} {n.title}
                    </td>
                    <td className="adm-wrap-cell adm-muted">{n.content}</td>
                    <td className="adm-muted">{shortDate(n.createdAt)}</td>
                    <td>
                      <div className="adm-row" style={{ gap: 6 }}>
                        <button className="adm-btn adm-btn--ghost" onClick={() => togglePin(n)}>
                          {n.pinned ? "고정 해제" : "고정"}
                        </button>
                        <button className="adm-btn adm-btn--danger" onClick={() => remove(n)}>
                          내리기
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* ────────────────────────────── 문의 ────────────────────────────── */

function InquiriesView({ appKey, appName }: { appKey: string; appName: string }) {
  const [items, setItems] = useState<Inquiry[] | null>(null);
  const [onlyWaiting, setOnlyWaiting] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await adminApi<{ inquiries: Inquiry[] }>(`/api/admin/apps/${appKey}/inquiries`);
      setItems(res.inquiries);
    } catch (err) {
      setError(adminErrorMessage(err));
      setItems([]);
    }
  }, [appKey]);

  useEffect(() => {
    setItems(null);
    void load();
  }, [load]);

  async function answer(q: Inquiry) {
    const text = (drafts[q.id] ?? "").trim();
    if (!text) return;

    setBusy(q.id);
    setError(null);
    try {
      const res = await adminApi<{ inquiries: Inquiry[] }>(`/api/admin/apps/${appKey}/inquiries`, {
        method: "PATCH",
        body: { id: q.id, answer: text },
      });
      setItems(res.inquiries);
      setDrafts((d) => ({ ...d, [q.id]: "" }));
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const shown = (items ?? []).filter((q) => (onlyWaiting ? q.status !== "answered" : true));
  const waiting = (items ?? []).filter((q) => q.status !== "answered").length;

  return (
    <div className="adm-card">
      <p className="adm-card-title">{appName} 문의</p>
      <p className="adm-card-sub">
        답변을 저장하면 상태가 <strong>답변 완료</strong>로 함께 바뀝니다.
        {waiting > 0 ? ` 지금 ${waiting}건이 답을 기다립니다.` : ""}
      </p>

      <div className="adm-row" style={{ marginBottom: 12 }}>
        <label className="adm-row" style={{ gap: 6, fontSize: 12.5, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={onlyWaiting}
            onChange={(e) => setOnlyWaiting(e.target.checked)}
          />
          답변 대기만 보기
        </label>
        <button className="adm-btn adm-btn--ghost" onClick={() => void load()}>
          새로고침
        </button>
      </div>

      {error ? <p className="adm-note adm-note--error">{error}</p> : null}

      {items === null ? (
        <p className="adm-empty">불러오는 중…</p>
      ) : shown.length === 0 ? (
        <p className="adm-empty">
          {onlyWaiting ? "답변을 기다리는 문의가 없습니다." : "문의가 없습니다."}
        </p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {shown.map((q) => (
            <div
              key={q.id}
              style={{
                padding: 14,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-secondary)",
              }}
            >
              <div className="adm-row" style={{ gap: 8 }}>
                <span
                  className={q.status === "answered" ? "adm-pill adm-pill--done" : "adm-pill adm-pill--wait"}
                >
                  {q.status === "answered" ? "답변 완료" : "대기"}
                </span>
                <strong style={{ fontSize: 13 }}>{q.title}</strong>
                <span className="adm-muted" style={{ fontSize: 11.5, marginLeft: "auto" }}>
                  {q.name} · {q.category || "일반"} · {shortDate(q.createdAt)}
                </span>
              </div>

              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: 12.5,
                  lineHeight: 1.75,
                  whiteSpace: "pre-wrap",
                  wordBreak: "keep-all",
                }}
              >
                {q.content}
              </p>

              {q.answer ? (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: "1px solid var(--border-subtle)",
                  }}
                >
                  <div className="adm-label">답변 · {shortDate(q.answeredAt)}</div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12.5,
                      lineHeight: 1.75,
                      whiteSpace: "pre-wrap",
                      wordBreak: "keep-all",
                    }}
                  >
                    {q.answer}
                  </p>
                </div>
              ) : null}

              <div style={{ marginTop: 12 }}>
                <textarea
                  className="adm-textarea"
                  placeholder={q.answer ? "답변을 고쳐 씁니다" : "답변을 입력하세요"}
                  value={drafts[q.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                />
                <div className="adm-row" style={{ marginTop: 8 }}>
                  <button
                    className="adm-btn"
                    onClick={() => answer(q)}
                    disabled={busy === q.id || !(drafts[q.id] ?? "").trim()}
                  >
                    {busy === q.id ? "저장하는 중…" : "답변 저장"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
