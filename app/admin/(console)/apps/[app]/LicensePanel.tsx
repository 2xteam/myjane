"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi, adminErrorMessage } from "@/lib/adminClient";

/**
 * 러닝 자격증 목록 — 시도한 사람들이 받은 자격증을 한 장씩 본다(사용자 2026-11-17).
 *
 * 글자(발급처 · 급수 · 기록 · 번호)는 TypeLog `/api/admin/licenses` 가 만들어 내려 준다. 포털은 그리기만.
 * 사진은 결과 링크를 만들 때 올라간 자격증 사진(R2)뿐이다 — 기기에만 있는 사진은 서버에 없다.
 * 「모자이크」 를 누르면 사진 칸만 굵은 픽셀로 깬다(화면 공유 · 캡처할 때).
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

      {error ? <p className="adm-card-sub">{error}</p> : null}
      {data && !data.items.length ? <p className="adm-card-sub">해당하는 자격증이 없어요.</p> : null}

      {data?.items.length ? (
        <div className="adm-lic-grid">
          {data.items.map((it) => (
            <LicenseCard key={it.id} it={it} mosaic={mosaic} />
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
    </section>
  );
}

function LicenseCard({ it, mosaic }: { it: Item; mosaic: boolean }) {
  const L = it.license;
  return (
    <article className="adm-lic" data-athlete={L.athlete}>
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
