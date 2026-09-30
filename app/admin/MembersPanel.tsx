"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, adminErrorMessage, shortDate } from "@/lib/adminClient";
import { useConfirm } from "./ConfirmDialog";
import { Pagination, SortableTh, listQueryDefaults, listQueryParams, type ListQuery } from "./Pagination";

type Member = {
  id: string;
  name: string;
  email: string | null;
  phoneTail: string | null;
  methods: string[];
  userId: string | null;
  signupFrom: string | null;
  adminRole: "master" | "operator" | null;
  createdAt: string | null;
  lastLoginAt: string | null;
};

/**
 * 회원 탭 — 통합 admin에서 가장 값진 화면.
 *
 * 한 사람이 어느 앱에서 가입했는지, 어떤 수단으로 로그인하는지, 2hbk를 쓰는지를
 * 한 줄에서 본다. 각 앱의 admin에서는 자기 앱 것만 보여 알 수 없던 것이다.
 *
 * 운영자 세우기·내리기는 **마스터에게만** 보인다.
 *
 * 정렬·페이징은 **서버에서** 한다(기본: 가입일 최근 순, 20건씩) → app/api/admin/users/route.ts
 * 부품은 공용이다 → ./Pagination.tsx
 */
export function MembersPanel({ isMaster }: { isMaster: boolean }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  /** 입력칸의 글자 */
  const [query, setQuery] = useState("");
  /** "찾기" 를 눌러 실제로 적용한 검색어 */
  const [searched, setSearched] = useState("");
  const [list, setList] = useState<ListQuery>(() => listQueryDefaults("createdAt", "desc"));
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { ask, dialog } = useConfirm();

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await adminApi<{ users: Member[]; total: number; page: number }>(
        `/api/admin/users?q=${encodeURIComponent(searched)}&${listQueryParams(list)}`,
      );
      setMembers(res.users);
      setTotal(res.total);
      // 지우거나 검색해서 지금 쪽이 비었으면 마지막 쪽으로 — 빈 표에 머물지 않게
      const last = Math.max(1, Math.ceil(res.total / list.pageSize));
      if (list.page > last) setList((l) => ({ ...l, page: last }));
    } catch (err) {
      setError(adminErrorMessage(err));
      setMembers([]);
      setTotal(0);
    }
  }, [searched, list]);

  useEffect(() => {
    void load();
  }, [load]);

  /** 검색은 1쪽부터 */
  const search = (q: string) => {
    setSearched(q);
    setList((l) => ({ ...l, page: 1 }));
  };

  /**
   * 이 회원으로 대리 로그인 — 1시간. 끝나면(종료·만료) 이 화면으로 돌아온다 → lib/impersonation.ts
   * 관리자 계정은 막는다(서버도 막는다).
   */
  async function impersonate(m: Member) {
    const ok = await ask({
      title: `${m.name || "이 회원"}님의 계정으로 로그인할까요?`,
      lines: [
        "1시간 뒤 자동으로 끝나고 관리자 계정으로 돌아옵니다(5분 이내에 1시간씩 연장 가능).",
        "고객이 보는 화면을 그대로 보며, 기록을 바꾸면 고객 기록이 바뀝니다.",
        "계정 설정(비밀번호·탈퇴·이메일·동의)은 바꿀 수 없습니다.",
        "시작·연장·종료가 감사 기록에 남습니다.",
      ],
      confirmLabel: "이 계정으로 로그인",
      danger: true,
    });
    if (!ok) return;

    setBusy(m.id);
    try {
      const res = await adminApi<{ next?: string }>(`/api/admin/users/${m.id}/impersonate`, { method: "POST" });
      window.location.href = res.next ?? "/";
    } catch (err) {
      setError(adminErrorMessage(err));
      setBusy(null);
    }
  }

  async function setRole(m: Member, role: "operator" | null) {
    const label = role ? `${m.name}님을 운영자로 세울까요?` : `${m.name}님의 운영자 권한을 내릴까요?`;
    if (!(await ask({ title: label, confirmLabel: role ? "운영자로 세우기" : "권한 내리기", danger: !role }))) return;

    setBusy(m.id);
    try {
      await adminApi(`/api/admin/users/${m.id}/role`, { method: "PATCH", body: { role } });
      await load();
    } catch (err) {
      setError(adminErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="adm-card">
      <p className="adm-card-title">회원</p>
      <p className="adm-card-sub">
        네 앱이 함께 쓰는 계정입니다. 로그인 수단은 어느 칸이 채워졌는지로 정해집니다.
      </p>

      <form
        className="adm-row"
        style={{ marginBottom: 14 }}
        onSubmit={(e) => {
          e.preventDefault();
          search(query.trim());
        }}
      >
        <input
          className="adm-input"
          style={{ maxWidth: 280 }}
          placeholder="이름 · 이메일 · 전화번호"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="adm-btn" type="submit">
          찾기
        </button>
        {query ? (
          <button
            className="adm-btn adm-btn--ghost"
            type="button"
            onClick={() => {
              setQuery("");
              search("");
            }}
          >
            전체
          </button>
        ) : null}
      </form>

      {error ? <p className="adm-note adm-note--error">{error}</p> : null}

      {members === null ? (
        <p className="adm-empty">불러오는 중…</p>
      ) : members.length === 0 ? (
        <p className="adm-empty">찾는 회원이 없습니다.</p>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <SortableTh label="이름" sortKey="name" query={list} onChange={setList} />
                <SortableTh label="이메일" sortKey="email" query={list} onChange={setList} />
                <SortableTh label="전화" sortKey="phone" query={list} onChange={setList} />
                <SortableTh label="로그인 수단" sortKey="methods" query={list} onChange={setList} firstDir="desc" />
                <SortableTh label="가입 출처" sortKey="signupFrom" query={list} onChange={setList} />
                <SortableTh label="2hbk" sortKey="uses2hbk" query={list} onChange={setList} firstDir="desc" />
                <SortableTh label="가입일" sortKey="createdAt" query={list} onChange={setList} firstDir="desc" />
                <SortableTh label="마지막 로그인" sortKey="lastLoginAt" query={list} onChange={setList} firstDir="desc" />
                <SortableTh label="권한" sortKey="adminRole" query={list} onChange={setList} firstDir="desc" />
                <th>대리 로그인</th>
                {isMaster ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 700 }}>{m.name || "—"}</td>
                  <td className="adm-muted">{m.email ?? "—"}</td>
                  <td className="adm-muted">{m.phoneTail ? `···${m.phoneTail}` : "—"}</td>
                  <td>{m.methods.length ? m.methods.join(" · ") : <span className="adm-muted">없음</span>}</td>
                  <td className="adm-muted">{m.signupFrom ?? "—"}</td>
                  <td>{m.userId ? "쓰는 중" : <span className="adm-muted">—</span>}</td>
                  <td className="adm-muted">{shortDate(m.createdAt)}</td>
                  <td className="adm-muted">{shortDate(m.lastLoginAt)}</td>
                  <td>
                    {m.adminRole ? (
                      <span className="adm-pill">{m.adminRole === "master" ? "마스터" : "운영자"}</span>
                    ) : (
                      <span className="adm-muted">—</span>
                    )}
                  </td>
                  <td>
                    {m.adminRole ? (
                      <span className="adm-muted">—</span>
                    ) : (
                      <button
                        className="adm-btn adm-btn--ghost"
                        disabled={busy === m.id}
                        onClick={() => impersonate(m)}
                        title="이 회원의 계정으로 1시간 로그인합니다"
                      >
                        이 계정으로 로그인
                      </button>
                    )}
                  </td>
                  {isMaster ? (
                    <td>
                      {m.adminRole === "master" ? (
                        <span className="adm-muted">—</span>
                      ) : m.adminRole === "operator" ? (
                        <button
                          className="adm-btn adm-btn--danger"
                          disabled={busy === m.id}
                          onClick={() => setRole(m, null)}
                        >
                          내리기
                        </button>
                      ) : (
                        <button
                          className="adm-btn adm-btn--ghost"
                          disabled={busy === m.id}
                          onClick={() => setRole(m, "operator")}
                        >
                          운영자로
                        </button>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {members !== null && total > 0 ? <Pagination query={list} total={total} onChange={setList} /> : null}

      {!isMaster ? (
        <p className="adm-card-sub" style={{ marginTop: 14, marginBottom: 0 }}>
          운영자를 세우고 내리는 것은 마스터만 할 수 있습니다.
        </p>
      ) : null}
      {dialog}
    </div>
  );
}
