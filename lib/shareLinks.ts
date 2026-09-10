import { getShareLinkModel, shareLinkUrlProblem } from "@/models/ShareLink";

/**
 * 공유형 링크 — admin 라우트 둘과 공개 화면(`/share`)이 함께 쓰는 조회·검증.
 * 라우트 파일에는 핸들러만 둔다(Next 가 다른 export 를 막는다).
 */

export type ShareLinkRow = {
  id: string;
  title: string;
  description: string;
  url: string;
  app: string;
  emoji: string;
  order: number;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

const iso = (d: unknown): string | null => (d instanceof Date ? d.toISOString() : null);

/** 전부(admin) 또는 켜진 것만(공개). `connectDB()` 뒤에 부른다 */
export async function listShareLinks(onlyActive = false): Promise<ShareLinkRow[]> {
  const rows = await getShareLinkModel()
    .find(onlyActive ? { active: true } : {})
    .sort({ order: 1, createdAt: -1 })
    .lean()
    .exec();
  return rows.map((r) => ({
    id: String(r._id),
    title: r.title,
    description: r.description ?? "",
    url: r.url,
    app: r.app ?? "",
    emoji: r.emoji ?? "",
    order: r.order ?? 0,
    active: r.active !== false,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  }));
}

/** 본문 검증 — `partial` 이면 없는 필드는 그대로 둔다(PATCH) */
export function parseShareLinkBody(body: Record<string, unknown>, partial = false) {
  const out: Record<string, unknown> = {};
  const errors: string[] = [];
  const str = (k: string, max: number) => {
    if (body[k] === undefined) return undefined;
    const v = typeof body[k] === "string" ? (body[k] as string).trim() : "";
    if (v.length > max) errors.push(`${k} 는 ${max}자까지입니다.`);
    return v;
  };
  const title = str("title", 80);
  if (title !== undefined) {
    if (!title) errors.push("제목을 입력해 주세요.");
    out.title = title;
  } else if (!partial) errors.push("제목을 입력해 주세요.");
  const description = str("description", 240);
  if (description !== undefined) out.description = description;
  const url = str("url", 500);
  if (url !== undefined) {
    const problem = url ? shareLinkUrlProblem(url) : "주소를 입력해 주세요.";
    if (problem) errors.push(problem);
    out.url = url;
  } else if (!partial) errors.push("주소를 입력해 주세요.");
  const app = str("app", 20);
  if (app !== undefined) out.app = app || "typelog";
  const emoji = str("emoji", 8);
  if (emoji !== undefined) out.emoji = emoji;
  if (body.order !== undefined) {
    const n = Number(body.order);
    if (!Number.isFinite(n)) errors.push("순서는 숫자여야 합니다.");
    else out.order = Math.trunc(n);
  }
  if (body.active !== undefined) out.active = body.active === true;
  return { out, errors };
}

/** 카드에 붙는 서비스 표시 */
export const SHARE_APP_LABEL: Record<string, string> = {
  typelog: "TypeLog · 성향 기록",
  fitlog: "FitLog · 건강 기록",
  snapword: "SnapWord · 공부 기록",
  snapnote: "SnapNote · 공부 기록",
  "2hbk": "2hbk · 습관 기록",
  myjane: "myjane",
};
