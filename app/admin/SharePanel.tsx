"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, adminErrorMessage, shortDate } from "@/lib/adminClient";

type Row = {
  id: string;
  title: string;
  description: string;
  url: string;
  app: string;
  emoji: string;
  order: number;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

const APPS = ["typelog", "fitlog", "snapword", "snapnote", "2hbk", "myjane"];
const EMPTY = { title: "", description: "", url: "", app: "typelog", emoji: "" };

/**
 * 공유형 링크 관리 — `/share` 에 나열되는 목록을 등록·수정·숨김·정렬·삭제한다.
 * 주소는 myjane 서비스 도메인의 https 만 받는다(서버가 막는다). 위·아래 버튼은 `order` 를 바꾼다.
 */
export function SharePanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<Row | null>(null);

  const apply = (links: Row[]) => setRows([...links].sort((a, b) => a.order - b.order));

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await adminApi<{ links: Row[] }>("/api/admin/share");
      apply(res.links);
    } catch (err) {
      setError(adminErrorMessage(err));
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<{ links: Row[] }>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      apply(res.links);
      return true;
    } catch (err) {
      setError(adminErrorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const create = async () => {
    const ok = await run(() => adminApi("/api/admin/share", { method: "POST", body: form }));
    if (ok) setForm(EMPTY);
  };
  const save = async () => {
    if (!editing) return;
    const { id, title, description, url, app, emoji } = editing;
    const ok = await run(() => adminApi(`/api/admin/share/${id}`, { method: "PATCH", body: { title, description, url, app, emoji } }));
    if (ok) setEditing(null);
  };
  const toggle = (r: Row) => run(() => adminApi(`/api/admin/share/${r.id}`, { method: "PATCH", body: { active: !r.active } }));
  const move = async (r: Row, dir: -1 | 1) => {
    if (!rows) return;
    const i = rows.findIndex((x) => x.id === r.id);
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const other = rows[j];
    /* 두 항목의 order 를 맞바꾼다. 같으면 인덱스로 벌려 준다 */
    const a = r.order === other.order ? j : other.order;
    const b = r.order === other.order ? i : r.order;
    await run(async () => {
      await adminApi(`/api/admin/share/${r.id}`, { method: "PATCH", body: { order: a } });
      return adminApi(`/api/admin/share/${other.id}`, { method: "PATCH", body: { order: b } });
    });
  };
  const remove = (r: Row) => {
    if (!confirm(`"${r.title}" 링크를 지울까요? 숨기기만 하려면 끄기를 쓰세요.`)) return;
    void run(() => adminApi(`/api/admin/share/${r.id}`, { method: "DELETE" }));
  };

  const field = (label: string, node: React.ReactNode) => (
    <label className="adm-field">
      <span className="adm-label">{label}</span>
      {node}
    </label>
  );

  const editor = (v: typeof EMPTY, set: (patch: Partial<typeof EMPTY>) => void) => (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="adm-row" style={{ gap: 10, alignItems: "flex-end" }}>
        {field("이모지", <input className="adm-input" style={{ width: 80 }} value={v.emoji} onChange={(e) => set({ emoji: e.target.value })} placeholder="🏃" />)}
        {field("서비스", (
          <select className="adm-input" value={v.app} onChange={(e) => set({ app: e.target.value })}>
            {APPS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        ))}
        <div style={{ flex: 1 }}>{field("제목", <input className="adm-input" value={v.title} onChange={(e) => set({ title: e.target.value })} placeholder="러닝 성향 · 나는 어떤 러너일까?" />)}</div>
      </div>
      {field("주소 (https · myjane 서비스 도메인)", <input className="adm-input" value={v.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://typelog.myjane.co.kr/r/…" />)}
      {field("설명", <textarea className="adm-textarea" rows={2} value={v.description} onChange={(e) => set({ description: e.target.value })} placeholder="친구가 나눈 결과를 보고 나도 바로 해볼 수 있어요." />)}
    </div>
  );

  return (
    <>
      <div className="adm-card">
        <p className="adm-card-title">새 링크 등록</p>
        <p className="adm-card-sub">앱 안에서 만든 공유 링크(예: TypeLog 결과 `/r/…`)를 붙여 넣어요. 등록하면 `/share` 맨 아래에 붙어요.</p>
        {editor(form, (p) => setForm((f) => ({ ...f, ...p })))}
        <div className="adm-row" style={{ marginTop: 12 }}>
          <button type="button" className="adm-btn" disabled={busy} onClick={() => void create()}>등록</button>
          <a className="adm-btn adm-btn--ghost" href="/share" target="_blank" rel="noreferrer">공개 화면 보기 ↗</a>
        </div>
        {error ? <p className="adm-msg adm-msg--bad">{error}</p> : null}
      </div>

      <div className="adm-card">
        <p className="adm-card-title">등록된 링크</p>
        <p className="adm-card-sub">위에 있는 것이 먼저 보여요. 끄면 목록에서 빠지고 지우지는 않아요.</p>
        {rows === null ? (
          <p className="adm-muted">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <p className="adm-empty">아직 없어요.</p>
        ) : (
          <div className="adm-list">
            {rows.map((r, i) => (
              <div key={r.id} className="adm-list-row" style={{ display: "grid", gap: 8 }}>
                {editing?.id === r.id ? (
                  <>
                    {editor(editing, (p) => setEditing((e) => (e ? { ...e, ...p } : e)))}
                    <div className="adm-row">
                      <button type="button" className="adm-btn adm-btn--sm" disabled={busy} onClick={() => void save()}>저장</button>
                      <button type="button" className="adm-btn adm-btn--sm adm-btn--ghost" onClick={() => setEditing(null)}>취소</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="adm-row" style={{ justifyContent: "space-between", gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <p className="adm-list-title" style={{ margin: 0 }}>
                          {r.emoji ? `${r.emoji} ` : ""}{r.title}
                          <span className={`adm-pill ${r.active ? "adm-pill--done" : "adm-pill--wait"}`} style={{ marginLeft: 8 }}>{r.active ? "켜짐" : "꺼짐"}</span>
                        </p>
                        <p className="adm-list-meta" style={{ margin: "4px 0 0" }}>
                          {r.app} · {shortDate(r.updatedAt)} · <a href={r.url} target="_blank" rel="noreferrer" className="adm-list-code">{r.url}</a>
                        </p>
                        {r.description ? <p className="adm-muted" style={{ margin: "4px 0 0" }}>{r.description}</p> : null}
                      </div>
                      <div className="adm-row" style={{ flex: "0 0 auto", gap: 6 }}>
                        <button type="button" className="adm-btn adm-btn--sm adm-btn--ghost" disabled={busy || i === 0} onClick={() => void move(r, -1)} title="위로">▲</button>
                        <button type="button" className="adm-btn adm-btn--sm adm-btn--ghost" disabled={busy || i === rows.length - 1} onClick={() => void move(r, 1)} title="아래로">▼</button>
                        <button type="button" className="adm-btn adm-btn--sm adm-btn--ghost" disabled={busy} onClick={() => setEditing(r)}>수정</button>
                        <button type="button" className="adm-btn adm-btn--sm adm-btn--ghost" disabled={busy} onClick={() => void toggle(r)}>{r.active ? "끄기" : "켜기"}</button>
                        <button type="button" className="adm-btn adm-btn--sm adm-btn--danger" disabled={busy} onClick={() => remove(r)}>삭제</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
