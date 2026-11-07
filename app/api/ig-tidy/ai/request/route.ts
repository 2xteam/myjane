import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireIgTidyUser } from "@/lib/igTidy";
import { getIgPermModel } from "@/models/IgTidy";

export const runtime = "nodejs";

/**
 * 「관리자에게 요청하기」 — AI 댓글 허용을 요청한다.
 * 관리 화면 IG Tidy 의 허용된 사람 목록에 「AI 요청」 표시가 뜬다. 여러 번 눌러도 시각만 바뀐다.
 */
export async function POST(req: Request) {
  const auth = await requireIgTidyUser(req);
  if ("error" in auth) return auth.error;
  await connectDB();
  await getIgPermModel()
    .updateOne(
      { uid: auth.user._id },
      { $set: { aiRequestedAt: new Date() }, $setOnInsert: { uid: auth.user._id, aiComment: false } },
      { upsert: true },
    )
    .exec();
  return NextResponse.json({ ok: true });
}
