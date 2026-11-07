import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { adminError, requireAdmin } from "@/lib/adminAuth";
import { getIgPermModel } from "@/models/IgTidy";

export const runtime = "nodejs";

/**
 * 기능별 허용 — 지금은 AI 댓글 하나. 운영자·마스터.
 * 본문: `{ uid, aiComment: boolean }`
 * 끄면 앱은 다음 글에서 「AI 댓글은 관리자 허용이 필요해요」 로 멈춘다.
 */
export async function PATCH(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  try {
    const b = (await req.json().catch(() => ({}))) as { uid?: unknown; aiComment?: unknown };
    const uid = String(b.uid ?? "");
    if (!Types.ObjectId.isValid(uid) || typeof b.aiComment !== "boolean") {
      return NextResponse.json({ ok: false, error: "uid 와 aiComment(true/false) 가 필요합니다." }, { status: 400 });
    }
    await connectDB();
    await getIgPermModel()
      .updateOne(
        { uid: new Types.ObjectId(uid) },
        {
          $set: {
            aiComment: b.aiComment,
            aiCommentAt: b.aiComment ? new Date() : null,
            aiCommentBy: b.aiComment ? auth.admin.doc._id : null,
            ...(b.aiComment ? { aiRequestedAt: null } : {}),
          },
          $setOnInsert: { uid: new Types.ObjectId(uid) },
        },
        { upsert: true },
      )
      .exec();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return adminError(err);
  }
}
