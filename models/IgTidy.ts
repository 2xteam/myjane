import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * IG Tidy — 윈도우 데스크톱 앱(인스타그램 정리 도우미)의 서버 쪽 데이터 (2026-11-06).
 *
 * 포털 자신의 데이터다. 서브도메인 앱을 따로 두지 않고 포털이 `/api/ig-tidy/*` 와
 * `/admin/ig-tidy` 를 함께 갖는다. 그래서 통합 admin 이 앱 API 를 거치지 않고 직접 읽는다.
 *
 * DB 이름은 **코드에 못 박는다** — 환경 변수로 바꿀 수 없다. URI 경로나 다른 앱의 `.env`
 * 에서 따라온 `MONGO_DB` 를 믿었다가 데이터가 남의 DB 에 쌓인 사고가 두 번 있었다.
 * → my-obsidian-vault / 40-Infra/MongoDB Atlas.md
 *
 * 사용 허용 여부는 여기가 아니라 회원 문서(`users.igTidyAllowed`)에 있다.
 * → my-obsidian-vault / 10-Projects/IG Tidy.md
 */
export const IG_TIDY_DB = "igtidy";

function db() {
  return mongoose.connection.useDb(IG_TIDY_DB, { useCache: true });
}

/*
  ⚠️ `d.model<T>(name, schema, …)` 처럼 제네릭으로 부르면 Mongoose 오버로드 해석이 폭발해
  `tsc --noEmit` 이 메모리를 4GB 넘게 먹고 죽는다(2026-11-06 실측 — 이 파일 하나로 3분 넘게 멈춤).
  만들 때는 타입 없이 부르고 결과만 바꿔 끼운다. 15초로 돌아왔다.
*/
function model<T>(name: string, schema: Schema<any>, collection: string): Model<T> {
  const d = db();
  return (d.models[name] ?? d.model(name, schema, collection)) as unknown as Model<T>;
}

/* ── 인스타그램 아이디 ─────────────────────────────────────────
 * 허용된 회원은 아이디를 **여러 개** 쓴다. 앱이 로그인된 아이디를 처음 보면 여기에 더한다.
 * 한 인스타그램 아이디는 **한 회원에게만** 묶인다 — myjane 계정 하나로 남의 인스타를
 * 대신 돌려 주는 식으로 퍼지는 것을 막는다. 아이디는 소문자로 저장한다. */
const AccountSchema = new Schema(
  {
    uid: { type: Schema.Types.ObjectId, required: true, index: true },
    igUsername: { type: String, required: true, lowercase: true, trim: true },
    addedAt: { type: Date, default: Date.now },
    lastPlayAt: { type: Date, default: null },
    /** 관리자가 떼어 낸 아이디. 지우지 않고 표시만 한다(기록이 남아 있다) */
    removedAt: { type: Date, default: null },
    /** 「맞춤」 댓글 스타일 — 이 IG 계정의 내 글 · 내가 단 댓글을 AI 가 읽고 만든 지침(사용자가 고칠 수 있다) */
    customStyleGuide: { type: String, default: "" },
    customStyleSummary: { type: String, default: "" },
    /** 분석에 쓴 글 수 · 내 댓글 수 */
    customStylePosts: { type: Number, default: 0 },
    customStyleComments: { type: Number, default: 0 },
    customStyleAt: { type: Date, default: null },
  },
  { versionKey: false },
);
AccountSchema.index({ igUsername: 1 }, { unique: true });
export type IgTidyAccount = InferSchemaType<typeof AccountSchema>;
export const getIgAccountModel = () => model<IgTidyAccount>("IgTidyAccount", AccountSchema, "accounts");

/* ── 실행 1회 ─────────────────────────────────────────────
 * 시작할 때 만들고, 실행 중에는 60초마다 `leaseUntil` 을 늘리고, 끝날 때 닫는다.
 * **회원 한 명에게 살아 있는 실행은 하나뿐이다** — `leaseUntil` 이 지나지 않은 `running` 이
 * 있으면 다른 기기는 시작하지 못한다. 앱이 죽어도 임대가 지나면 저절로 풀린다. */
const PlaySchema = new Schema(
  {
    uid: { type: Schema.Types.ObjectId, required: true },
    igUsername: { type: String, required: true, lowercase: true },
    deviceId: { type: String, required: true },
    deviceName: { type: String, default: "" },
    appVersion: { type: String, default: "" },
    /** 탭 종류 — follow · unfollow · leavers · mutual · ratio · like · feed · story */
    kind: { type: String, required: true },
    /** 시작할 때의 설정 요약(간격·상한·검색어 등). 나중에 "어떻게 돌렸나" 를 본다 */
    opts: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["running", "done", "paused", "blocked", "stopped", "lost", "taken_over", "ended_by_admin"],
      default: "running",
    },
    startedAt: { type: Date, default: Date.now },
    leaseUntil: { type: Date, required: true },
    lastBeatAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    /** 행동별 성공·건너뜀·실패 수 — 패널의 집계(job.tally)와 같은 모양 */
    tally: { type: Schema.Types.Mixed, default: {} },
    /** 끝난 까닭(앱이 보여 준 문구) */
    reason: { type: String, default: "" },
    /** 다른 기기가 넘겨받았거나 관리자가 끝냈을 때, 다음 연장에서 이 문구로 멈추게 한다 */
    stopRequest: { type: String, default: null },
  },
  { versionKey: false },
);
PlaySchema.index({ uid: 1, status: 1, leaseUntil: -1 });
/*
  **동시 실행을 DB 가 막는다.** 회원 한 명에게 `running` 문서는 하나만 있을 수 있다.
  두 PC 가 같은 순간에 시작을 눌러도 하나는 중복 키로 실패한다 — 코드에서 "먼저 찾고 없으면
  넣기" 로 하면 그 틈에 둘 다 들어간다. 임대가 지난 running 은 시작 전에 `lost` 로 닫는다.
*/
PlaySchema.index({ uid: 1 }, { unique: true, partialFilterExpression: { status: "running" }, name: "one_running_per_user" });
PlaySchema.index({ uid: 1, igUsername: 1, startedAt: -1 });
PlaySchema.index({ startedAt: -1 });
export type IgTidyPlay = InferSchemaType<typeof PlaySchema>;
export const getIgPlayModel = () => model<IgTidyPlay>("IgTidyPlay", PlaySchema, "plays");

/* ── 아이디별 상태 ─────────────────────────────────────────
 * 구조로 나눌 까닭이 없는 덩어리만 **키 하나에 문서 하나**로 둔다
 * (job · formState · lists · historyMisc). 히스토리 본체는 아래 people · daily · snapshots · blocks.
 * 다른 PC 에서 로그인하면 이것을 받아 그대로 이어 간다.
 * 쓰는 기기가 늘 하나(실행 잠금)라서 마지막에 쓴 값이 이긴다. */
const StateSchema = new Schema(
  {
    uid: { type: Schema.Types.ObjectId, required: true },
    igUsername: { type: String, required: true, lowercase: true },
    key: { type: String, required: true },
    /**
     * 값은 **JSON 문자열**로 둔다. 확장의 기록은 인스타그램 아이디를 객체 키로 쓰는데
     * (`people["0.8.0.6_"]`), 아이디에 점이 들어가 Mongo 필드 이름으로 그대로 넣으면 경로로 읽힌다.
     */
    json: { type: String, default: "null" },
    bytes: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
    deviceId: { type: String, default: "" },
  },
  { versionKey: false, minimize: false },
);
StateSchema.index({ uid: 1, igUsername: 1, key: 1 }, { unique: true });
export type IgTidyState = InferSchemaType<typeof StateSchema>;
export const getIgStateModel = () => model<IgTidyState>("IgTidyState", StateSchema, "states");

/* ── 상대 계정 한 명 ───────────────────────────────────────
 * 히스토리의 중심. 확장의 `history` 에서 **사람을 키로 쓰던 칸을 전부 한 문서로 모은다.**
 *   people[u]      → fSince·fSeen·fGone·fEst / gSince·gSeen·gGone·gEst   (팔로워 f · 팔로잉 g)
 *   unfollowed[]   → unfollowedSeq   (배열이라 시각이 없다 — 순서만 보존한다)
 *   dropped[]      → droppedSeq
 *   tried[u]       → triedN · triedAt
 *   gaveUp[u]      → gaveUpTries · gaveUpAt
 *   converted[u]   → convertedTries · convertedAt
 *   commented[u]   → commentedAt
 *   dmSent[u]      → dmSentAt
 *   skip[]         → skip
 * 그래서 admin 에서 「이 사람을 언제 끊었나」 를 조회할 수 있고, 바뀐 사람만 고쳐 쓴다.
 * 시각은 ms 숫자 그대로 둔다(확장과 같은 단위 — 되돌릴 때 손실이 없다). */
const PersonSchema = new Schema(
  {
    uid: { type: Schema.Types.ObjectId, required: true },
    igUsername: { type: String, required: true, lowercase: true },
    target: { type: String, required: true },
    fSince: Number, fSeen: Number, fGone: Number, fEst: Number,
    gSince: Number, gSeen: Number, gGone: Number, gEst: Number,
    unfollowedSeq: Number,
    droppedSeq: Number,
    triedN: Number, triedAt: Number,
    gaveUpTries: Number, gaveUpAt: Number,
    convertedTries: Number, convertedAt: Number,
    commentedAt: Number,
    dmSentAt: Number,
    skip: Boolean,
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
PersonSchema.index({ uid: 1, igUsername: 1, target: 1 }, { unique: true });
PersonSchema.index({ uid: 1, igUsername: 1, updatedAt: -1 });
export const getIgPersonModel = () => model<Record<string, unknown>>("IgTidyPerson", PersonSchema, "people");

/* ── 날짜별 건수 ─────────────────────────────────────────── history.days[YYYY-MM-DD] */
const DailySchema = new Schema(
  {
    uid: { type: Schema.Types.ObjectId, required: true },
    igUsername: { type: String, required: true, lowercase: true },
    day: { type: String, required: true },
    /** 행동별 건수 { follow, like, … } — 시간대별은 `h` 안에 */
    counts: { type: Schema.Types.Mixed, default: {} },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false, minimize: false },
);
DailySchema.index({ uid: 1, igUsername: 1, day: 1 }, { unique: true });
export const getIgDailyModel = () => model<Record<string, unknown>>("IgTidyDaily", DailySchema, "daily");

/* ── 수집 시점의 숫자 ───────────────────────────────────── history.snapshots[] */
const SnapshotSchema = new Schema(
  {
    uid: { type: Schema.Types.ObjectId, required: true },
    igUsername: { type: String, required: true, lowercase: true },
    /** 한국 날짜 — 확장은 같은 날 여러 번 모으면 그날 마지막 것만 남긴다. 서버도 날짜로 덮어쓴다 */
    day: { type: String, required: true },
    at: { type: Number, required: true },
    values: { type: Schema.Types.Mixed, default: {} },
  },
  { versionKey: false, minimize: false },
);
SnapshotSchema.index({ uid: 1, igUsername: 1, day: 1 }, { unique: true });
export const getIgSnapshotModel = () => model<Record<string, unknown>>("IgTidySnapshot", SnapshotSchema, "snapshots");

/* ── 제한에 걸린 기록 ───────────────────────────────────── history.blocks[] */
const BlockSchema = new Schema(
  {
    uid: { type: Schema.Types.ObjectId, required: true },
    igUsername: { type: String, required: true, lowercase: true },
    at: { type: Number, required: true },
    kind: { type: String, default: "" },
    reason: { type: String, default: "" },
    today: { type: Schema.Types.Mixed, default: {} },
  },
  { versionKey: false, minimize: false },
);
BlockSchema.index({ uid: 1, igUsername: 1, at: 1 }, { unique: true });
export const getIgBlockModel = () => model<Record<string, unknown>>("IgTidyBlock", BlockSchema, "blocks");

/* ── 행동 기록 ────────────────────────────────────────────
 * 한 줄에 행동 하나 — 아이디별 히스토리의 본체. 이어 붙이기만 한다. */
const RunlogSchema = new Schema(
  {
    uid: { type: Schema.Types.ObjectId, required: true },
    igUsername: { type: String, required: true, lowercase: true },
    playId: { type: Schema.Types.ObjectId, default: null },
    t: { type: Date, required: true },
    action: { type: String, default: "" },
    result: { type: String, default: "" },
    user: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { versionKey: false },
);
RunlogSchema.index({ uid: 1, igUsername: 1, t: -1 });
RunlogSchema.index({ playId: 1, t: 1 });
export type IgTidyRunlog = InferSchemaType<typeof RunlogSchema>;
export const getIgRunlogModel = () => model<IgTidyRunlog>("IgTidyRunlog", RunlogSchema, "runlogs");

/* ── 허용 요청 ─────────────────────────────────────────
 * 앱에서 로그인했는데 아직 허용되지 않은 회원. 다른 앱에서 먼저 가입한 사람은 가입 출처가
 * `ig-tidy` 가 아니라서, 출처만 보면 관리 화면의 대기 목록에 나오지 않았다(2026-11-06).
 * 앱이 /api/ig-tidy/me 를 부를 때마다 시각을 올린다. 허용되면 지운다. */
const RequestSchema = new Schema(
  {
    uid: { type: Schema.Types.ObjectId, required: true },
    firstAt: { type: Date, default: Date.now },
    lastAt: { type: Date, default: Date.now },
    deviceName: { type: String, default: "" },
    appVersion: { type: String, default: "" },
  },
  { versionKey: false },
);
RequestSchema.index({ uid: 1 }, { unique: true });
RequestSchema.index({ lastAt: -1 });
export const getIgRequestModel = () => model<Record<string, unknown>>("IgTidyRequest", RequestSchema, "requests");

/* ── 기능별 허용 ────────────────────────────────────────
 * 앱 사용 허용(users.igTidyAllowed)과 따로 켜는 기능. 첫 번째가 **AI 댓글**(2026-11-07) —
 * OpenAI 를 부르는 일이라 비용이 들고, 남의 글에 말을 거는 일이라 관리자가 사람별로 켠다.
 * 허용되지 않은 사람은 앱에서 「관리자에게 요청하기」 를 누를 수 있다(aiRequestedAt). */
const PermSchema = new Schema(
  {
    uid: { type: Schema.Types.ObjectId, required: true },
    aiComment: { type: Boolean, default: false },
    aiCommentAt: { type: Date, default: null },
    aiCommentBy: { type: Schema.Types.ObjectId, default: null },
    aiRequestedAt: { type: Date, default: null },
  },
  { versionKey: false },
);
PermSchema.index({ uid: 1 }, { unique: true });
export const getIgPermModel = () => model<Record<string, unknown>>("IgTidyPerm", PermSchema, "perms");

/* ── AI 호출 기록 ─────────────────────────────────────────
 * 한 번 부를 때마다 한 줄 — 비용(토큰) · 걸린 시간 · 만든 문구. 하루 상한도 이걸로 센다.
 * SnapWord 의 openai_request_logs 와 같은 생각이다 → SnapWord/lib/openaiRequestLog.ts */
const AiLogSchema = new Schema(
  {
    uid: { type: Schema.Types.ObjectId, required: true },
    igUsername: { type: String, default: "", lowercase: true },
    target: { type: String, default: "" },
    permalink: { type: String, default: "" },
    model: { type: String, default: "" },
    promptTokens: { type: Number, default: null },
    completionTokens: { type: Number, default: null },
    totalTokens: { type: Number, default: null },
    /** 입력 중 OpenAI 프롬프트 캐시로 반값에 처리된 토큰(2026-11-08~) */
    cachedTokens: { type: Number, default: null },
    withImage: { type: Boolean, default: false },
    /** 댓글 스타일 — basic · hip · lively · humor · custom(맞춤), 스타일 분석은 analyze */
    style: { type: String, default: "basic" },
    /** 이 호출이 쓴 단위 — 비어 있으면 사진 포함 aiPhotoWeight · 글만 1(댓글). 스타일 분석은 따로 적는다 */
    units: { type: Number, default: null },
    ms: { type: Number, default: 0 },
    ok: { type: Boolean, default: false },
    skip: { type: Boolean, default: false },
    comment: { type: String, default: "" },
    reason: { type: String, default: "" },
    error: { type: String, default: "" },
    /**
     * 무엇을 만들었나 — comment(남의 글에 다는 댓글) · reply(내 글에 달린 댓글에 다는 답글, 2026-11-08).
     * 예전 줄에는 이 칸이 없다 — 없으면 comment 로 본다(집계는 `$ne: "reply"` 로 센다).
     */
    kind: { type: String, default: "comment" },
    /** 답글일 때 — 상대가 남긴 댓글(관리자가 만든 문구와 함께 훑어본다) */
    inReplyTo: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
AiLogSchema.index({ uid: 1, igUsername: 1, at: -1 });
AiLogSchema.index({ at: -1 });
export const getIgAiLogModel = () => model<Record<string, unknown>>("IgTidyAiLog", AiLogSchema, "ai_logs");

/* ── 운영 설정 (문서 하나) ─────────────────────────────────
 * 관리자가 정해 앱에 내려 주는 값. 사용자가 속도를 올려 계정 제한을 당하는 일을 막는다. */
const SettingsSchema = new Schema(
  {
    _id: { type: String, default: "main" },
    /** 꺼 두면 허용된 사람도 시작하지 못한다(인스타그램 화면이 크게 바뀌었을 때 등) */
    enabled: { type: Boolean, default: true },
    disabledMessage: { type: String, default: "" },
    /** 이보다 낮은 앱은 시작 전에 업데이트를 요구한다 */
    minVersion: { type: String, default: "0.0.0" },
    /** 행동별 하루 상한. 0 이면 제한 없음 */
    dailyCaps: {
      type: Schema.Types.Mixed,
      default: { follow: 150, unfollow: 300, like: 500, feed: 500, story: 500, comment: 30, dm: 50 },
    },
    /** 행동 사이 최소 간격(초). 앱의 간격 설정이 이보다 짧으면 이 값으로 올린다 */
    minDelaySec: { type: Number, default: 4 },
    /**
     * AI 댓글 — 하루 사용량은 **단위**로 센다(2026-11-07 사용자 결정).
     *   글만 = 1단위 · 사진 포함 = aiPhotoWeight(3)단위 — 원가 비율(사진 ≈ 글만 2.7배, 2026-11-08 실측)에 맞춘 값
     *   승인 전(무료) 하루 한도 = 사진 포함 aiFreePhotoDaily(50)개 = 200단위
     *   관리자 승인 후            = 사진 포함 aiApprovedPhotoDaily(300)개 = 1,200단위
     * myjane 계정 단위로 센다(인스타 아이디를 합쳐서) — 비용이 사람 단위로 나간다.
     */
    aiEnabled: { type: Boolean, default: true },
    aiFreePhotoDaily: { type: Number, default: 50 },
    aiApprovedPhotoDaily: { type: Number, default: 300 },
    aiPhotoWeight: { type: Number, default: 3 },
    /** 본문(해시태그 · 이모지 뺀 글자 수)이 이보다 길면 사진을 보내지 않는다(2026-11-08, 원가 줄이기). 0 = 늘 보낸다 */
    aiPhotoMaxCaption: { type: Number, default: 40 },
    /** 예전 앱 공지 한 줄 — 공지 게시판(notices)으로 옮겼다(2026-11-08). 값은 지우지 않고 남겨 둔다.
        게시판이 비어 있을 때 한 번 게시판으로 옮겨 담는다 → lib/igTidy.ts migrateLegacyNotice */
    notice: { type: String, default: "" },
    noticeAt: { type: Date, default: null },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: Schema.Types.ObjectId, default: null },
  },
  { versionKey: false, minimize: false },
);
export type IgTidySettings = InferSchemaType<typeof SettingsSchema>;
export const getIgSettingsModel = () => model<IgTidySettings>("IgTidySettings", SettingsSchema, "settings");

/* ── 공지 게시판 (2026-11-08) ────────────────────────────────
 * 예전에는 운영 설정의 한 줄(settings.notice · noticeAt)이었다. 여러 개를 쓰고 · 고치고 · 내리려고 게시판으로 옮겼다.
 * 앱은 /api/ig-tidy/notices 로 켜진 것만 받는다. **예전 앱**은 여전히 /api/ig-tidy/me 의
 * settings.notice · noticeAt 을 읽으므로, 그 두 칸은 가장 최근 켜진 공지로 채워 내려 준다 → lib/igTidy.ts noticeCompat
 * 앱은 publishedAt 으로 "새 공지" 를 가린다 — 글을 고쳐도 시각은 그대로(다시 띄우려면 republish). */
const NoticeSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    /** 여러 줄 본문 */
    body: { type: String, default: "" },
    /** info = 알림 · important = 중요(앱이 눈에 띄게) */
    level: { type: String, enum: ["info", "important"], default: "info" },
    active: { type: Boolean, default: true },
    publishedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { versionKey: false },
);
NoticeSchema.index({ active: 1, publishedAt: -1 });
NoticeSchema.index({ publishedAt: -1 });
export const getIgNoticeModel = () => model<Record<string, unknown>>("IgTidyNotice", NoticeSchema, "notices");

/* ── 배포한 버전 ──────────────────────────────────────────
 * 새 설치 파일을 올리면 한 줄 더한다. 앱은 가장 최근 것을 보고 "새 버전이 있어요" 를 띄운다.
 * 설치 파일 자체는 R2 에 있다(앱의 자동 업데이트가 받는다). */
const ReleaseSchema = new Schema(
  {
    version: { type: String, required: true },
    notes: { type: String, default: "" },
    /** 설치 파일 주소(손으로 받을 때) — 비워 두면 R2 의 key 로 내려 준다 */
    url: { type: String, default: "" },
    /** R2 비공개 버킷 안의 설치 파일 경로 (예: `ig-tidy/releases/IG-Tidy-Setup-1.2.0.exe`, 공용 버킷 myjane) */
    key: { type: String, default: "" },
    /** 앱이 받은 뒤 검증한다. 다르면 설치하지 않는다 */
    sha256: { type: String, default: "" },
    size: { type: Number, default: 0 },
    /** 이 버전부터는 꼭 올려야 하나 — 켜면 minVersion 도 함께 올린다 */
    mandatory: { type: Boolean, default: false },
    publishedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
ReleaseSchema.index({ version: 1 }, { unique: true });
ReleaseSchema.index({ publishedAt: -1 });
export type IgTidyRelease = InferSchemaType<typeof ReleaseSchema>;
export const getIgReleaseModel = () => model<IgTidyRelease>("IgTidyRelease", ReleaseSchema, "releases");

/* ── 화면 묶음 (2026-11-08) ─────────────────────────────────
 * 앱 업데이트 없이 바꾸는 패널 · 인스타 자동화 스크립트. 릴리스 스크립트(npm run release -- --ui)가 만든다.
 * 묶음은 gzip JSON 하나 — ed25519 로 서명했고, 앱은 내장 공개키로 확인한 뒤에만 쓴다(app/ui-bundle.js).
 * disabled 를 켜면 앱들이 그 앞 묶음(없으면 앱에 든 화면)으로 돌아간다 — 되돌리기. */
const UiBundleSchema = new Schema(
  {
    rev: { type: Number, required: true },
    notes: { type: String, default: "" },
    /** R2 경로 (ig-tidy/ui/ui-<rev>.json.gz) */
    key: { type: String, required: true },
    sha256: { type: String, required: true },
    size: { type: Number, default: 0 },
    /** 묶음 바이트에 대한 ed25519 서명(base64) */
    signature: { type: String, required: true },
    /** 이 묶음을 쓸 수 있는 가장 낮은 앱 버전 — 새 IPC 가 필요한 화면은 낮은 앱에 내려가지 않는다 */
    minApp: { type: String, default: "0.0.0" },
    disabled: { type: Boolean, default: false },
    publishedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
UiBundleSchema.index({ rev: 1 }, { unique: true });
export type IgTidyUiBundle = InferSchemaType<typeof UiBundleSchema>;
export const getIgUiBundleModel = () => model<IgTidyUiBundle>("IgTidyUiBundle", UiBundleSchema, "ui_bundles");
