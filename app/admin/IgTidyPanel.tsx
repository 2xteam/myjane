"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { adminApi, adminErrorMessage, shortDate } from "@/lib/adminClient";
import { useConfirm } from "./ConfirmDialog";
import { Pagination, listQueryDefaults, type ListQuery } from "./Pagination";

/**
 * IG Tidy 관리 — 데스크톱 앱(인스타그램 정리 도우미)을 쓰는 사람과 실행을 본다.
 *
 * IG Tidy 는 서브도메인 앱이 아니라 **포털이 API 를 함께 갖는다**(2026-11-06).
 * 그래서 다른 앱 탭과 달리 앱 API 를 거치지 않고 포털 `/api/admin/ig-tidy/*` 를 부른다.
 * 사용 허용 켜기·끄기는 회원 관리 화면에도 있다(같은 API).
 * → my-obsidian-vault / 10-Projects/IG Tidy.md
 */

type Account = { igUsername: string; addedAt: string | null; lastPlayAt: string | null; removed: boolean; savedBytes: number; savedAt: string | null };
type Member = {
  id: string; name: string; email: string | null; allowedAt: string | null; lastLoginAt: string | null; accounts: Account[];
  aiComment: boolean; aiRequestedAt: string | null; aiToday: number; aiTokensToday: number;
};
type Waiting = {
  id: string; name: string; email: string | null; createdAt: string | null;
  signupFrom: string | null; requestedAt: string | null; firstRequestedAt: string | null; deviceName: string;
};
type Found = { id: string; name: string; email: string | null; signupFrom: string | null; igTidyAllowed: boolean };
type Live = { id: string; member: string; deviceName: string; igUsername: string; kind: string; startedAt: string | null; lastBeatAt: string | null; done: number };
type Settings = {
  enabled: boolean; disabledMessage: string; minVersion: string; dailyCaps: Record<string, number>; minDelaySec: number;
  aiEnabled: boolean; aiDailyCap: number;
};
type Release = { version: string; notes: string; url: string; key: string; sha256: string; size: number; mandatory: boolean; publishedAt: string | null };
type Overview = { settings: Settings; release: Release | null; waiting: Waiting[]; members: Member[]; live: Live[] };
type Play = Live & { status: string; appVersion: string; endedAt: string | null; reason: string; tally: Record<string, { ok?: number; skip?: number; fail?: number }> };

const KIND_LABEL: Record<string, string> = {
  follow: "새로 팔로우", unfollow: "팔로우 취소", leavers: "떠난 팔로워", mutual: "맞팔 취소", ratio: "비율로 정리",
  like: "계정별 좋아요", feed: "피드 좋아요", story: "스토리 좋아요", refresh: "목록 수집",
};
const STATUS_LABEL: Record<string, string> = {
  running: "실행 중", done: "완료", paused: "일시정지", blocked: "제한 안내", stopped: "멈춤",
  lost: "연결 끊김", taken_over: "다른 PC 로 넘어감", ended_by_admin: "관리자 종료",
};
/* 좋아요는 탭마다 따로 센다 — 「계정별」 만 올리고 피드 좋아요를 돌려 "올렸는데 500 에 걸린다" 가 됐다(2026-11-06).
   그래서 이름에 **어느 탭인지**를 먼저 쓴다 */
const CAP_LABEL: Record<string, string> = {
  follow: "새로 팔로우", unfollow: "팔로우 취소 (취소·맞팔·비율 탭 합계)",
  like: "좋아요 — 계정별 좋아요 탭", feed: "좋아요 — 피드 좋아요 탭", story: "좋아요 — 스토리 좋아요 탭",
  comment: "댓글", dm: "인사 메시지",
};
const VIEWS = [
  ["members", "사용자"], ["live", "실행 중"], ["plays", "실행 이력"], ["ai", "AI 댓글 기록"], ["settings", "운영 설정"], ["releases", "배포 버전"],
] as const;
type View = (typeof VIEWS)[number][0];

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.round(n / 1024)}KB`);
const kindOf = (k: string) => KIND_LABEL[k] ?? k;
const ago = (iso: string | null) => {
  if (!iso) return "—";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  return s < 90 ? `${s}초 전` : s < 5400 ? `${Math.round(s / 60)}분 전` : shortDate(iso);
};

export function IgTidyPanel() {
  const [view, setView] = useState<View>("members");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { ask, dialog } = useConfirm();

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await adminApi<Overview>("/api/admin/ig-tidy"));
    } catch (err) {
      setError(adminErrorMessage(err));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function allow(id: string, name: string, allowed: boolean) {
    const ok = await ask({
      title: allowed ? `${name || "이 회원"}님에게 IG Tidy 를 허용할까요?` : `${name || "이 회원"}님의 허용을 끌까요?`,
      lines: allowed ? ["앱이 1분 안에 알아차리고 바로 열립니다."] : ["실행 중이면 1분 안에 멈춥니다. 기록은 지우지 않아요."],
      confirmLabel: allowed ? "허용하기" : "허용 끄기",
      danger: !allowed,
    });
    if (ok) await run(() => adminApi(`/api/admin/users/${id}/ig-tidy`, { method: "PATCH", body: { allowed } }));
  }

  /** AI 댓글 허용 — 앱 사용 허용과 따로 켠다(OpenAI 비용 · 남의 글에 말을 거는 일) */
  async function setAi(m: Member, on: boolean) {
    const ok = await ask({
      title: on ? `${m.name || "이 회원"}님에게 AI 댓글을 허용할까요?` : `${m.name || "이 회원"}님의 AI 댓글을 끌까요?`,
      lines: on
        ? ["앱의 「댓글 관리 → AI 피드 댓글」 을 쓸 수 있게 돼요.", "만든 문구는 「AI 댓글 기록」 에서 볼 수 있어요."]
        : ["실행 중이면 다음 글에서 멈춰요."],
      confirmLabel: on ? "허용하기" : "끄기",
      danger: !on,
    });
    if (ok) await run(() => adminApi("/api/admin/ig-tidy/perms", { method: "PATCH", body: { uid: m.id, aiComment: on } }));
  }

  async function account(ig: string, action: "remove" | "restore" | "release") {
    const text = {
      remove: [`@${ig} 를 떼어 낼까요?`, "이 아이디로는 더 시작할 수 없어요. 기록은 남습니다."],
      restore: [`@${ig} 를 다시 붙일까요?`, "이 회원이 다시 이 아이디로 쓸 수 있어요."],
      release: [`@${ig} 의 묶음을 풀까요?`, "다른 회원이 이 아이디를 등록할 수 있게 됩니다. 기록은 지우지 않아요."],
    }[action];
    if (await ask({ title: text[0], lines: [text[1]], confirmLabel: "진행", danger: action !== "restore" })) {
      await run(() => adminApi("/api/admin/ig-tidy/accounts", { method: "PATCH", body: { igUsername: ig, action } }));
    }
  }

  async function endPlay(p: Live) {
    if (await ask({
      title: `${p.member}님의 실행을 끝낼까요?`,
      lines: [`${p.deviceName || "PC"} · @${p.igUsername} · ${kindOf(p.kind)}`, "앱은 1분 안에 「관리자가 실행을 끝냈어요」 로 멈춥니다."],
      confirmLabel: "실행 끝내기",
      danger: true,
    })) {
      await run(() => adminApi(`/api/admin/ig-tidy/plays/${p.id}`, { method: "POST", body: {} }));
    }
  }

  return (
    <>
      <div className="adm-subtabs">
        {VIEWS.map(([k, label]) => (
          <button key={k} type="button" className="adm-subtab" data-active={view === k} onClick={() => setView(k)}>
            {label}
            {k === "live" && data?.live.length ? ` (${data.live.length})` : ""}
            {k === "members" && data?.waiting.length ? ` · 대기 ${data.waiting.length}` : ""}
          </button>
        ))}
      </div>

      {error ? <p className="adm-note adm-note--error">{error}</p> : null}
      {!data ? <p className="adm-empty">불러오는 중…</p> : null}

      {data && view === "members" ? (
        <>
          <div className="adm-card">
            <p className="adm-card-title">허용을 기다리는 사람</p>
            <p className="adm-card-sub">
              앱에서 로그인해 기다리는 회원(가입한 앱과 상관없이)과 IG Tidy 에서 가입한 회원이에요. 요청이 최근인 순이에요.
            </p>
            {data.waiting.length === 0 ? (
              <p className="adm-empty">기다리는 사람이 없어요.</p>
            ) : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead><tr><th>이름</th><th>이메일</th><th>앱에서 요청</th><th>PC</th><th>가입 출처</th><th>가입일</th><th /></tr></thead>
                  <tbody>
                    {data.waiting.map((w) => (
                      <tr key={w.id}>
                        <td style={{ fontWeight: 700 }}>{w.name || "—"}</td>
                        <td className="adm-muted">{w.email ?? "—"}</td>
                        <td>{w.requestedAt ? ago(w.requestedAt) : <span className="adm-muted">아직 앱을 안 열었어요</span>}</td>
                        <td className="adm-muted">{w.deviceName ? decodeURIComponent(w.deviceName) : "—"}</td>
                        <td className="adm-muted">{w.signupFrom ?? "—"}</td>
                        <td className="adm-muted">{shortDate(w.createdAt)}</td>
                        <td><button className="adm-btn" disabled={busy} onClick={() => allow(w.id, w.name, true)}>허용</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <FindAndAllow busy={busy} onAllow={(id, name) => allow(id, name, true)} />

          <div className="adm-card">
            <p className="adm-card-title">허용된 사람 · {data.members.length}명</p>
            <p className="adm-card-sub">인스타그램 아이디는 앱이 처음 볼 때 저절로 붙어요. 아이디마다 기록이 따로 쌓여요.</p>
            {data.members.length === 0 ? (
              <p className="adm-empty">아직 없어요.</p>
            ) : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead><tr><th>이름</th><th>이메일</th><th>인스타그램 아이디</th><th>AI 댓글</th><th>허용일</th><th /></tr></thead>
                  <tbody>
                    {data.members.map((m) => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 700 }}>{m.name || "—"}</td>
                        <td className="adm-muted">{m.email ?? "—"}</td>
                        <td>
                          {m.accounts.length === 0 ? <span className="adm-muted">아직 없음</span> : m.accounts.map((a) => (
                            <div key={a.igUsername} className="adm-row" style={{ gap: 6, marginBottom: 4 }}>
                              <span style={{ fontWeight: 600, textDecoration: a.removed ? "line-through" : undefined }}>@{a.igUsername}</span>
                              <span className="adm-muted">마지막 {ago(a.lastPlayAt)} · 기록 {kb(a.savedBytes)}</span>
                              {a.removed ? (
                                <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={busy} onClick={() => account(a.igUsername, "restore")}>되붙이기</button>
                              ) : (
                                <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={busy} onClick={() => account(a.igUsername, "remove")}>떼기</button>
                              )}
                              <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={busy} onClick={() => account(a.igUsername, "release")}>묶음 풀기</button>
                            </div>
                          ))}
                        </td>
                        <td>
                          <button
                            className={m.aiComment ? "adm-btn" : "adm-btn adm-btn--ghost"}
                            disabled={busy}
                            onClick={() => setAi(m, !m.aiComment)}
                            title={m.aiComment ? "AI 댓글 쓰는 중 — 눌러서 끄기" : "AI 댓글 허용하기"}
                          >
                            {m.aiComment ? "허용됨" : "허용"}
                          </button>
                          {!m.aiComment && m.aiRequestedAt ? (
                            <div><span className="adm-pill adm-pill--wait">요청 {ago(m.aiRequestedAt)}</span></div>
                          ) : null}
                          {m.aiToday ? <div className="adm-muted">오늘 {m.aiToday}개 · {m.aiTokensToday.toLocaleString()}토큰</div> : null}
                        </td>
                        <td className="adm-muted">{shortDate(m.allowedAt)}</td>
                        <td><button className="adm-btn adm-btn--danger" disabled={busy} onClick={() => allow(m.id, m.name, false)}>허용 끄기</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}

      {data && view === "live" ? (
        <div className="adm-card">
          <p className="adm-card-title">지금 실행 중</p>
          <p className="adm-card-sub">앱은 1분마다 소식을 보내요. 2분 동안 소식이 없으면 연결 끊김으로 닫아요.</p>
          <div className="adm-row" style={{ marginBottom: 10 }}>
            <button className="adm-btn adm-btn--ghost" disabled={busy} onClick={() => void load()}>새로 보기</button>
          </div>
          {data.live.length === 0 ? (
            <p className="adm-empty">실행 중인 사람이 없어요.</p>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>회원</th><th>PC</th><th>아이디</th><th>무엇을</th><th>시작</th><th>마지막 소식</th><th>성공</th><th /></tr></thead>
                <tbody>
                  {data.live.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 700 }}>{p.member || "—"}</td>
                      <td className="adm-muted">{p.deviceName || "—"}</td>
                      <td>@{p.igUsername}</td>
                      <td>{kindOf(p.kind)}</td>
                      <td className="adm-muted">{shortDate(p.startedAt)}</td>
                      <td className="adm-muted">{ago(p.lastBeatAt)}</td>
                      <td>{p.done.toLocaleString()}</td>
                      <td><button className="adm-btn adm-btn--danger" disabled={busy} onClick={() => endPlay(p)}>끝내기</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {data && view === "plays" ? <PlaysView members={data.members} /> : null}
      {data && view === "ai" ? <AiLogsView members={data.members} /> : null}
      {data && view === "settings" ? <SettingsView settings={data.settings} onSaved={load} /> : null}
      {data && view === "releases" ? <ReleasesView onSaved={load} /> : null}
      {dialog}
    </>
  );
}

/* ── 회원을 찾아 허용 ───────────────────────────────────────
 * 아직 앱을 열지 않은 지인에게 미리 허용해 둘 때. 회원 목록 API 를 그대로 쓴다. */
function FindAndAllow({ busy, onAllow }: { busy: boolean; onAllow: (id: string, name: string) => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Found[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function find() {
    if (!q.trim()) return;
    setError(null);
    try {
      const res = await adminApi<{ users: Found[] }>(`/api/admin/users?q=${encodeURIComponent(q.trim())}&pageSize=10`);
      setRows(res.users);
    } catch (err) {
      setError(adminErrorMessage(err));
    }
  }

  return (
    <div className="adm-card">
      <p className="adm-card-title">회원을 찾아 허용</p>
      <p className="adm-card-sub">앱을 아직 열지 않은 지인에게 미리 허용해 둘 수 있어요. 이름 · 이메일 · 전화번호로 찾아요.</p>
      <form className="adm-row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); void find(); }}>
        <input className="adm-input" style={{ maxWidth: 280 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름 · 이메일 · 전화번호" />
        <button className="adm-btn" type="submit">찾기</button>
      </form>
      {error ? <p className="adm-note adm-note--error">{error}</p> : null}
      {rows === null ? null : rows.length === 0 ? <p className="adm-empty">찾는 회원이 없어요.</p> : (
        <div className="adm-table-wrap" style={{ marginTop: 10 }}>
          <table className="adm-table">
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700 }}>{u.name || "—"}</td>
                  <td className="adm-muted">{u.email ?? "—"}</td>
                  <td className="adm-muted">{u.signupFrom ?? "—"}</td>
                  <td>
                    {u.igTidyAllowed ? <span className="adm-pill adm-pill--done">허용됨</span> : (
                      <button className="adm-btn" disabled={busy} onClick={() => { onAllow(u.id, u.name); setRows(null); setQ(""); }}>허용</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── 실행 이력 ───────────────────────────────────────────── */
function PlaysView({ members }: { members: Member[] }) {
  const [list, setList] = useState<ListQuery>(() => listQueryDefaults("startedAt", "desc"));
  const [uid, setUid] = useState("");
  const [ig, setIg] = useState("");
  const [rows, setRows] = useState<Play[] | null>(null);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [lines, setLines] = useState<Array<{ t: string | null; action: string; result: string; user: string; note: string }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const q = new URLSearchParams({ page: String(list.page), pageSize: String(list.pageSize) });
      if (uid) q.set("uid", uid);
      if (ig) q.set("ig", ig);
      const res = await adminApi<{ plays: Play[]; total: number }>(`/api/admin/ig-tidy/plays?${q}`);
      setRows(res.plays);
      setTotal(res.total);
    } catch (err) {
      setError(adminErrorMessage(err));
      setRows([]);
    }
  }, [list, uid, ig]);
  useEffect(() => { void load(); }, [load]);

  async function toggle(id: string) {
    if (open === id) { setOpen(null); return; }
    setOpen(id);
    setLines(null);
    try {
      const res = await adminApi<{ lines: NonNullable<typeof lines> }>(`/api/admin/ig-tidy/plays/${id}`);
      setLines(res.lines);
    } catch (err) {
      setError(adminErrorMessage(err));
    }
  }

  const igs = members.flatMap((m) => m.accounts.map((a) => a.igUsername));
  const sum = (t: Play["tally"], k: "ok" | "skip" | "fail") => Object.values(t ?? {}).reduce((s, c) => s + (Number(c?.[k]) || 0), 0);

  return (
    <div className="adm-card">
      <p className="adm-card-title">실행 이력</p>
      <p className="adm-card-sub">「시작」 을 누를 때마다 한 줄이에요. 줄을 누르면 그 실행에서 한 일이 펼쳐져요.</p>
      <div className="adm-row" style={{ marginBottom: 12, gap: 8 }}>
        <select className="adm-input" style={{ maxWidth: 220 }} value={uid} onChange={(e) => { setUid(e.target.value); setList((l) => ({ ...l, page: 1 })); }}>
          <option value="">모든 사람</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
        </select>
        <select className="adm-input" style={{ maxWidth: 220 }} value={ig} onChange={(e) => { setIg(e.target.value); setList((l) => ({ ...l, page: 1 })); }}>
          <option value="">모든 아이디</option>
          {igs.map((x) => <option key={x} value={x}>@{x}</option>)}
        </select>
      </div>
      {error ? <p className="adm-note adm-note--error">{error}</p> : null}
      {rows === null ? <p className="adm-empty">불러오는 중…</p> : rows.length === 0 ? <p className="adm-empty">기록이 없어요.</p> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>시작</th><th>회원</th><th>아이디</th><th>무엇을</th><th>상태</th><th>성공 · 건너뜀 · 실패</th><th>PC · 버전</th><th>끝난 까닭</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <Fragment key={p.id}>
                  <tr onClick={() => toggle(p.id)} style={{ cursor: "pointer" }}>
                    <td className="adm-muted">{shortDate(p.startedAt)}</td>
                    <td style={{ fontWeight: 700 }}>{p.member || "—"}</td>
                    <td>@{p.igUsername}</td>
                    <td>{kindOf(p.kind)}</td>
                    <td><span className={p.status === "running" ? "adm-pill adm-pill--wait" : "adm-pill adm-pill--done"}>{STATUS_LABEL[p.status] ?? p.status}</span></td>
                    <td>{sum(p.tally, "ok")} · {sum(p.tally, "skip")} · {sum(p.tally, "fail")}</td>
                    <td className="adm-muted">{p.deviceName || "—"} · {p.appVersion || "—"}</td>
                    <td className="adm-muted adm-wrap-cell">{p.reason || "—"}</td>
                  </tr>
                  {open === p.id ? (
                    <tr>
                      <td colSpan={8}>
                        {lines === null ? <p className="adm-empty">불러오는 중…</p> : lines.length === 0 ? <p className="adm-empty">남은 행동 기록이 없어요.</p> : (
                          <div style={{ maxHeight: 360, overflow: "auto" }}>
                            <table className="adm-table">
                              <tbody>
                                {lines.map((l, i) => (
                                  <tr key={i}>
                                    <td className="adm-muted">{shortDate(l.t)}</td>
                                    <td>{l.action}</td>
                                    <td>{l.result}</td>
                                    <td>{l.user}</td>
                                    <td className="adm-muted adm-wrap-cell">{l.note}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows !== null && total > 0 ? <Pagination query={list} total={total} onChange={setList} /> : null}
    </div>
  );
}

/* ── AI 댓글 기록 ─────────────────────────────────────────── */
type AiLog = {
  id: string; at: string | null; member: string; igUsername: string; target: string; permalink: string;
  comment: string; skip: boolean; reason: string; ok: boolean; error: string; tokens: number | null; withImage: boolean; ms: number;
};
function AiLogsView({ members }: { members: Member[] }) {
  const [list, setList] = useState<ListQuery>(() => listQueryDefaults("at", "desc"));
  const [uid, setUid] = useState("");
  const [rows, setRows] = useState<AiLog[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const q = new URLSearchParams({ page: String(list.page), pageSize: String(list.pageSize) });
      if (uid) q.set("uid", uid);
      const res = await adminApi<{ logs: AiLog[]; total: number }>(`/api/admin/ig-tidy/ai-logs?${q}`);
      setRows(res.logs);
      setTotal(res.total);
    } catch (err) {
      setError(adminErrorMessage(err));
      setRows([]);
    }
  }, [list, uid]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="adm-card">
      <p className="adm-card-title">AI 댓글 기록</p>
      <p className="adm-card-sub">AI 가 만든 문구예요. 「미리 보기만」 으로 돌린 것도 여기 남아요. 게시 여부는 실행 이력의 행동 기록에서 봐요.</p>
      <div className="adm-row" style={{ marginBottom: 12 }}>
        <select className="adm-input" style={{ maxWidth: 220 }} value={uid} onChange={(e) => { setUid(e.target.value); setList((l) => ({ ...l, page: 1 })); }}>
          <option value="">모든 사람</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
        </select>
      </div>
      {error ? <p className="adm-note adm-note--error">{error}</p> : null}
      {rows === null ? <p className="adm-empty">불러오는 중…</p> : rows.length === 0 ? <p className="adm-empty">아직 없어요.</p> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>때</th><th>회원 · 아이디</th><th>누구 글</th><th>만든 문구</th><th>토큰 · 사진</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="adm-muted">{shortDate(r.at)}</td>
                  <td>{r.member || "—"}<div className="adm-muted">@{r.igUsername}</div></td>
                  <td>
                    {r.permalink ? <a href={`https://www.instagram.com${r.permalink}`} target="_blank" rel="noreferrer">@{r.target}</a> : `@${r.target}`}
                  </td>
                  <td className="adm-wrap-cell">
                    {!r.ok ? <span className="adm-msg adm-msg--bad">실패 — {r.error}</span>
                      : r.skip ? <span className="adm-muted">건너뜀 — {r.reason || "까닭 없음"}</span>
                      : r.comment}
                  </td>
                  <td className="adm-muted">{r.tokens ?? "—"} · {r.withImage ? "사진" : "글만"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows !== null && total > 0 ? <Pagination query={list} total={total} onChange={setList} /> : null}
    </div>
  );
}

/* ── 운영 설정 ───────────────────────────────────────────── */
function SettingsView({ settings, onSaved }: { settings: Settings; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState(settings);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await adminApi("/api/admin/ig-tidy/settings", { method: "PUT", body: form });
      setMsg({ ok: true, text: "저장했어요. 실행 중인 앱도 1분 안에 새 값을 받아요." });
      await onSaved();
    } catch (err) {
      setMsg({ ok: false, text: adminErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adm-card">
      <p className="adm-card-title">운영 설정</p>
      <p className="adm-card-sub">앱에 내려 주는 값이에요. 사용자가 속도를 올려 계정 제한을 당하는 일을 막아요.</p>

      <label className="adm-field">
        <span className="adm-label">전체 사용</span>
        <select className="adm-input" style={{ maxWidth: 200 }} value={form.enabled ? "on" : "off"} onChange={(e) => setForm({ ...form, enabled: e.target.value === "on" })}>
          <option value="on">켜짐 — 허용된 사람은 쓸 수 있어요</option>
          <option value="off">꺼짐 — 모두 멈춰요</option>
        </select>
      </label>
      {!form.enabled ? (
        <label className="adm-field">
          <span className="adm-label">멈춘 까닭(앱에 보여 줘요)</span>
          <input className="adm-input" value={form.disabledMessage} onChange={(e) => setForm({ ...form, disabledMessage: e.target.value })} placeholder="인스타그램 화면이 바뀌어 고치는 중이에요. 곧 다시 열어요." />
        </label>
      ) : null}

      <label className="adm-field">
        <span className="adm-label">최소 앱 버전 — 이보다 낮으면 시작 전에 업데이트를 요구해요</span>
        <input className="adm-input" style={{ maxWidth: 160 }} value={form.minVersion} onChange={(e) => setForm({ ...form, minVersion: e.target.value })} />
      </label>

      <label className="adm-field">
        <span className="adm-label">행동 사이 최소 간격(초)</span>
        <input className="adm-input" style={{ maxWidth: 120 }} type="number" min={0} max={120} value={form.minDelaySec} onChange={(e) => setForm({ ...form, minDelaySec: Number(e.target.value) })} />
      </label>

      <label className="adm-field">
        <span className="adm-label">AI 댓글</span>
        <select className="adm-input" style={{ maxWidth: 260 }} value={form.aiEnabled ? "on" : "off"} onChange={(e) => setForm({ ...form, aiEnabled: e.target.value === "on" })}>
          <option value="on">켜짐 — AI 허용된 사람은 쓸 수 있어요</option>
          <option value="off">꺼짐 — 모두 못 써요</option>
        </select>
      </label>
      <label className="adm-field">
        <span className="adm-label">AI 댓글 — 인스타그램 아이디당 하루 만들기 상한 (0 = 제한 없음)</span>
        <input className="adm-input" style={{ maxWidth: 120 }} type="number" min={0} max={1000} value={form.aiDailyCap} onChange={(e) => setForm({ ...form, aiDailyCap: Number(e.target.value) })} />
      </label>

      <p className="adm-label" style={{ marginTop: 10 }}>인스타그램 아이디당 하루 상한 (0 = 제한 없음)</p>
      <p className="adm-card-sub" style={{ marginTop: 0 }}>
        좋아요는 <b>탭마다 따로</b> 세요. 피드 좋아요를 돌리면 「피드 좋아요 탭」 칸만 봐요.
      </p>
      <div className="adm-row" style={{ flexWrap: "wrap", gap: 10 }}>
        {Object.keys(CAP_LABEL).map((k) => (
          <label key={k} className="adm-field" style={{ minWidth: 130 }}>
            <span className="adm-label">{CAP_LABEL[k]}</span>
            <input className="adm-input" type="number" min={0} value={form.dailyCaps[k] ?? 0}
              onChange={(e) => setForm({ ...form, dailyCaps: { ...form.dailyCaps, [k]: Number(e.target.value) } })} />
          </label>
        ))}
      </div>

      <div className="adm-row" style={{ marginTop: 14 }}>
        <button className="adm-btn" disabled={busy} onClick={save}>저장</button>
        {msg ? <span className={msg.ok ? "adm-msg adm-msg--ok" : "adm-msg adm-msg--bad"}>{msg.text}</span> : null}
      </div>
    </div>
  );
}

/* ── 배포 버전 ───────────────────────────────────────────── */
function ReleasesView({ onSaved }: { onSaved: () => Promise<void> }) {
  const [rows, setRows] = useState<Release[] | null>(null);
  const [form, setForm] = useState({ version: "", notes: "", key: "", sha256: "", size: 0, mandatory: false });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows((await adminApi<{ releases: Release[] }>("/api/admin/ig-tidy/releases")).releases);
    } catch (err) {
      setMsg({ ok: false, text: adminErrorMessage(err) });
      setRows([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await adminApi("/api/admin/ig-tidy/releases", { method: "POST", body: form });
      setMsg({ ok: true, text: `${form.version} 을 올렸어요. 앱들이 다음 확인 때 「새 버전이 있어요」 를 띄워요.` });
      setForm({ version: "", notes: "", key: "", sha256: "", size: 0, mandatory: false });
      await load();
      await onSaved();
    } catch (err) {
      setMsg({ ok: false, text: adminErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="adm-card">
        <p className="adm-card-title">배포한 버전</p>
        <p className="adm-card-sub">
          보통은 <code>ig-tidy</code> 저장소의 <code>npm run release</code> 가 설치 파일을 R2 에 올리고 여기에 자동으로 등록해요.
          가장 위 버전이 앱에 「새 버전이 있어요」 로 떠요.
        </p>
        {rows === null ? <p className="adm-empty">불러오는 중…</p> : rows.length === 0 ? <p className="adm-empty">아직 올린 버전이 없어요.</p> : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>버전</th><th>올린 때</th><th>필수</th><th>크기</th><th>바뀐 점</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.version}>
                    <td style={{ fontWeight: 700 }}>{r.version}</td>
                    <td className="adm-muted">{shortDate(r.publishedAt)}</td>
                    <td>{r.mandatory ? <span className="adm-pill adm-pill--wait">필수</span> : "—"}</td>
                    <td className="adm-muted">{r.size ? kb(r.size) : "—"}</td>
                    <td className="adm-wrap-cell">{r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="adm-card">
        <p className="adm-card-title">손으로 등록</p>
        <p className="adm-card-sub">설치 파일을 직접 R2 에 올렸을 때만 써요.</p>
        <label className="adm-field"><span className="adm-label">버전 (1.2.3)</span>
          <input className="adm-input" style={{ maxWidth: 160 }} value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></label>
        <label className="adm-field"><span className="adm-label">R2 경로</span>
          <input className="adm-input" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="releases/IG-Tidy-Setup-1.2.3.exe" /></label>
        <label className="adm-field"><span className="adm-label">sha256</span>
          <input className="adm-input" value={form.sha256} onChange={(e) => setForm({ ...form, sha256: e.target.value })} /></label>
        <label className="adm-field"><span className="adm-label">바뀐 점(앱 알림에 보여요)</span>
          <textarea className="adm-textarea" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        <label className="adm-row" style={{ gap: 6 }}>
          <input type="checkbox" checked={form.mandatory} onChange={(e) => setForm({ ...form, mandatory: e.target.checked })} />
          <span>필수 업데이트 — 최소 버전도 이 버전으로 올려요</span>
        </label>
        <div className="adm-row" style={{ marginTop: 12 }}>
          <button className="adm-btn" disabled={busy || !form.version} onClick={save}>등록</button>
          {msg ? <span className={msg.ok ? "adm-msg adm-msg--ok" : "adm-msg adm-msg--bad"}>{msg.text}</span> : null}
        </div>
      </div>
    </>
  );
}
