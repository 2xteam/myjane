/**
 * 인증 메일의 **공통 틀**과 HTML 이스케이프.
 *
 * ## 왜 한 곳에 모으나
 *
 * 메일 본문마다 색과 브랜드를 따로 적어 두었더니 갈라졌다 — 포털이 보내는
 * 메일인데 제목이 `[SnapWord]` 이고 색이 옛 민트(`#2ee8ae`)였다.
 * 팔레트를 바꿔도 메일은 따라오지 않는다. 그래서 틀을 하나로 둔다.
 *
 * ⚠️ 메일 HTML 은 **CSS 변수를 쓸 수 없다.** 색을 리터럴로 적을 수밖에 없는
 * 유일한 자리다 — `scripts/design-check.mjs` 가 `api/auth` 와 함께 예외로 둔다.
 * 값은 `design/palette.json` 의 먹청과 맞춘다.
 *
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */

/** 먹청 팔레트에서 옮겨 온 값. palette.json 을 바꾸면 여기도 함께 고친다 */
const INK = "#116271";
const INK_DEEP = "#0d5866";
const TEXT = "#0f2027";
const DIM = "#566b70";
const FAINT = "#8a9a9e";
const DANGER = "#a83447";

/**
 * HTML 에 사람이 넣은 값을 끼울 때 **반드시** 통과시킨다.
 *
 * ⚠️ 이름은 사용자가 정하고 스키마는 `trim` 만 한다. 그대로 넣으면 이름에
 * 넣은 태그가 메일 본문이 된다 — 스크립트는 메일 클라이언트가 대개 막지만
 * **링크와 이미지는 그려진다.** 남의 메일함에 내가 쓴 링크를 띄울 수 있다.
 */
export function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type AuthMailOptions = {
  /** 인사말에 넣을 이름. 안에서 이스케이프한다 */
  name: string;
  /** 본문 문단들. **이미 안전한 HTML 이어야 한다** — 사람이 넣은 값은 먼저 이스케이프할 것 */
  body: string;
  /** 버튼 (있으면) */
  action?: { label: string; url: string };
  /** 버튼 아래 작은 글씨들 */
  notes?: string[];
  /** 눈에 걸리게 둘 경고 한 줄 */
  warn?: string;
  /** 위험한 동작이면 버튼을 붉게 */
  danger?: boolean;
};

/**
 * 인증 메일 한 통을 만든다.
 *
 * `url` 은 우리가 만든 주소만 넘긴다 — 사람이 넣은 값을 그대로 링크로 만들지
 * 않는다.
 */
export function authMail(o: AuthMailOptions): string {
  const btn = o.danger ? DANGER : INK;
  const action = o.action
    ? `<div style="text-align:center;margin:24px 0;">
        <a href="${o.action.url}" style="display:inline-block;padding:14px 32px;background:${btn};color:#ffffff;font-weight:700;border-radius:12px;text-decoration:none;font-size:15px;">
          ${escapeHtml(o.action.label)}
        </a>
      </div>`
    : "";

  const notes = (o.notes ?? [])
    .map((n) => `<p style="color:${DIM};font-size:13px;margin:6px 0;">${n}</p>`)
    .join("");

  const warn = o.warn
    ? `<p style="color:${DANGER};font-size:13px;font-weight:700;margin:14px 0 0;">${o.warn}</p>`
    : "";

  const raw = o.action?.url
    ? `<p style="color:${FAINT};font-size:11px;margin-top:24px;word-break:break-all;">링크가 동작하지 않으면 아래 URL을 브라우저에 붙여넣기 하세요:<br/>${o.action.url}</p>`
    : "";

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:${TEXT};">
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;color:${INK_DEEP};">myjane</h2>
      <p>안녕하세요, <strong>${escapeHtml(o.name)}</strong>님.</p>
      ${o.body}
      ${action}
      ${notes}
      ${warn}
      ${raw}
    </div>`;
}
