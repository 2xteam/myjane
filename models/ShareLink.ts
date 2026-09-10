import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * 공유형 링크 — `www.myjane.co.kr/share` 에 나열하는 외부 공개 링크 (2026-09-10).
 *
 * 앱 안에서 만들어진 **공유 결과 링크**(예: TypeLog 의 `/r/<token>` — 친구가 나눈 타입 결과와
 * 그 질문지에 바로 참여하는 페이지)를 SNS 프로필 링크 한 장에 모아 보여 주는 용도다.
 * `/link` 는 서비스 소개 페이지 목록이고, `/share` 는 **그때그때 운영자가 고른 공유 링크** 목록이다.
 *
 * 포털 자신의 데이터라 `user` DB 에 둔다. 등록·수정은 통합 admin(`/admin/share`)에서만.
 * → my-obsidian-vault / 10-Projects/MyJane.md "/share"
 */
const ShareLinkSchema = new Schema(
  {
    /** 카드 제목 — "러닝 성향 · 나는 어떤 러너일까?" */
    title: { type: String, required: true, trim: true, maxlength: 80 },
    /** 한두 문장 설명 */
    description: { type: String, default: "", trim: true, maxlength: 240 },
    /** 열 주소 — 여섯 서비스 도메인의 https 링크만 */
    url: { type: String, required: true, trim: true },
    /** 어느 서비스의 링크인지 (typelog · fitlog · snapword · snapnote · 2hbk · myjane) */
    app: { type: String, default: "typelog", trim: true },
    /** 카드 앞의 이모지 (선택) */
    emoji: { type: String, default: "", trim: true, maxlength: 8 },
    /** 작은 수가 위 */
    order: { type: Number, default: 0 },
    /** 꺼 두면 목록에서 빠진다 (지우지 않고 숨긴다) */
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

ShareLinkSchema.index({ active: 1, order: 1, createdAt: -1 });

export type ShareLink = InferSchemaType<typeof ShareLinkSchema>;

/** 링크로 허용하는 호스트 — 우리 서비스만. 남의 주소를 우리 이름으로 내보내지 않는다 */
export const SHARE_LINK_HOSTS = [
  "www.myjane.co.kr",
  "myjane.co.kr",
  "typelog.myjane.co.kr",
  "fitlog.myjane.co.kr",
  "snapword.myjane.co.kr",
  "snapnote.myjane.co.kr",
  "2hbk.myjane.co.kr",
];

export function shareLinkUrlProblem(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "주소 형식이 올바르지 않습니다.";
  }
  if (u.protocol !== "https:") return "https 주소만 등록할 수 있어요.";
  if (!SHARE_LINK_HOSTS.includes(u.hostname)) return "myjane 서비스 도메인의 주소만 등록할 수 있어요.";
  return null;
}

/** `users` 와 같은 DB. 반드시 `connectDB()` 완료 후 호출 */
export function getShareLinkModel(): Model<ShareLink> {
  const dbName = (process.env.MONGO_USER_DB ?? "user").trim() || "user";
  const userDb = mongoose.connection.useDb(dbName, { useCache: true });
  return (
    (userDb.models.ShareLink as Model<ShareLink> | undefined) ??
    userDb.model<ShareLink>("ShareLink", ShareLinkSchema, "share_links")
  );
}
