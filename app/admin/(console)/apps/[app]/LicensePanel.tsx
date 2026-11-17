"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi, adminErrorMessage } from "@/lib/adminClient";
import { useConfirm } from "@/app/admin/ConfirmDialog";

/**
 * 러닝 자격증 목록 — 시도한 사람들이 받은 자격증을 한 장씩 본다(사용자 2026-11-17).
 *
 * 글자(발급처 · 급수 · 기록 · 번호)는 TypeLog `/api/admin/licenses` 가 만들어 내려 준다. 포털은 그리기만.
 * 사진은 결과 링크를 만들 때 올라간 자격증 사진(R2)뿐이다 — 기기에만 있는 사진은 서버에 없다.
 * 「모자이크」 를 누르면 사진 칸만 굵은 픽셀로 깬다(화면 공유 · 캡처할 때).
 * 카드 왼쪽 위 체크로 골라 「선택 삭제」 — 테스트 기록 정리용. 확인 창을 거쳐 TypeLog 가 지운다(사진 포함, 되돌릴 수 없다).
 * → my-obsidian-vault / 10-Projects/TypeLog.md 「admin 자격증 목록」
 */

type Item = {
  id: string;
  completedAt: string;
  owner: "member" | "guest";
  member: { nickname: string | null; email: string | null; phone: string | null } | null;
  name: string;
  result: { code: string; name: string; emoji: string };
  license: {
    athlete: boolean;
    title: string;
    en: string;
    no: string;
    grade: string;
    record: string;
    pace: string;
    date: string;
    issuer: string;
    holo: string;
  };
  gender: string;
  percentile: string | null;
  wanted?: "fast" | "slow" | null;
  race: string | null;
  photoUrl: string | null;
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

/** 결과 순서 — 높은 급부터 */
const ORDER = ["ticket-suspend", "ticket", "news-front", "news-local", "cert-1", "cert-2", "cert-3", "cert-4", "cert-5"];

const when = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

export function LicensePanel({ appKey }: { appKey: string }) {
  const [who, setWho] = useState<"all" | "member" | "guest">("all");
  const [kind, setKind] = useState<"all" | "athlete" | "cert">("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mosaic, setMosaic] = useState(false);
  /** 골라 둔 자격증 — 쪽을 넘겨도 남는다. 이름은 확인 창에 보여 주려고 함께 둔다 */
  const [picked, setPicked] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { ask, dialog } = useConfirm();

  const toggle = (it: Item) =>
    setPicked((m) => {
      const n = new Map(m);
      if (n.has(it.id)) n.delete(it.id);
      else n.set(it.id, `${it.name} · ${it.license.grade} · ${it.license.record} · ${it.owner === "member" ? "회원" : "비회원"}`);
      return n;
    });

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await adminApi<Data>(`/api/admin/apps/${appKey}/licenses?who=${who}&kind=${kind}&page=${page}`));
    } catch (err) {
      setError(adminErrorMessage(err));
    }
  }, [appKey, who, kind, page]);

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
        else n.set(it.id, `${it.name} · ${it.license.grade} · ${it.license.record} · ${it.owner === "member" ? "회원" : "비회원"}`);
      }
      return n;
    });

  const removePicked = async () => {
    const ids = [...picked.keys()];
    if (!ids.length) return;
    const labels = [...picked.values()];
    const ok = await ask({
      title: `자격증 ${ids.length}장을 지울까요?`,
      lines: [
        ...labels.slice(0, 8),
        ...(labels.length > 8 ? [`… 외 ${labels.length - 8}장`] : []),
        "기록과 올라간 자격증 사진이 함께 지워지고, 결과 링크는 「없는 링크」가 돼요. 되돌릴 수 없어요.",
      ],
      confirmLabel: "지우기",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setNote(null);
    try {
      const r = await adminApi<{ deleted: number; photos: number; photosDeleted: number }>(
        `/api/admin/apps/${appKey}/licenses`,
        { method: "POST", body: { deleteIds: ids } },
      );
      setPicked(new Map());
      setNote(
        `🗑️ ${r.deleted}장을 지웠어요.` +
          (r.photos ? ` 사진 ${r.photosDeleted}/${r.photos}장도 지웠어요.` : "") +
          (r.photos > r.photosDeleted ? " 남은 사진은 R2 에서 정리가 필요해요." : ""),
      );
      await load();
    } catch (err) {
      setNote(adminErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const counts = data ? ORDER.filter((c) => data.counts[c]).map((c) => ({ code: c, ...data.counts[c] })) : [];
  const sum = counts.reduce((n, c) => ({ member: n.member + c.member, guest: n.guest + c.guest }), { member: 0, guest: 0 });

  return (
    <section className="adm-card">
      <h2 className="adm-card-title">러닝 자격증</h2>
      <p className="adm-card-sub">
        「나의 러닝 자격증은 몇급일까?」 를 끝낸 사람들의 자격증이에요. 최근 완주 순. 사진은 결과 링크를 만든 사람만 있어요.
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
          {counts.map((c) => (
            <div className="adm-stat" key={c.code}>
              <p className="adm-stat-label">
                {c.emoji} {c.name}
              </p>
              <p className="adm-stat-value">{c.member + c.guest}</p>
            </div>
          ))}
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
        <div className="adm-lic-seg" role="radiogroup" aria-label="자격증 종류">
          {(
            [
              ["all", "모든 자격증"],
              ["athlete", "선수자격증"],
              ["cert", "러닝자격증"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={kind === v}
              className="adm-chip"
              data-on={kind === v}
              onClick={() => {
                setKind(v);
                setPage(1);
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="adm-btn adm-btn--sm adm-lic-mosaic"
          aria-pressed={mosaic}
          data-on={mosaic}
          onClick={() => setMosaic((m) => !m)}
        >
          {mosaic ? "🔓 모자이크 풀기" : "🔲 사진 모자이크"}
        </button>
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
      {data && !data.items.length ? <p className="adm-card-sub">해당하는 자격증이 없어요.</p> : null}

      {data?.items.length ? (
        <div className="adm-lic-grid">
          {data.items.map((it) => (
            <LicenseCard key={it.id} it={it} mosaic={mosaic} picked={picked.has(it.id)} onPick={() => toggle(it)} />
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

function LicenseCard({ it, mosaic, picked, onPick }: { it: Item; mosaic: boolean; picked: boolean; onPick: () => void }) {
  const L = it.license;
  return (
    <article className="adm-lic" data-athlete={L.athlete} data-picked={picked}>
      <label className="adm-lic-check">
        <input type="checkbox" checked={picked} onChange={onPick} aria-label={`${it.name} 자격증 선택`} />
      </label>
      <div className="adm-lic-card">
        <div className="adm-lic-band">
          <span className="adm-lic-ko">{L.title}</span>
          <span className="adm-lic-en">{L.en}</span>
        </div>
        <div className="adm-lic-body">
          <Photo src={it.photoUrl} mosaic={mosaic} />
          <div className="adm-lic-info">
            <p className="adm-lic-no">
              <span>LICENSE NO.</span> {L.no}
            </p>
            <dl>
              <div>
                <dt>러너</dt>
                <dd>{it.name}</dd>
              </div>
              <div>
                <dt>급수</dt>
                <dd className="adm-lic-grade">{L.grade}</dd>
              </div>
              <div>
                <dt>기록</dt>
                <dd>
                  {L.record}
                  <small>{L.pace}</small>
                </dd>
              </div>
              <div>
                <dt>완주일자</dt>
                <dd>{L.date}</dd>
              </div>
            </dl>
          </div>
        </div>
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
          {it.wanted ? (it.wanted === "fast" ? "🚨 현상수배(말도 안 되게 빠름) · " : "🚨 현상수배(말도 안 되게 느림) · ") : ""}
          {it.result.emoji} {it.result.name}
          {it.percentile ? ` · ${it.percentile}` : ""}
          {it.race ? ` · ${it.race}` : ""} · {it.gender === "f" ? "여" : "남"} · {when(it.completedAt)}
        </p>
        <p className="adm-muted">
          발급처 {L.issuer} · 홀로그램 {L.holo}
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

/** 사진 칸 — 모자이크면 아주 작은 캔버스(10×12)에 그려 픽셀을 키운다. 사진이 없으면 실루엣 */
function Photo({ src, mosaic }: { src: string | null; mosaic: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!mosaic || !src) return;
    const img = new Image();
    img.onload = () => {
      const c = ref.current;
      if (!c) return;
      c.width = 10;
      c.height = 12;
      c.getContext("2d")?.drawImage(img, 0, 0, 10, 12);
    };
    img.src = src;
  }, [src, mosaic]);

  if (!src) {
    return (
      <div className="adm-lic-photo adm-lic-photo--none" aria-label="사진 없음">
        <svg viewBox="0 0 100 120" aria-hidden="true">
          <circle cx="50" cy="44" r="22" />
          <path d="M10 120 C10 86 28 72 50 72 C72 72 90 86 90 120 Z" />
        </svg>
      </div>
    );
  }
  return (
    <div className="adm-lic-photo">
      {mosaic ? (
        <canvas ref={ref} aria-label="모자이크한 사진" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" />
      )}
    </div>
  );
}
