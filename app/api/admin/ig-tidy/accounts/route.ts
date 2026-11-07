import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { adminError, requireAdmin } from "@/lib/adminAuth";
import { normalizeIg } from "@/lib/igTidy";
import { getIgAccountModel } from "@/models/IgTidy";

export const runtime = "nodejs";

/**
 * 인스타그램 아이디 관리 — 떼기 · 되붙이기 · 다른 회원으로 풀어 주기.
 *
 * 본문: `{ igUsername, action: "remove" | "restore" | "release" }`
 *
 *   remove   이 회원이 더는 쓰지 못하게(기록은 남는다)
 *   restore  되붙인다
 *   release  묶음을 지워 **다른 회원이 등록할 수 있게** 한다. 본인 아이디를 남이 먼저
 *            등록해 막혔을 때 쓴다. 기록(states · runlogs)은 지우지 않는다
 */
export async function PATCH(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const b = (await req.json().catch(() => ({}))) as { igUsername?: unknown; action?: unknown };
    const ig = normalizeIg(b.igUsername);
    if (!ig) return NextResponse.json({ ok: false, error: "아이디가 없습니다." }, { status: 400 });

    await connectDB();
    const Accounts = getIgAccountModel();
    if (b.action === "remove") {
      await Accounts.updateOne({ igUsername: ig }, { $set: { removedAt: new Date() } }).exec();
    } else if (b.action === "restore") {
      await Accounts.updateOne({ igUsername: ig }, { $set: { removedAt: null } }).exec();
    } else if (b.action === "release") {
      await Accounts.deleteOne({ igUsername: ig }).exec();
    } else {
      return NextResponse.json({ ok: false, error: "action 은 remove · restore · release 중 하나예요." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return adminError(err);
  }
}
