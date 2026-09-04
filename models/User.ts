import mongoose, {
  Schema,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from "mongoose";

/**
 * myjane 통합 회원(`user` DB의 `users` 컬렉션) 스키마.
 *
 * SnapWord · SnapNote · FitLog 는 `전화번호 + PIN`으로 로그인하고,
 * 2hbk는 `이메일 + 비밀번호`로 로그인한다. 한 컬렉션이 두 방식을
 * 모두 담기 때문에 `phone`/`pin`/`name`과 `email`/`password`가 **모두 선택 필드**다.
 * 어느 쪽이 채워졌는지가 곧 그 계정이 쓸 수 있는 로그인 방식이다.
 *
 * → my-obsidian-vault / 30-Patterns/인증과 세션 공유.md
 */
const UserSchema = new Schema(
  {
    // ── 전화번호 + PIN 계열 (SnapWord · SnapNote · FitLog) ──
    name: { type: String, trim: true, default: null },
    phone: { type: String, index: true, default: null },
    pin: { type: String, default: null },
    pinResetToken: { type: String },
    pinResetExpires: { type: Date },

    // ── 이메일 + 비밀번호 계열 (2hbk) ──
    email: { type: String, trim: true, lowercase: true, default: null },
    password: { type: String, default: null },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },

    tokens: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date },

    /**
     * ── 포털 전용 ──
     * 통합 admin(`www.myjane.co.kr/admin`) 접근 권한.
     *
     * - `master`   : 운영자를 세우고 내릴 수 있다. 시드는 2xteam@naver.com 하나뿐이다
     * - `operator` : admin 화면을 보고 공지·문의를 다룬다. 권한 관리는 못 한다
     * - `null`     : admin 접근 불가 (대부분의 회원)
     *
     * 각 앱은 이 필드를 읽지도 쓰지도 않는다.
     */
    adminRole: { type: String, enum: ["master", "operator", null], default: null },

    /** 어느 앱에서 가입했는지 (통합 로그인에서 기록) */
    signupFrom: { type: String, default: null },

    /** FitLog 전용 신체 프로필 — 다른 앱은 사용하지 않는다 */
    heightCm: { type: Number, default: null },
    gender: { type: String, enum: ["male", "female", null], default: null },
    birthYear: { type: Number, default: null },

    /**
     * ── 2hbk 전용 ──
     * `userId`는 목표·팔로우·초대 문서가 참조하는 **도메인 식별자**다.
     * Mongo `_id`가 아니라 이 문자열(`user_xxxxxxxxx`)이 모든 참조의 기준이므로
     * 이관할 때 반드시 원본 값을 그대로 보존해야 한다.
     */
    userId: { type: String, default: null },
    nickname: { type: String, trim: true, default: null },
    profileImage: { type: String, default: null },
    emailVerified: { type: Boolean, default: false },
    followApprovalRequired: { type: Boolean, default: false },
  },
  { versionKey: false },
);

UserSchema.index({ phone: 1, name: 1 });
UserSchema.index({ email: 1 });

/**
 * `userId`는 값이 있을 때만 유일해야 한다. 다른 앱에서 만든 회원은 이 필드가 없고,
 * 스키마 기본값이 `null`이라 sparse 인덱스로는 null끼리 충돌한다. 그래서 부분 인덱스를 쓴다.
 *
 * `email`은 여기서 유일 인덱스를 걸지 않는다. 네 앱이 공유하는 컬렉션이라
 * 기존 `email_1`(비유일) 인덱스를 갈아엎어야 하기 때문이다. 중복은 가입 API에서 막는다.
 */
UserSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: "string" } } },
);

export type User = InferSchemaType<typeof UserSchema>;
export type UserDocument = HydratedDocument<User>;

/**
 * `users` 컬렉션은 URI 기본 DB가 아닌 `MONGO_USER_DB`(기본 `user`) DB에 둡니다.
 * 반드시 `connectDB()` 완료 후 호출하세요.
 */
export function getUserModel(): Model<User> {
  const dbName = (process.env.MONGO_USER_DB ?? "user").trim() || "user";
  const userDb = mongoose.connection.useDb(dbName, { useCache: true });
  return (
    (userDb.models.User as Model<User> | undefined) ??
    userDb.model<User>("User", UserSchema, "users")
  );
}

/** 화면·API 응답에 실어 보내는 공개 회원 정보 */
export type PublicUser = {
  userId: string;
  nickname: string;
  email: string | null;
  profileImage: string | null;
};

export function toPublicUser(u: UserDocument): PublicUser {
  return {
    userId: u.userId ?? "",
    nickname: u.nickname ?? u.name ?? "이름없음",
    email: u.email ?? null,
    profileImage: u.profileImage ?? null,
  };
}
