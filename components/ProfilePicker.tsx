"use client";

/**
 * 프로필(본인 / 자녀) 고르기 — 로그인 직후(`/login`)와 전환 화면(`/account/switch`)이 함께 쓴다.
 * 이름만 보여 준다. 누가 누구인지는 가족이 안다.
 * → my-obsidian-vault / 50-Plans/F 보호자·자녀 계정.md
 */
export type Profile = { id: string; name: string; kind: "self" | "child" };

export function ProfilePicker({
  profiles,
  current,
  busy,
  onPick,
}: {
  profiles: Profile[];
  current?: string | null;
  busy?: boolean;
  onPick: (p: Profile) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {profiles.map((p) => {
        const isCurrent = current === p.id;
        return (
          <button
            key={p.id}
            type="button"
            disabled={busy || isCurrent}
            onClick={() => onPick(p)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 12,
              border: `1px solid ${isCurrent ? "var(--accent)" : "var(--border-strong)"}`,
              background: isCurrent ? "var(--accent-subtle, var(--surface))" : "var(--surface)",
              color: "var(--text)",
              font: "inherit",
              textAlign: "left",
              cursor: busy || isCurrent ? "default" : "pointer",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                display: "grid",
                placeItems: "center",
                background: p.kind === "self" ? "var(--accent)" : "var(--border)",
                color: p.kind === "self" ? "var(--on-accent)" : "var(--text)",
                fontWeight: 800,
              }}
            >
              {p.name.slice(0, 1) || "?"}
            </span>
            <span style={{ flex: 1 }}>
              <strong>{p.name}</strong>
              <span style={{ display: "block", fontSize: 12, color: "var(--text-dim)" }}>
                {p.kind === "self" ? "보호자 (본인)" : "자녀"}
                {isCurrent ? " · 지금 이 프로필" : ""}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
