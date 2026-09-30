"use client";

import { useEffect, useState } from "react";

/**
 * 관리 화면 공용 **페이징 · 정렬** 부품.
 *
 *   const [list, setList] = useState<ListQuery>(listQueryDefaults("createdAt"));
 *   … fetch(`/api/…?${listQueryParams(list)}`) → { total }
 *
 *   <SortableTh label="가입일" sortKey="createdAt" query={list} onChange={setList} />
 *   <Pagination query={list} total={total} onChange={setList} />
 *
 * 서버는 `page`(1부터) · `pageSize` · `sort` · `dir`(asc|desc) 를 받아 `total` 을 돌려준다
 * → app/api/admin/users/route.ts 가 첫 사용처다.
 * 정렬이나 쪽 크기를 바꾸면 1쪽으로 돌아간다(없는 쪽에 머물지 않게).
 */

export type SortDir = "asc" | "desc";

export type ListQuery = {
  page: number;
  pageSize: number;
  sort: string;
  dir: SortDir;
};

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;
/** 직접 입력의 상한 — 서버도 같은 값으로 자른다 */
export const MAX_PAGE_SIZE = 500;

export function listQueryDefaults(sort: string, dir: SortDir = "desc", pageSize = DEFAULT_PAGE_SIZE): ListQuery {
  return { page: 1, pageSize, sort, dir };
}

/** 쿼리스트링 조각 — `page=1&pageSize=20&sort=createdAt&dir=desc` */
export function listQueryParams(q: ListQuery): string {
  return new URLSearchParams({
    page: String(q.page),
    pageSize: String(q.pageSize),
    sort: q.sort,
    dir: q.dir,
  }).toString();
}

/* ────────────────────────── 정렬 머리칸 ────────────────────────── */

/**
 * 누르면 정렬한다. 같은 열을 다시 누르면 방향이 바뀐다.
 * 새 열을 처음 누를 때의 방향은 `firstDir` — 날짜·숫자는 큰 것부터(desc)가 자연스럽다.
 */
export function SortableTh({
  label,
  sortKey,
  query,
  onChange,
  firstDir = "asc",
}: {
  label: string;
  sortKey: string;
  query: ListQuery;
  onChange: (next: ListQuery) => void;
  firstDir?: SortDir;
}) {
  const active = query.sort === sortKey;
  const nextDir: SortDir = active ? (query.dir === "asc" ? "desc" : "asc") : firstDir;
  const arrow = !active ? "↕" : query.dir === "asc" ? "▲" : "▼";
  return (
    <th aria-sort={active ? (query.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className={`adm-sort${active ? " adm-sort--active" : ""}`}
        onClick={() => onChange({ ...query, sort: sortKey, dir: nextDir, page: 1 })}
        title={`${label} ${nextDir === "asc" ? "오름차순" : "내림차순"}으로 정렬`}
      >
        {label}
        <span className="adm-sort-arrow" aria-hidden>
          {arrow}
        </span>
      </button>
    </th>
  );
}

/* ────────────────────────── 쪽 넘김 ────────────────────────── */

/** 가운데 쪽 번호를 몇 개 보일지 — 현재 쪽 좌우로 2개씩 */
const WINDOW = 2;

function pageNumbers(page: number, last: number): Array<number | "…"> {
  const out: Array<number | "…"> = [];
  const from = Math.max(1, page - WINDOW);
  const to = Math.min(last, page + WINDOW);
  if (from > 1) out.push(1);
  if (from > 2) out.push("…");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < last - 1) out.push("…");
  if (to < last) out.push(last);
  return out;
}

export function Pagination({
  query,
  total,
  onChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: {
  query: ListQuery;
  total: number;
  onChange: (next: ListQuery) => void;
  pageSizeOptions?: readonly number[];
}) {
  const last = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, last);
  const from = total === 0 ? 0 : (page - 1) * query.pageSize + 1;
  const to = Math.min(total, page * query.pageSize);

  const isPreset = pageSizeOptions.includes(query.pageSize);
  const [custom, setCustom] = useState(!isPreset);
  const [draft, setDraft] = useState(String(query.pageSize));

  useEffect(() => {
    setDraft(String(query.pageSize));
  }, [query.pageSize]);

  const go = (p: number) => onChange({ ...query, page: Math.min(Math.max(1, p), last) });

  const applySize = (n: number) => {
    const size = Math.min(Math.max(Math.floor(n) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    onChange({ ...query, pageSize: size, page: 1 });
    setDraft(String(size));
  };

  return (
    <div className="adm-pager">
      <span className="adm-pager-count">
        총 <strong>{total.toLocaleString("ko-KR")}</strong>건
        {total > 0 ? (
          <span className="adm-muted">
            {" "}
            · {from.toLocaleString("ko-KR")}–{to.toLocaleString("ko-KR")}
          </span>
        ) : null}
      </span>

      <nav className="adm-pager-pages" aria-label="쪽 이동">
        <button type="button" className="adm-pager-btn" disabled={page <= 1} onClick={() => go(1)} title="처음">
          «
        </button>
        <button type="button" className="adm-pager-btn" disabled={page <= 1} onClick={() => go(page - 1)} title="이전">
          ‹
        </button>
        {pageNumbers(page, last).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="adm-pager-gap">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={`adm-pager-btn${p === page ? " adm-pager-btn--on" : ""}`}
              aria-current={p === page ? "page" : undefined}
              onClick={() => go(p)}
            >
              {p}
            </button>
          ),
        )}
        <button type="button" className="adm-pager-btn" disabled={page >= last} onClick={() => go(page + 1)} title="다음">
          ›
        </button>
        <button type="button" className="adm-pager-btn" disabled={page >= last} onClick={() => go(last)} title="마지막">
          »
        </button>
      </nav>

      <div className="adm-pager-size">
        <span className="adm-muted">쪽당</span>
        <select
          aria-label="쪽당 건수"
          className="adm-input adm-pager-select"
          value={custom ? "custom" : String(query.pageSize)}
          onChange={(e) => {
            if (e.target.value === "custom") {
              setCustom(true);
              return;
            }
            setCustom(false);
            applySize(Number(e.target.value));
          }}
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n}건
            </option>
          ))}
          <option value="custom">직접 입력</option>
        </select>
        {custom ? (
          <form
            className="adm-pager-custom"
            onSubmit={(e) => {
              e.preventDefault();
              applySize(Number(draft));
            }}
          >
            <input
              className="adm-input adm-pager-input"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_PAGE_SIZE}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label={`쪽당 건수 (1~${MAX_PAGE_SIZE})`}
            />
            <button type="submit" className="adm-btn adm-btn--ghost">
              적용
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
