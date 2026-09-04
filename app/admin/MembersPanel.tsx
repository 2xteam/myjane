"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, adminErrorMessage, shortDate } from "@/lib/adminClient";

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
 */
export function MembersPanel({ isMaster }: { isMaster: boolean }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setError(null);
    try {
      const res = await adminApi<{ users: Member[] }>(
        `/api/admin/users?q=${encodeURIComponent(q)}`,
      );
      setMembers(res.users);
    } catch (err) {
      setError(adminErrorMessage(err));
      setMembers([]);
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  async function setRole(m: Member, role: "operator" | null) {
    const label = role ? `${m.name}님을 운영자로 세울까요?` : `${m.name}님의 운영자 권한을 내릴까요?`;
    if (!confirm(label)) return;

    setBusy(m.id);
    try {
      await adminApi(`/api/admin/users/${m.id}/role`, { method: "PATCH", body: { role } });
      await load(query);
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
          void load(query);
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
              void load("");
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
                <th>이름</th>
                <th>이메일</th>
                <th>전화</th>
                <th>로그인 수단</th>
                <th>가입 출처</th>
                <th>2hbk</th>
                <th>마지막 로그인</th>
                <th>권한</th>
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
                  <td className="adm-muted">{shortDate(m.lastLoginAt)}</td>
                  <td>
                    {m.adminRole ? (
                      <span className="adm-pill">{m.adminRole === "master" ? "마스터" : "운영자"}</span>
                    ) : (
                      <span className="adm-muted">—</span>
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

      {!isMaster ? (
        <p className="adm-card-sub" style={{ marginTop: 14, marginBottom: 0 }}>
          운영자를 세우고 내리는 것은 마스터만 할 수 있습니다.
        </p>
      ) : null}
    </div>
  );
}
