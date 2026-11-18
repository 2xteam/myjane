"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/lib/adminClient";
import { useConfirm } from "@/app/admin/ConfirmDialog";

/**
 * 러닝 노트 카드 목록 — 「나의 러닝 MBTI는?」 을 끝낸 사람들이 받은 카드(사용자 2026-11-18).
 *
 * 카드 색(아이덴티티 컬러 4색) · 글자색 · 메시는 TypeLog `/api/admin/notes` 가 결과 화면과 같은 계산으로
 * 만들어 내려 준다. 포털은 그리기만. 러닝 자격증 목록(LicensePanel)과 같은 틀 — 회원 구분 · 유형 고르기 ·
 * 골라서 지우기(테스트 기록 정리, 확인 창).
 * → my-obsidian-vault / 50-Plans/K 러닝 노트.md
 */

type Axis = { axis: string; pole: string; pct: number; strength: string; color: { ko: string; en: string; hex: string } };
type Item = {
  id: string;
  completedAt: string;
  attemptNo: number;
  owner: "member" | "guest";
  member: { nickname: string | null; email: string | null; phone: string | null } | null;
  runner: string;
  result: { code: string; name: string; emoji: string };
  card: { ink: string; scrim: number; contrast: number; back: string; meshImage: string; meshBase: string; roast: string; axes: Axis[] };
  link: string | null;
  views: number;
  viaLink: boolean;
  conversion: string | null;
};
type Data = {
  total: number;
  page: number;
  pages: number;
  counts: Record<string, { name: string; emoji: string; member: number; guest: number }>;
  items: Item[];
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const dot = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

export function NotePanel({ appKey, slug }: { appKey: string; slug: string }) {
  const [who, setWho] = useState<"all" | "member" | "guest">("all");
  const [code, setCode] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { ask, dialog } = useConfirm();

  const label = (it: Item) => `${it.runner} · ${it.result.code} · ${it.owner === "member" ? "회원" : "비회원"} · ${when(it.completedAt)}`;
  const toggle = (it: Item) =>
    setPicked((m) => {
      const n = new Map(m);
      if (n.has(it.id)) n.delete(it.id);
      else n.set(it.id, label(it));
      return n;
    });

  const load = useCallback(async () => {
    setError(null);
    try {
      const q = new URLSearchParams({ slug, who, page: String(page) });
      if (code !== "all") q.set("code", code);
      setData(await adminApi<Data>(`/api/admin/apps/${appKey}/notes?${q}`));
    } catch (err) {
      setError(adminErrorMessage(err));
    }
  }, [appKey, slug, who, code, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageIds = data?.items.map((i) => i.id) ?? [];
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => picked.has(id));
  const pickPage = () =>
    setPicked((m) => {
      const n = new Map(m);
      for (const it of data?.items ?? []) {
        if (allOnPage) n.delete(it.id);
        else n.set(it.id, label(it));
      }
      return n;
    });

  const removePicked = async () => {
    const ids = [...picked.keys()];
    if (!ids.length) return;
    const labels = [...picked.values()];
    const ok = await ask({
      title: `러닝 노트 카드 ${ids.length}장을 지울까요?`,
      lines: [
        ...labels.slice(0, 8),
        ...(labels.length > 8 ? [`… 외 ${labels.length - 8}장`] : []),
        "기록이 지워지고 결과 링크는 「없는 링크」가 돼요. 되돌릴 수 없어요.",
      ],
      confirmLabel: "지우기",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await adminApi<{ deleted: number }>(`/api/admin/apps/${appKey}/notes`, {
        method: "POST",
        body: { deleteIds: ids, slug },
      });
      setPicked(new Map());
      setNote(`🗑️ ${r.deleted}장을 지웠어요.`);
      await load();
    } catch (err) {
      setNote(adminErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const counts = data
    ? Object.entries(data.counts)
        .map(([c, v]) => ({ code: c, ...v, n: v.member + v.guest }))
        .sort((a, b) => b.n - a.n)
    : [];
  const sum = counts.reduce((n, c) => ({ member: n.member + c.member, guest: n.guest + c.guest }), { member: 0, guest: 0 });

  return (
    <section className="adm-card">
      <h2 className="adm-card-title">러닝 노트 카드</h2>
      <p className="adm-card-sub">
        끝낸 사람들이 받은 카드예요. 최근 순. 색은 답에서 나온 아이덴티티 컬러라 결과 화면과 같아요.
      </p>

      {data ? (
        <div className="adm-stats">
          <div className="adm-stat">
            <p className="adm-stat-label">전체</p>
            <p className="adm-stat-value">{sum.member + sum.guest}</p>
          </div>
          <div className="adm-stat">
            <p className="adm-stat-label">회원 · 비회원</p>
            <p className="adm-stat-value">
              {sum.member} · {sum.guest}
            </p>
          </div>
          <div className="adm-stat">
            <p className="adm-stat-label">나온 유형</p>
            <p className="adm-stat-value">{counts.length} / 16</p>
          </div>
        </div>
      ) : null}

      <div className="adm-lic-bar">
        <div className="adm-lic-seg" role="radiogroup" aria-label="회원 구분">
          {(
            [
              ["all", "전체"],
              ["member", "회원"],
              ["guest", "비회원"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={who === v}
              className="adm-chip"
              data-on={who === v}
              onClick={() => {
                setWho(v);
                setPage(1);
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="adm-lic-seg" role="radiogroup" aria-label="유형">
          <button
            type="button"
            role="radio"
            aria-checked={code === "all"}
            className="adm-chip"
            data-on={code === "all"}
            onClick={() => {
              setCode("all");
              setPage(1);
            }}
          >
            모든 유형
          </button>
          {counts.map((c) => (
            <button
              key={c.code}
              type="button"
              role="radio"
              aria-checked={code === c.code}
              className="adm-chip"
              data-on={code === c.code}
              title={c.name}
              onClick={() => {
                setCode(c.code);
                setPage(1);
              }}
            >
              {c.emoji} {c.code} {c.n}
            </button>
          ))}
        </div>
      </div>

      <div className="adm-lic-pick">
        <button type="button" className="adm-chip" onClick={pickPage} disabled={!pageIds.length}>
          {allOnPage ? "이 쪽 선택 풀기" : "이 쪽 모두 선택"}
        </button>
        {picked.size ? (
          <button type="button" className="adm-chip" onClick={() => setPicked(new Map())}>
            선택 해제
          </button>
        ) : null}
        <button
          type="button"
          className="adm-btn adm-btn--sm adm-btn--solid-danger"
          disabled={!picked.size || busy}
          onClick={() => void removePicked()}
        >
          {busy ? "지우는 중…" : `🗑️ 선택 삭제${picked.size ? ` (${picked.size})` : ""}`}
        </button>
        {note ? <span className="adm-muted">{note}</span> : null}
      </div>

      {error ? <p className="adm-card-sub">{error}</p> : null}
      {data && !data.items.length ? <p className="adm-card-sub">해당하는 카드가 없어요.</p> : null}

      {data?.items.length ? (
        <div className="adm-note-grid">
          {data.items.map((it) => (
            <NoteCard key={it.id} it={it} picked={picked.has(it.id)} onPick={() => toggle(it)} />
          ))}
        </div>
      ) : null}

      {data && data.pages > 1 ? (
        <div className="adm-lic-pager">
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← 이전
          </button>
          <span className="adm-muted">
            {data.page} / {data.pages} 쪽 · {data.total}장
          </span>
          <button
            type="button"
            className="adm-btn adm-btn--ghost adm-btn--sm"
            disabled={page >= data.pages}
            onClick={() => setPage(page + 1)}
          >
            다음 →
          </button>
        </div>
      ) : null}
      {dialog}
    </section>
  );
}

function NoteCard({ it, picked, onPick }: { it: Item; picked: boolean; onPick: () => void }) {
  const c = it.card;
  return (
    <article className="adm-note" data-picked={picked}>
      <label className="adm-lic-check">
        <input type="checkbox" checked={picked} onChange={onPick} aria-label={`${it.runner} 카드 선택`} />
      </label>
      <div
        className="adm-note-card"
        style={{ "--note-ink": c.ink, backgroundColor: c.meshBase, backgroundImage: c.meshImage } as React.CSSProperties}
      >
        {c.scrim ? <div className="adm-note-scrim" style={{ background: "#000", opacity: c.scrim }} /> : null}
        <div className="adm-note-top">
          <span>Running Note</span>
          <span>No. {String(it.attemptNo).padStart(2, "0")}</span>
        </div>
        <p className="adm-note-code">{it.result.code}</p>
        <p className="adm-note-name">{it.result.name}</p>
        <dl className="adm-note-table">
          <div>
            <dt>Runner</dt>
            <dd>{it.runner}</dd>
          </div>
          {c.axes.map((a) => (
            <div key={a.axis}>
              <dt>{a.axis}</dt>
              <dd>{a.pole}</dd>
            </div>
          ))}
        </dl>
        <div className="adm-note-foot">
          <span>◆ MyJane</span>
          <span>{dot(it.completedAt)}</span>
        </div>
      </div>
      <div className="adm-note-colors">
        {c.axes.map((a) => (
          <span key={a.axis} title={`${a.color.en} ${a.color.hex} · ${a.pct}%`}>
            <i style={{ background: a.color.hex }} />
            {a.color.ko} · {a.strength}
          </span>
        ))}
      </div>
      <div className="adm-lic-meta">
        <p>
          <span className={`adm-pill ${it.owner === "member" ? "adm-pill--done" : "adm-pill--wait"}`}>
            {it.owner === "member" ? "회원" : "비회원"}
          </span>{" "}
          {it.member ? (
            <>
              <b>{it.member.nickname ?? "(닉네임 없음)"}</b>{" "}
              <span className="adm-muted">{[it.member.email, it.member.phone].filter(Boolean).join(" · ")}</span>
            </>
          ) : null}
        </p>
        <p className="adm-muted">
          {it.result.emoji} {it.result.name} · 로스팅 {c.roast} · 글자 대비 {c.contrast}:1 · {when(it.completedAt)}
          {it.viaLink ? " · 공유 링크로 참여" : ""}
          {it.conversion === "signup" ? " · 가입 전환" : ""}
        </p>
        {it.link ? (
          <a className="adm-chip" href={it.link} target="_blank" rel="noreferrer">
            결과 링크 열기 ↗ (조회 {it.views})
          </a>
        ) : (
          <span className="adm-muted">결과 링크 없음</span>
        )}
      </div>
    </article>
  );
}
