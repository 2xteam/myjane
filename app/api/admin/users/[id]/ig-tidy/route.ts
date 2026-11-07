import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { adminError, requireAdmin } from "@/lib/adminAuth";
import { getUserModel } from "@/models/User";
import { getIgRequestModel } from "@/models/IgTidy";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * IG Tidy 사용 허용을 켜고 끈다 — 운영자·마스터.
 *
 * 본문: `{ allowed: boolean }`
 *
 * 끄면 그 회원의 앱은 다음 연장(1분 안)에서 「사용 허용이 꺼졌어요」 로 멈춘다 —
 * 연장 API 가 매번 허용 여부를 다시 보기 때문이다(lib/igTidy.ts requireIgTidyUser).
 *
 * `findByIdAndUpdate` 로 이 칸만 바꾼다. 문서를 통째로 save 하면 다른 앱이 쓰는 칸을
 * 건드릴 수 있다.
 */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const body = (await req.json().catch(() => ({}))) as { allowed?: unknown };
    if (typeof body.allowed !== "boolean") {
      return NextResponse.json({ ok: false, error: "allowed 는 true 또는 false 여야 합니다." }, { status: 400 });
    }

    const { id } = await params;
    await connectDB();
    const updated = await getUserModel()
      .findByIdAndUpdate(
        id,
        {
          $set: {
            igTidyAllowed: body.allowed,
            igTidyAllowedAt: body.allowed ? new Date() : null,
            igTidyAllowedBy: body.allowed ? auth.admin.doc._id : null,
          },
        },
        { new: true, projection: { igTidyAllowed: 1, igTidyAllowedAt: 1 } },
      )
      .lean()
      .exec();
    if (!updated) {
      return NextResponse.json({ ok: false, error: "회원을 찾을 수 없습니다." }, { status: 404 });
    }

    // 허용했으면 요청은 끝났다
    if (body.allowed) await getIgRequestModel().deleteOne({ uid: updated._id }).exec();
    return NextResponse.json({ ok: true, igTidyAllowed: updated.igTidyAllowed === true });
  } catch (err) {
    return adminError(err);
  }
}
