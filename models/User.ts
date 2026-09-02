import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    pin: { type: String, required: true },
    tokens: { type: Number, default: 0 },
    pinResetToken: { type: String },
    pinResetExpires: { type: Date },
    createdAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date },

    /** 어느 앱에서 가입했는지 (통합 로그인에서 기록) */
    signupFrom: { type: String, default: null },

    /** FitLog 전용 신체 프로필 — 다른 앱은 사용하지 않는다 */
    heightCm: { type: Number, default: null },
    gender: { type: String, enum: ["male", "female", null], default: null },
    birthYear: { type: Number, default: null },
  },
  { versionKey: false },
);

UserSchema.index({ phone: 1, name: 1 });
UserSchema.index({ email: 1 });

export type UserDocument = InferSchemaType<typeof UserSchema> & {
  _id: mongoose.Types.ObjectId;
};

/**
 * `users` 컬렉션은 URI 기본 DB(`/vocab` 등)가 아닌 `MONGO_USER_DB`(기본 `user`) DB에 둡니다.
 * 반드시 `connectDB()` 완료 후 호출하세요.
 */
export function getUserModel(): Model<UserDocument> {
  const dbName = (process.env.MONGO_USER_DB ?? "user").trim() || "user";
  const userDb = mongoose.connection.useDb(dbName, { useCache: true });
  return (
    (userDb.models.User as Model<UserDocument> | undefined) ??
    userDb.model<UserDocument>("User", UserSchema, "users")
  );
}
