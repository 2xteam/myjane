import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * 로그인 실패 횟수.
 *
 * Vercel 함수는 호출마다 다른 인스턴스에서 돌 수 있어 **메모리에 세면 소용이 없다.**
 * 그래서 회원과 같은 `user` DB 에 컬렉션 하나를 두고 센다. 창이 닫히면 TTL 이 지운다
 * (`expiresAt` 기준, 만료 즉시).
 *
 * `key` 는 `id:<식별자>` 또는 `ip:<주소>` 다. 식별자는 소문자 이메일 또는 숫자만 남긴
 * 전화번호. 존재하지 않는 계정도 같은 규칙으로 센다 — 있는 계정만 세면 응답 차이로
 * 계정 존재를 알 수 있다.
 *
 * → my-obsidian-vault / 50-Plans/E 개인정보 보호 보강.md 4번
 */
const LoginAttemptSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, required: true, default: 0 },
    firstAt: { type: Date, required: true, default: Date.now },
    /** 이 시각이 지나면 TTL 이 문서를 지운다 = 창이 다시 열린다 */
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

LoginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type LoginAttempt = InferSchemaType<typeof LoginAttemptSchema>;

/** `users` 와 같은 DB. 반드시 `connectDB()` 완료 후 호출 */
export function getLoginAttemptModel(): Model<LoginAttempt> {
  const dbName = (process.env.MONGO_USER_DB ?? "user").trim() || "user";
  const userDb = mongoose.connection.useDb(dbName, { useCache: true });
  return (
    (userDb.models.LoginAttempt as Model<LoginAttempt> | undefined) ??
    userDb.model<LoginAttempt>("LoginAttempt", LoginAttemptSchema, "login_attempts")
  );
}
