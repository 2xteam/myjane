"use client";

import { useEffect, useState } from "react";
import { adminApi, adminErrorMessage } from "@/lib/adminClient";

/**
 * 공유 성과 — 누가 공유한 결과 링크로 사람들이 들어와 참여하고, 가입까지 이어졌나.
 *
 * 숫자와 저장은 그 앱의 `/api/admin/referrals` 가 낸다. 포털은 화면만.
 *   링크      그 회원이 만든 결과 링크 수
 *   열람      링크를 연 횟수
 *   참여      그 링크로 시작한 응시
 *   가입      링크로 시작한 뒤 결과 화면에서 새로 가입해 기록을 옮긴 사람
 *   로그인    이미 회원이던 사람이 로그인해 옮긴 경우 (가입으로 세지 않는다)
 * → my-obsidian-vault / 10-Projects/TypeLog.md 「공유 성과」
 */

type Person = { userId: string; nickname: string; email: string | null; phone: string | null; joinedAt: string | null };
type Sharer = Person & { links: number; views: number; plays: number; completed: number; signups: number; logins: number };
type Signup = { at: string | null; member: Person | null; sharer: Person | null; quiz: string; resultCode: string | null };
type Data = {
  since: string;
  total: { links: number; views: number; plays: number; signups: number; logins: number };
  sharers: Sharer[];
  signups: Signup[];
};

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : "—");
const contact = (p: Person | null) => (p ? [p.email, p.phone].filter(Boolean).join(" · ") || "—" : "—");

export function ReferralPanel({ appKey }: { appKey: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setData(await adminApi<Data>(`/api/admin/apps/${appKey}/referrals`));
      } catch (err) {
        setError(adminErrorMessage(err));
      }
    })();
  }, [appKey]);

  if (error) {
    return (
      <section className="adm-card">
        <h2 className="adm-card-title">공유 성과</h2>
        <p className="adm-card-sub">{error}</p>
      </section>
    );
  }
  if (!data) return null;

  const t = data.total;
  const list = focus ? data.signups.filter((s) => s.sharer?.userId === focus) : data.signups;
  const focusName = focus ? data.sharers.find((s) => s.userId === focus)?.nickname : null;

  return (
    <section className="adm-card">
      <h2 className="adm-card-title">공유 성과</h2>
      <p className="adm-card-sub">
        결과 링크로 들어온 사람이 참여하고 가입까지 이어졌는지. {data.since} 부터 쌓여요 — 그 전 기록에는 출처가 없어요.
      </p>

      <div className="adm-stats">
        <div className="adm-stat"><p className="adm-stat-label">결과 링크</p><p className="adm-stat-value">{t.links}</p></div>
        <div className="adm-stat"><p className="adm-stat-label">링크 열람</p><p className="adm-stat-value">{t.views}</p></div>
        <div className="adm-stat"><p className="adm-stat-label">링크로 참여</p><p className="adm-stat-value">{t.plays}</p></div>
        <div className="adm-stat"><p className="adm-stat-label">가입 전환</p><p className="adm-stat-value">{t.signups}</p></div>
        <div className="adm-stat"><p className="adm-stat-label">참여 → 가입</p><p className="adm-stat-value">{pct(t.signups, t.plays)}</p></div>
      </div>

      <h3 className="adm-card-title" style={{ marginTop: 22, fontSize: 15 }}>공유한 사람</h3>
      {data.sharers.length ? (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>회원</th><th>연락처</th><th>링크</th><th>열람</th><th>참여</th><th>완료</th>
                <th>가입</th><th>로그인</th><th>참여→가입</th><th></th>
              </tr>
            </thead>
            <tbody>
              {data.sharers.map((s) => (
                <tr key={s.userId} style={focus === s.userId ? { background: "var(--accent-soft, rgba(150,47,191,.08))" } : undefined}>
                  <td><b>{s.nickname}</b></td>
                  <td>{contact(s)}</td>
                  <td>{s.links}</td>
                  <td>{s.views}</td>
                  <td>{s.plays}</td>
                  <td>{s.completed}</td>
                  <td><b>{s.signups}</b></td>
                  <td>{s.logins}</td>
                  <td>{pct(s.signups, s.plays)}</td>
                  <td>
                    {s.signups ? (
                      <button type="button" className="adm-chip" onClick={() => setFocus(focus === s.userId ? null : s.userId)}>
                        {focus === s.userId ? "전체 보기" : "가입자 보기"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="adm-card-sub">아직 결과 링크를 만든 회원이 없어요.</p>
      )}

      <h3 className="adm-card-title" style={{ marginTop: 22, fontSize: 15 }}>
        {focusName ? `${focusName} 님의 링크로 가입한 사람` : "링크로 가입한 사람"} ({list.length})
      </h3>
      {list.length ? (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>가입(전환) 시각</th><th>가입한 회원</th><th>연락처</th><th>공유한 회원</th><th>질문지</th><th>결과</th></tr>
            </thead>
            <tbody>
              {list.map((s, i) => (
                <tr key={i}>
                  <td>{fmt(s.at)}</td>
                  <td><b>{s.member?.nickname ?? "—"}</b></td>
                  <td>{contact(s.member)}</td>
                  <td>{s.sharer?.nickname ?? "(비회원 링크)"}</td>
                  <td>{s.quiz}</td>
                  <td>{s.resultCode ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="adm-card-sub">아직 링크로 가입한 사람이 없어요.</p>
      )}
    </section>
  );
}
