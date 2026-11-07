import type { Metadata } from "next";
import { connectDB } from "@/lib/db";
import { loadSettings, publicSettings } from "@/lib/igTidy";
import { getIgReleaseModel } from "@/models/IgTidy";
import { IgTidyShell } from "../IgTidyShell";

export const metadata: Metadata = {
  title: "IG Tidy 업데이트 내역",
  robots: { index: false },
};

/** 새 버전을 올리면 곧 보이게 — 캐시 60초 */
export const revalidate = 60;

/**
 * `/ig-tidy/updates` — 업데이트 내역 (2026-11-07).
 *
 * 앱 위쪽 띠의 「업데이트 내역」 이 이 화면을 작은 창으로 띄운다. 관리 화면 「배포 버전」 에서
 * 올린 버전과 바뀐 점, 지금 걸려 있는 공지를 최근부터 보여 준다. 검색 색인은 막는다.
 */
export default async function IgTidyUpdates() {
  await connectDB();
  const [rows, settings] = await Promise.all([
    getIgReleaseModel().find().sort({ publishedAt: -1 }).limit(50).lean().exec(),
    loadSettings().then(publicSettings),
  ]);
  const date = (d: unknown) =>
    d instanceof Date
      ? `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`
      : "";

  return (
    <IgTidyShell>
      <h1 className="headline" style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)" }}>업데이트 내역</h1>
      {settings.notice ? (
        <div className="lead" style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "var(--accent-soft, #e8f3f4)" }}>
          <b>공지</b> — <span style={{ whiteSpace: "pre-line" }}>{settings.notice}</span>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <p className="lead" style={{ marginTop: 18 }}>아직 올린 버전이 없어요.</p>
      ) : (
        <ol style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "grid", gap: 14 }}>
          {rows.map((r, i) => (
            <li key={r.version} style={{ borderTop: i ? "1px solid var(--border, #dbe7e9)" : "none", paddingTop: i ? 14 : 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                <b style={{ fontSize: "1.05rem" }}>{r.version}</b>
                <span className="lead" style={{ fontSize: "0.85rem", margin: 0 }}>{date(r.publishedAt)}</span>
                {i === 0 ? <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: 999, background: "var(--accent, #116271)", color: "#fff" }}>최신</span> : null}
                {r.mandatory ? <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: 999, border: "1px solid #c9a84c" }}>꼭 올려야 해요</span> : null}
              </div>
              <p className="lead" style={{ margin: "6px 0 0", whiteSpace: "pre-line", fontSize: "0.95rem" }}>{r.notes || "바뀐 점을 적지 않았어요."}</p>
            </li>
          ))}
        </ol>
      )}
    </IgTidyShell>
  );
}
