import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * 관리자 감사 기록 — 지금은 **대리 로그인**(시작·연장·종료)만 남긴다 → lib/impersonation.ts
 *
 * 관리자가 고객 계정으로 들어가는 일은 되돌릴 수 없는 열람이다. 누가 언제 누구로
 * 들어가 얼마나 있었는지 나중에 확인할 수 있어야 한다. 지우지 않는다(TTL 없음).
 */
const AdminAuditLogSchema = new Schema(
  {
    action: {
      type: String,
      required: true,
      enum: ["impersonate.start", "impersonate.extend", "impersonate.end", "impersonate.expire"],
      index: true,
    },
    adminId: { type: Schema.Types.ObjectId, required: true, index: true },
    adminName: { type: String, default: "" },
    targetId: { type: Schema.Types.ObjectId, default: null, index: true },
    targetName: { type: String, default: "" },
    /** 이 동작 뒤의 대리 세션 만료 시각 */
    expiresAt: { type: Date, default: null },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    at: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);

export type AdminAuditLog = InferSchemaType<typeof AdminAuditLogSchema>;

/** `users` 와 같은 DB. 반드시 `connectDB()` 완료 후 호출 */
export function getAdminAuditLogModel(): Model<AdminAuditLog> {
  const dbName = (process.env.MONGO_USER_DB ?? "user").trim() || "user";
  const userDb = mongoose.connection.useDb(dbName, { useCache: true });
  return (
    (userDb.models.AdminAuditLog as Model<AdminAuditLog> | undefined) ??
    userDb.model<AdminAuditLog>("AdminAuditLog", AdminAuditLogSchema, "admin_audit_logs")
  );
}
