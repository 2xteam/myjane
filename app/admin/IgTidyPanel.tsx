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
  aiEnabled: boolean; aiFreePhotoDaily: number; aiApprovedPhotoDaily: number; aiPhotoWeight: number;
  notice: string; noticeAt: string | null;
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
  ["members", "사용자"], ["live", "실행 중"], ["plays", "실행 이력"], ["ai", "AI 댓글 기록"], ["insights", "현황"], ["notices", "공지"], ["settings", "운영 설정"], ["releases", "배포 버전"],
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
  const [noticeDraft, setNoticeDraft] = useState<string | undefined>(undefined);
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

  /** AI 댓글 한도 승인 — 승인 전에도 무료(사진 포함 50개 분)로 쓰고, 승인하면 하루 한도가 올라간다 */
  async function setAi(m: Member, on: boolean) {
    const s = data?.settings;
    const ok = await ask({
      title: on ? `${m.name || "이 회원"}님의 AI 댓글 한도를 올릴까요?` : `${m.name || "이 회원"}님의 AI 한도 승인을 거둘까요?`,
      lines: on
        ? [`하루 사진 포함 ${s?.aiApprovedPhotoDaily ?? 300}개 분까지 쓸 수 있게 돼요(승인 전은 ${s?.aiFreePhotoDaily ?? 50}개 분).`,
           "만든 문구는 「AI 댓글 기록」 에서 볼 수 있어요."]
        : [`무료 한도(하루 사진 포함 ${s?.aiFreePhotoDaily ?? 50}개 분)로 돌아가요.`],
      confirmLabel: on ? "승인하기" : "승인 거두기",
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
          <button key={k} type="button" className="adm-subtab" data-active={view === k} onClick={() => { setNoticeDraft(undefined); setView(k); }}>
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
                  <thead><tr><th>이름</th><th>이메일</th><th>인스타그램 아이디</th><th>AI 한도</th><th>허용일</th><th /></tr></thead>
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
                            title={m.aiComment ? "AI 한도 승인됨 — 눌러서 거두기" : "AI 한도 올리기(승인)"}
                          >
                            {m.aiComment ? "승인됨" : "승인"}
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
      {data && view === "insights" ? (
        <InsightsView settings={data.settings} onSaved={load} onWriteNotice={(draft) => { setNoticeDraft(draft); setView("notices"); }} />
      ) : null}
      {data && view === "notices" ? <NoticesView draft={noticeDraft} /> : null}
      {data && view === "settings" ? <SettingsView settings={data.settings} onSaved={load} onGoNotices={() => setView("notices")} /> : null}
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
  style: string; kind: "comment" | "reply"; inReplyTo: string;
};
const STYLE_LABEL: Record<string, string> = { basic: "기본", hip: "힙한", lively: "활기찬", humor: "유머" };
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
      <p className="adm-card-sub">
        AI 가 만든 문구예요. 「미리 보기만」 으로 돌린 것도 여기 남아요. 게시 여부는 실행 이력의 행동 기록에서 봐요.
        「답글」 은 내 글에 달린 댓글에 단 답이에요 — 상대 댓글이 함께 보여요.
      </p>
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
            <thead><tr><th>때</th><th>회원 · 아이디</th><th>누구 글 · 댓글</th><th>스타일</th><th>만든 문구</th><th>토큰 · 사진</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="adm-muted">{shortDate(r.at)}</td>
                  <td>{r.member || "—"}<div className="adm-muted">@{r.igUsername}</div></td>
                  <td>
                    {r.permalink ? <a href={`https://www.instagram.com${r.permalink}`} target="_blank" rel="noreferrer">@{r.target}</a> : `@${r.target}`}
                  </td>
                  <td>
                    <span className="adm-pill">{STYLE_LABEL[r.style] ?? r.style}</span>
                    {r.kind === "reply" ? <div><span className="adm-pill adm-pill--wait">답글</span></div> : null}
                  </td>
                  <td className="adm-wrap-cell">
                    {r.kind === "reply" && r.inReplyTo ? <div className="adm-muted">↳ 「{r.inReplyTo}」</div> : null}
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
function SettingsView({ settings, onSaved, onGoNotices }: { settings: Settings; onSaved: () => Promise<void>; onGoNotices: () => void }) {
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

      {/* 한 줄 공지는 「공지」 탭(게시판)으로 옮겼다(2026-11-08). 예전 앱 띠에는 가장 최근에 켜진 공지가 나간다 */}
      <p className="adm-note adm-note--info" style={{ margin: "6px 0 12px" }}>
        앱 공지는 <b>「공지」 탭</b>으로 옮겼어요. 여러 개를 쓰고 켜고 끌 수 있어요.{" "}
        <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={onGoNotices}>공지 탭으로</button>
      </p>

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
      <p className="adm-label" style={{ marginTop: 10 }}>AI 댓글 하루 한도 — myjane 계정 단위 · 사진 포함 개수 기준</p>
      <p className="adm-card-sub" style={{ marginTop: 0 }}>
        글만 쓰면 1단위, 사진을 포함하면 가중치만큼 셉니다. 무료 {form.aiFreePhotoDaily}개 = {form.aiFreePhotoDaily * form.aiPhotoWeight}단위(글만 그만큼),
        승인 {form.aiApprovedPhotoDaily}개 = {form.aiApprovedPhotoDaily * form.aiPhotoWeight}단위.
      </p>
      <div className="adm-row" style={{ flexWrap: "wrap", gap: 10 }}>
        <label className="adm-field" style={{ minWidth: 150 }}>
          <span className="adm-label">승인 전(무료)</span>
          <input className="adm-input" type="number" min={0} value={form.aiFreePhotoDaily} onChange={(e) => setForm({ ...form, aiFreePhotoDaily: Number(e.target.value) })} />
        </label>
        <label className="adm-field" style={{ minWidth: 150 }}>
          <span className="adm-label">관리자 승인 후</span>
          <input className="adm-input" type="number" min={0} value={form.aiApprovedPhotoDaily} onChange={(e) => setForm({ ...form, aiApprovedPhotoDaily: Number(e.target.value) })} />
        </label>
        <label className="adm-field" style={{ minWidth: 150 }}>
          <span className="adm-label">사진 1개 = 글 몇 개</span>
          <input className="adm-input" type="number" min={1} max={20} value={form.aiPhotoWeight} onChange={(e) => setForm({ ...form, aiPhotoWeight: Number(e.target.value) })} />
        </label>
      </div>

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

/* ── 현황 — 제한에 걸린 기록으로 하루 상한 고르기 (2026-11-08) ─────────────
 * 여러 사람의 기록(blocks · daily · plays)을 모아 행동마다 「몇 건에서 걸렸나」 와 「무사한 날 얼마나 했나」 를 본다.
 * 추천 상한 규칙은 API 에 있다 → app/api/admin/ig-tidy/insights/route.ts
 * 저장은 운영 설정과 같은 API(PUT /api/admin/ig-tidy/settings 의 dailyCaps)다. */
type Dist = { n: number; min: number; p25: number; median: number; p75: number; p90: number; max: number };
type InsightAction = {
  action: string; cap: number; suggested: number | null; basis: string; lowData: boolean;
  blocks: number; accounts: number; blockedPlays: number; blockDay: Dist | null; safeDay: Dist | null;
};
type Insights = {
  days: number; since: string; until: string; actions: InsightAction[];
  series: Array<{ day: string; blocks: number; blockedPlays: number }>;
  totals: { blocks: number; accounts: number; blockedPlays: number };
};
const capName = (k: string) => CAP_LABEL[k] ?? k;
const distText = (d: Dist | null) => (d ? `${d.min} · ${d.p25} · ${d.median} · ${d.p75} · ${d.max}` : "—");

function InsightsView({ settings, onSaved, onWriteNotice }: {
  settings: Settings; onSaved: () => Promise<void>; onWriteNotice: (draft: string) => void;
}) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Insights | null>(null);
  const [caps, setCaps] = useState<Record<string, number>>(() => ({ ...settings.dailyCaps }));
  const [changed, setChanged] = useState<Array<[string, number, number]>>([]);   // 저장한 바뀜 [칸, 전, 후]
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setMsg(null);
    try {
      setData(await adminApi<Insights>(`/api/admin/ig-tidy/insights?days=${days}`));
    } catch (err) {
      setMsg({ ok: false, text: adminErrorMessage(err) });
    }
  }, [days]);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    setBusy(true);
    setMsg(null);
    const before = settings.dailyCaps;
    try {
      await adminApi("/api/admin/ig-tidy/settings", { method: "PUT", body: { dailyCaps: caps } });
      const diff = Object.keys(CAP_LABEL)
        .filter((k) => (Number(before[k]) || 0) !== (Number(caps[k]) || 0))
        .map((k) => [k, Number(before[k]) || 0, Number(caps[k]) || 0] as [string, number, number]);
      setChanged(diff);
      setMsg({ ok: true, text: diff.length ? `${diff.length}칸을 바꿨어요. 실행 중인 앱도 1분 안에 새 값을 받아요.` : "바뀐 칸이 없어요." });
      await onSaved();
      await load();
    } catch (err) {
      setMsg({ ok: false, text: adminErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  function writeNotice() {
    const lines = changed.length
      ? changed.map(([k, a, b]) => `· ${capName(k)}: 하루 ${a ? a.toLocaleString() : "제한 없음"} → ${b ? b.toLocaleString() : "제한 없음"}건`)
      : Object.keys(CAP_LABEL).filter((k) => caps[k]).map((k) => `· ${capName(k)}: 하루 ${Number(caps[k]).toLocaleString()}건`);
    onWriteNotice([
      "하루 권장 횟수를 조정했어요",
      "여러분의 기록에서 인스타그램 제한이 걸린 건수를 모아 보고, 계정을 지키도록 하루 상한을 맞췄어요.",
      "",
      ...lines,
      "",
      "제한 안내를 받았다면 하루 이틀 쉬었다가 다시 시작해 주세요.",
    ].join("\n"));
  }

  const peak = Math.max(1, ...(data?.series ?? []).map((d) => d.blocks + d.blockedPlays));
  return (
    <>
      <div className="adm-card">
        <p className="adm-card-title">제한 현황</p>
        <p className="adm-card-sub">
          모든 사용자의 기록을 모았어요. 「제한 기록」 은 앱이 제한 안내를 받고 멈출 때 그날 건수와 함께 남긴 것이고,
          「제한으로 끝난 실행」 은 실행 이력에서 상태가 제한 안내인 것이에요(기록이 아직 안 올라온 것도 보여요).
        </p>
        <div className="adm-row" style={{ gap: 8, marginBottom: 10 }}>
          <select className="adm-input" style={{ maxWidth: 140 }} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 14, 30, 60, 90, 180].map((d) => <option key={d} value={d}>최근 {d}일</option>)}
          </select>
          <button className="adm-btn adm-btn--ghost" disabled={busy} onClick={() => void load()}>새로 보기</button>
          {data ? (
            <span className="adm-muted">
              제한 기록 {data.totals.blocks}건 · 아이디 {data.totals.accounts}개 · 제한으로 끝난 실행 {data.totals.blockedPlays}건
            </span>
          ) : null}
        </div>
        {!data ? <p className="adm-empty">불러오는 중…</p> : (
          <>
            {/* 날마다 — 진한 칸은 제한 기록, 옅은 칸은 제한으로 끝난 실행 */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 90, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
              {data.series.map((d) => (
                <div key={d.day} title={`${d.day} · 제한 기록 ${d.blocks} · 제한으로 끝난 실행 ${d.blockedPlays}`}
                  style={{ flex: 1, minWidth: 2, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                  <div style={{ height: `${(d.blockedPlays / peak) * 100}%`, background: "var(--danger-subtle)" }} />
                  <div style={{ height: `${(d.blocks / peak) * 100}%`, background: "var(--danger)" }} />
                </div>
              ))}
            </div>
            <div className="adm-row adm-muted" style={{ justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
              <span>{data.since}</span>
              <span>■ 진한 칸 제한 기록 · 옅은 칸 제한으로 끝난 실행 · 가장 많은 날 {peak}건</span>
              <span>{data.until}</span>
            </div>
          </>
        )}
      </div>

      <div className="adm-card">
        <p className="adm-card-title">행동별 하루 건수와 추천 상한</p>
        <p className="adm-card-sub">
          분포는 <b>가장 적음 · 아래 25% · 중간 · 위 25% · 가장 많음</b> 이에요. 「걸린 날」 은 제한에 걸렸을 때 그날 그 행동을 몇 건 했는지,
          「무사한 날」 은 제한이 없던 날(그 아이디에 제한이 있던 날은 뺌) 몇 건 했는지예요.
        </p>
        <p className="adm-note adm-note--info" style={{ marginBottom: 12 }}>
          추천 상한 = 걸린 날의 <b>아래 25% 값 × 0.8</b>(걸린 사람 넷 중 하나는 이보다 적게 하고도 걸렸으니 20% 더 물린다).
          단 무사한 날의 <b>위 10% 값(p90)</b> 을 넘지 않게 하고, 20 이상이면 5 단위로 내려요. 제한 기록이 없으면 추천하지 않아요.
          기록이 3건 미만이면 「근거 적음」 — 참고만 하세요.
        </p>
        {!data ? null : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>행동</th><th>제한 기록 · 아이디</th><th>제한으로 끝난 실행</th><th>걸린 날 건수</th><th>무사한 날 건수</th><th>지금 상한</th><th>추천</th><th>새 상한</th></tr>
              </thead>
              <tbody>
                {data.actions.map((a) => (
                  <tr key={a.action}>
                    <td style={{ fontWeight: 700 }}>{capName(a.action)}</td>
                    <td>{a.blocks}건 · {a.accounts}개</td>
                    <td>{a.blockedPlays}건</td>
                    <td className="adm-muted">{distText(a.blockDay)}{a.blockDay ? <div>({a.blockDay.n}번)</div> : null}</td>
                    <td className="adm-muted">{distText(a.safeDay)}{a.safeDay ? <div>(p90 {a.safeDay.p90} · {a.safeDay.n}일)</div> : null}</td>
                    <td>{a.cap ? a.cap.toLocaleString() : "제한 없음"}</td>
                    <td className="adm-wrap-cell">
                      {a.suggested === null ? <span className="adm-muted">—</span> : (
                        <>
                          <b>{a.suggested.toLocaleString()}</b>
                          {a.lowData ? <span className="adm-pill adm-pill--wait" style={{ marginLeft: 6 }}>근거 적음</span> : null}
                          {" "}
                          <button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setCaps({ ...caps, [a.action]: a.suggested ?? 0 })}>넣기</button>
                        </>
                      )}
                      <div className="adm-muted" style={{ fontSize: 12 }}>{a.basis}</div>
                    </td>
                    <td>
                      <input className="adm-input" style={{ width: 90 }} type="number" min={0} value={caps[a.action] ?? 0}
                        onChange={(e) => setCaps({ ...caps, [a.action]: Number(e.target.value) })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="adm-row" style={{ marginTop: 14, gap: 8, flexWrap: "wrap" }}>
          <button className="adm-btn" disabled={busy || !data} onClick={() => void save()}>상한 저장</button>
          <button className="adm-btn adm-btn--ghost" disabled={busy} onClick={writeNotice}>사용자에게 공지 쓰기</button>
          {msg ? <span className={msg.ok ? "adm-msg adm-msg--ok" : "adm-msg adm-msg--bad"}>{msg.text}</span> : null}
        </div>
        <p className="adm-card-sub" style={{ marginTop: 8 }}>
          0 = 제한 없음. 저장하면 운영 설정의 「인스타그램 아이디당 하루 상한」 과 같은 값이 바뀌어요.
          「사용자에게 공지 쓰기」 는 바꾼 칸을 담은 초안으로 공지 탭을 열어요(올리기 전에 고칠 수 있어요).
        </p>
      </div>
    </>
  );
}

/* ── 공지 게시판 (2026-11-08) ─────────────────────────────────
 * 예전에는 운영 설정의 한 줄이었다. 이제 여러 개를 쓰고 · 고치고 · 켜고 끈다.
 * 새 앱은 켜진 공지를 모두 받는다(/api/ig-tidy/notices). 예전 앱 띠에는 **가장 최근에 켜진 하나**가 나간다. */
type Notice = { id: string; title: string; body: string; level: "info" | "important"; active: boolean; publishedAt: string | null; updatedAt: string | null };
type NoticeDraft = { title: string; body: string; level: "info" | "important"; active: boolean; republish: boolean };
const EMPTY_NOTICE: NoticeDraft = { title: "", body: "", level: "info", active: true, republish: false };

/** 앱에서 보이는 모양을 흉내 낸다 — 위쪽 띠(예전 앱도 이 한 줄) + 펼친 본문 */
function NoticePreview({ n }: { n: Pick<Notice, "title" | "body" | "level"> }) {
  const important = n.level === "important";
  const first = n.body.split("\n").map((x) => x.trim()).find(Boolean) ?? "";
  const bar = first ? `${n.title} — ${first.length > 80 ? `${first.slice(0, 80)}…` : first}` : n.title;
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{
        padding: "8px 12px", fontSize: 13, fontWeight: 600,
        background: important ? "var(--danger-subtle)" : "var(--accent-soft)",
        color: important ? "var(--danger-ink)" : "var(--accent-ink)",
      }}>
        {important ? "중요 · " : "알림 · "}{bar || "제목을 적으면 여기 보여요"}
      </div>
      <div style={{ padding: "10px 12px", background: "var(--surface)" }}>
        <p style={{ margin: 0, fontWeight: 700 }}>{n.title || "제목"}</p>
        {n.body ? <p className="adm-muted" style={{ margin: "6px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{n.body}</p> : null}
      </div>
    </div>
  );
}

function NoticesView({ draft }: { draft?: string }) {
  const [rows, setRows] = useState<Notice[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);   // null = 새 공지
  const [form, setForm] = useState<NoticeDraft>(() => (draft ? { ...EMPTY_NOTICE, ...splitDraft(draft) } : EMPTY_NOTICE));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { ask, dialog } = useConfirm();

  const load = useCallback(async () => {
    try {
      setRows((await adminApi<{ notices: Notice[] }>("/api/admin/ig-tidy/notices")).notices);
    } catch (err) {
      setMsg({ ok: false, text: adminErrorMessage(err) });
      setRows([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(fn: () => Promise<unknown>, ok: string): Promise<boolean> {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      await load();
      return true;
    } catch (err) {
      setMsg({ ok: false, text: adminErrorMessage(err) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  function startEdit(n: Notice) {
    setEditing(n.id);
    setForm({ title: n.title, body: n.body, level: n.level, active: n.active, republish: false });
    setMsg(null);
  }
  function reset() { setEditing(null); setForm(EMPTY_NOTICE); }

  async function save() {
    const done = editing
      ? await act(() => adminApi("/api/admin/ig-tidy/notices", { method: "PATCH", body: { id: editing, ...form } }),
          form.republish ? "고쳤어요. 새 공지로 다시 띄워요(닫았던 사람에게도 떠요)." : "고쳤어요. 앱은 1분 안에 새 글을 받아요.")
      : await act(() => adminApi("/api/admin/ig-tidy/notices", { method: "POST", body: form }),
          form.active ? "올렸어요. 켜져 있는 앱은 1분 안에 띄워요." : "꺼 둔 채로 저장했어요.");
    if (done) reset();
  }

  async function toggle(n: Notice) {
    await act(() => adminApi("/api/admin/ig-tidy/notices", { method: "PATCH", body: { id: n.id, active: !n.active } }),
      n.active ? "내렸어요. 앱에서 곧 사라져요." : "다시 켰어요.");
  }

  async function remove(n: Notice) {
    if (!(await ask({ title: `「${n.title}」 공지를 지울까요?`, lines: ["되돌릴 수 없어요. 잠깐 내리기만 하려면 「내리기」 를 쓰세요."], confirmLabel: "지우기", danger: true }))) return;
    await act(() => adminApi("/api/admin/ig-tidy/notices", { method: "DELETE", body: { id: n.id } }), "지웠어요.");
    if (editing === n.id) reset();
  }

  const latestActive = rows?.find((r) => r.active);
  return (
    <>
      <div className="adm-card">
        <p className="adm-card-title">{editing ? "공지 고치기" : "새 공지"}</p>
        <p className="adm-card-sub">
          켜진 공지는 앱에 모두 보여요(최근 것부터). 예전 버전 앱은 위쪽 띠 한 줄만 보여서 <b>가장 최근에 켜진 공지</b>의
          제목(+ 본문 첫 줄)이 나가요. 띠를 닫은 사람에게는 같은 공지가 다시 뜨지 않아요.
        </p>
        <label className="adm-field"><span className="adm-label">제목</span>
          <input className="adm-input" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="예) 11/10 새벽 2~3시 점검" /></label>
        <label className="adm-field"><span className="adm-label">본문 (여러 줄)</span>
          <textarea className="adm-textarea" rows={5} maxLength={3000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder={"그 시간에는 실행이 멈출 수 있어요.\n점검이 끝나면 다시 시작해 주세요."} /></label>
        <div className="adm-row" style={{ gap: 14, flexWrap: "wrap" }}>
          <label className="adm-field" style={{ minWidth: 180 }}><span className="adm-label">중요도</span>
            <select className="adm-input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value === "important" ? "important" : "info" })}>
              <option value="info">알림</option>
              <option value="important">중요 — 눈에 띄게</option>
            </select></label>
          <label className="adm-row" style={{ gap: 6 }}>
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            <span>앱에 보이기</span>
          </label>
          {editing ? (
            <label className="adm-row" style={{ gap: 6 }}>
              <input type="checkbox" checked={form.republish} onChange={(e) => setForm({ ...form, republish: e.target.checked })} />
              <span>새 공지로 다시 띄우기 — 닫았던 사람에게도 다시 떠요</span>
            </label>
          ) : null}
        </div>
        <p className="adm-label" style={{ marginTop: 12 }}>미리 보기 — 앱에서 이렇게 보여요</p>
        <NoticePreview n={form} />
        <div className="adm-row" style={{ marginTop: 12, gap: 8 }}>
          <button className="adm-btn" disabled={busy || !form.title.trim()} onClick={() => void save()}>{editing ? "고치기" : "올리기"}</button>
          {editing ? <button className="adm-btn adm-btn--ghost" disabled={busy} onClick={reset}>취소</button> : null}
          {msg ? <span className={msg.ok ? "adm-msg adm-msg--ok" : "adm-msg adm-msg--bad"}>{msg.text}</span> : null}
        </div>
      </div>

      <div className="adm-card">
        <p className="adm-card-title">공지 목록</p>
        <p className="adm-card-sub">
          지금 예전 앱 띠에 나가는 공지: <b>{latestActive ? latestActive.title : "없음(띠가 내려가요)"}</b>
        </p>
        {rows === null ? <p className="adm-empty">불러오는 중…</p> : rows.length === 0 ? <p className="adm-empty">아직 공지가 없어요.</p> : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>올린 때</th><th>상태</th><th>중요도</th><th>제목 · 본문</th><th /></tr></thead>
              <tbody>
                {rows.map((n) => (
                  <tr key={n.id}>
                    <td className="adm-muted">{shortDate(n.publishedAt)}</td>
                    <td>{n.active ? <span className="adm-pill adm-pill--done">보이는 중</span> : <span className="adm-pill">내림</span>}</td>
                    <td>{n.level === "important" ? <span className="adm-pill adm-pill--wait">중요</span> : "알림"}</td>
                    <td className="adm-wrap-cell">
                      <b>{n.title}</b>
                      {n.body ? <div className="adm-muted" style={{ whiteSpace: "pre-wrap" }}>{n.body.length > 160 ? `${n.body.slice(0, 160)}…` : n.body}</div> : null}
                    </td>
                    <td>
                      <div className="adm-row" style={{ gap: 6 }}>
                        <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={busy} onClick={() => startEdit(n)}>고치기</button>
                        <button className="adm-btn adm-btn--ghost adm-btn--sm" disabled={busy} onClick={() => void toggle(n)}>{n.active ? "내리기" : "다시 켜기"}</button>
                        <button className="adm-btn adm-btn--danger adm-btn--sm" disabled={busy} onClick={() => void remove(n)}>지우기</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {dialog}
    </>
  );
}

/** 「현황」 탭이 넘겨준 초안 — 첫 줄은 제목, 나머지는 본문 */
function splitDraft(text: string): Pick<NoticeDraft, "title" | "body"> {
  const [title, ...rest] = text.split("\n");
  return { title: title.trim(), body: rest.join("\n").trim() };
}

/* ── 새 버전 올리기 ─────────────────────────────────────────
 * 설치 파일(.exe)을 고르면: sha256 을 재고 → R2 로 곧장 올리고(진행률) → 버전 · 바뀐 점을 등록한다.
 * 포털(Vercel)을 거치지 않는다 — 100MB 안팎이라 함수 본문 제한(4.5MB)을 넘는다. */
function UploadRelease({ onDone, latest }: { onDone: () => Promise<void>; latest: string | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [mandatory, setMandatory] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function pick(f: File | null) {
    setFile(f);
    setMsg(null);
    const m = f?.name.match(/(\d+\.\d+\.\d+)/);
    if (m) setVersion(m[1]);
  }

  async function upload() {
    if (!file) return;
    setMsg(null);
    try {
      setStep("파일 지문(sha256) 재는 중…");
      const buf = await file.arrayBuffer();
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buf)))
        .map((b) => b.toString(16).padStart(2, "0")).join("");

      setStep("올릴 주소 받는 중…");
      const { url, key } = await adminApi<{ url: string; key: string }>("/api/admin/ig-tidy/releases/upload-url", {
        method: "POST", body: { version },
      });

      setStep("R2 에 올리는 중…");
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 가 ${xhr.status} 로 거절했어요`)));
        xhr.onerror = () => reject(new Error("R2 에 닿지 못했어요 — 버킷 CORS(PUT · 이 주소)를 확인해 주세요"));
        xhr.send(file);
      });

      setStep("버전 등록 중…");
      await adminApi("/api/admin/ig-tidy/releases", {
        method: "POST", body: { version, notes, key, sha256: hash, size: file.size, mandatory },
      });
      setMsg({ ok: true, text: `${version} 을 올렸어요. 1분 안에 앱들에 「새 버전」 이 떠요.` });
      setFile(null); setNotes(""); setMandatory(false); setPct(0);
      await onDone();
    } catch (err) {
      setMsg({ ok: false, text: adminErrorMessage(err) });
    } finally {
      setStep(null);
    }
  }

  const sameOrOlder = !!(latest && version && version.split(".").map(Number).reduce((acc, n, i) => acc !== 0 ? acc : n - (latest.split(".").map(Number)[i] ?? 0), 0) <= 0);
  return (
    <div className="adm-card">
      <p className="adm-card-title">새 버전 올리기</p>
      <p className="adm-card-sub">
        <code>npm run dist</code> 로 만든 <code>IG-Tidy-Setup-x.y.z.exe</code> 를 골라 올려요. 지금 최신은 <b>{latest ?? "없음"}</b>.
      </p>
      <label className="adm-field"><span className="adm-label">설치 파일</span>
        <input type="file" accept=".exe" onChange={(e) => pick(e.target.files?.[0] ?? null)} disabled={!!step} /></label>
      <label className="adm-field"><span className="adm-label">버전 (파일 이름에서 읽어요)</span>
        <input className="adm-input" style={{ maxWidth: 160 }} value={version} onChange={(e) => setVersion(e.target.value)} disabled={!!step} /></label>
      {sameOrOlder ? <p className="adm-msg adm-msg--bad">최신({latest})보다 높아야 앱이 새 버전으로 알아봐요. package.json 의 version 을 올렸는지 확인해 주세요.</p> : null}
      <label className="adm-field"><span className="adm-label">바뀐 점 — 앱 알림과 업데이트 내역에 그대로 보여요</span>
        <textarea className="adm-textarea" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!!step}
          placeholder={"예)\n· AI댓글에 대상 고르기가 생겼어요\n· 피드 좋아요가 조금 빨라졌어요"} /></label>
      <label className="adm-row" style={{ gap: 6 }}>
        <input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} disabled={!!step} />
        <span>꼭 올려야 함 — 낮은 버전은 시작 전에 업데이트를 요구해요</span>
      </label>
      <div className="adm-row" style={{ marginTop: 12, gap: 10 }}>
        <button className="adm-btn" disabled={!file || !/^\d+\.\d+\.\d+$/.test(version) || !!step} onClick={upload}>올리기</button>
        {step ? <span className="adm-muted">{step}{step.startsWith("R2") ? ` ${pct}%` : ""}</span> : null}
        {msg ? <span className={msg.ok ? "adm-msg adm-msg--ok" : "adm-msg adm-msg--bad"}>{msg.text}</span> : null}
      </div>
    </div>
  );
}

/* ── 화면 묶음 — 앱 업데이트 없이 바뀌는 패널 · 자동화 스크립트(2026-11-08) ── */
type UiBundleRow = { rev: number; notes: string; minApp: string; size: number; disabled: boolean; publishedAt: string | null };
function UiBundlesCard() {
  const [rows, setRows] = useState<UiBundleRow[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(async () => {
    try {
      setRows((await adminApi<{ bundles: UiBundleRow[] }>("/api/admin/ig-tidy/ui")).bundles);
    } catch (err) {
      setMsg({ ok: false, text: adminErrorMessage(err) });
      setRows([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function toggle(r: UiBundleRow) {
    setMsg(null);
    try {
      await adminApi("/api/admin/ig-tidy/ui", { method: "PATCH", body: { rev: r.rev, disabled: !r.disabled } });
      setMsg({ ok: true, text: r.disabled ? `화면 묶음 ${r.rev} 을 다시 켰어요.` : `화면 묶음 ${r.rev} 을 껐어요 — 앱들은 5분 안에 그 앞 화면으로 돌아가요.` });
      await load();
    } catch (err) {
      setMsg({ ok: false, text: adminErrorMessage(err) });
    }
  }
  const live = rows?.find((r) => !r.disabled);
  return (
    <div className="adm-card">
      <p className="adm-card-title">화면 묶음 (앱 업데이트 없이 바뀌는 것)</p>
      <p className="adm-card-sub">
        패널 화면 · 인스타 자동화 스크립트는 앱을 다시 깔지 않고 바뀌어요. <code>ig-tidy-desktop</code> 에서
        <code> npm run release -- --ui &quot;바뀐 점&quot;</code> 이 서명해서 올리고 여기 등록해요. 앱은 5분 안에 받아
        작업이 돌고 있지 않으면 바로 바꿔요. 문제가 있으면 <b>끄기</b> — 그 앞 묶음(없으면 앱에 든 화면)으로 돌아가요.
      </p>
      {rows === null ? <p className="adm-empty">불러오는 중…</p> : rows.length === 0 ? <p className="adm-empty">아직 올린 화면 묶음이 없어요 — 앱에 든 화면을 써요.</p> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>묶음</th><th>올린 때</th><th>앱 버전</th><th>상태</th><th>바뀐 점</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rev}>
                  <td style={{ fontWeight: 700 }}>{r.rev}</td>
                  <td className="adm-muted">{shortDate(r.publishedAt)}</td>
                  <td className="adm-muted">{r.minApp} 이상</td>
                  <td>{r.disabled ? <span className="adm-pill">꺼짐</span> : live && live.rev === r.rev ? <span className="adm-pill adm-pill--done">쓰는 중</span> : "—"}</td>
                  <td className="adm-wrap-cell">{r.notes || "—"}</td>
                  <td><button className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => void toggle(r)}>{r.disabled ? "다시 켜기" : "끄기"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {msg ? <p className={msg.ok ? "adm-msg adm-msg--ok" : "adm-msg adm-msg--bad"}>{msg.text}</p> : null}
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
      <UiBundlesCard />
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

      <UploadRelease onDone={async () => { await load(); await onSaved(); }} latest={rows && rows[0] ? rows[0].version : null} />

      <details className="adm-card">
        <summary className="adm-card-title" style={{ cursor: "pointer" }}>새 버전을 내는 순서 (처음이면 펼쳐 보세요)</summary>
        <ol className="adm-card-sub" style={{ lineHeight: 1.8, paddingLeft: 18 }}>
          <li><b>코드 고치기</b> — <code>C:\Dev\ig-tidy-desktop</code> 에서 고친다.</li>
          <li><b>버전 올리기</b> — <code>package.json</code> 의 <code>&quot;version&quot;</code> 을 올린다(예: 1.0.0 → 1.0.1). 앱은 이 숫자로 새것인지 가린다.</li>
          <li><b>설치 파일 만들기</b> — 그 폴더에서 <code>npm run dist</code>. 몇 분 뒤 <code>dist\IG-Tidy-Setup-1.0.1.exe</code> 가 생긴다.</li>
          <li><b>여기서 올리기</b> — 위 「새 버전 올리기」 에 그 파일을 고르고 버전 · 바뀐 점을 적고 「올리기」.
            파일 이름에서 버전을 읽어 미리 채워 준다.</li>
          <li><b>끝</b> — 1분 안에 켜져 있는 앱들 위쪽 띠에 「새 버전」 버튼이 뜨고, 앱을 다시 켜면 「지금 업데이트할까요?」 를 묻는다.
            「꼭 올려야 함」 을 켜면 낮은 버전은 시작 전에 업데이트를 요구한다.</li>
        </ol>
        <p className="adm-card-sub">
          한 번에 하려면 그 폴더에서 <code>npm run release -- &quot;바뀐 점&quot;</code> — 빌드 · 올리기 · 등록을 한꺼번에 한다
          (<code>.env.release</code> 에 R2 · 릴리스 비밀값이 있어야 한다).
        </p>
        <p className="adm-card-sub">
          <b>처음 한 번 필요한 준비</b> — Cloudflare R2 공용 버킷 <code>myjane</code>(공개 URL 은 끈 채로) · 그 버킷 CORS 에
          PUT/GET 과 <code>https://www.myjane.co.kr</code> · Vercel 에 <code>R2_ACCOUNT_ID</code> ·
          <code>R2_ACCESS_KEY_ID</code> · <code>R2_SECRET_ACCESS_KEY</code>. 파일은 <code>ig-tidy/releases/</code> 아래에 놓인다.
          없으면 「올리기」 가 그 이름을 대며 멈춘다.
        </p>
      </details>

      <details className="adm-card">
        <summary className="adm-card-title" style={{ cursor: "pointer" }}>손으로 등록 (파일을 R2 에 직접 올렸을 때만)</summary>
        <label className="adm-field"><span className="adm-label">버전 (1.2.3)</span>
          <input className="adm-input" style={{ maxWidth: 160 }} value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></label>
        <label className="adm-field"><span className="adm-label">R2 경로</span>
          <input className="adm-input" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="ig-tidy/releases/IG-Tidy-Setup-1.2.3.exe" /></label>
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
      </details>
    </>
  );
}
