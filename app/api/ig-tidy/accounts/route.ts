import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { igError, normalizeIg, requireIgTidyUser, todayUsage } from "@/lib/igTidy";
import { getIgAccountModel, getIgStateModel } from "@/models/IgTidy";

export const runtime = "nodejs";

/**
 * 인스타그램 아이디를 내 것으로 등록한다(이미 내 것이면 그대로).
 *
 * 앱이 인스타그램에 로그인된 아이디를 읽을 때마다 부른다. 처음 보는 아이디면 새로 더하고
 * `added: true` 를 돌려준다 — 앱이 「새 아이디 ○○를 추가했어요」 를 띄운다.
 *
 * 한 아이디는 한 회원에게만 묶인다. 다른 회원이 이미 쓰는 아이디면 409 account_taken.
 * 응답에 그 아이디의 저장된 기록 목록(키·크기·시각)과 오늘 사용량을 함께 준다 —
 * 다른 PC 에서 처음 열었을 때 「기록을 가져올까요?」 를 바로 물을 수 있게.
 */
export async function POST(req: Request) {
  const auth = await requireIgTidyUser(req);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const body = (await req.json().catch(() => ({}))) as { igUsername?: unknown };
  const ig = normalizeIg(body.igUsername);
  if (!ig) return igError("bad_request", "인스타그램 아이디 모양이 아니에요.", 400);

  await connectDB();
  const Accounts = getIgAccountModel();
  const existing = await Accounts.findOne({ igUsername: ig }).lean().exec();

  if (existing && String(existing.uid) !== String(user._id)) {
    return igError(
      "account_taken",
      `@${ig} 는 다른 myjane 계정에 이미 등록돼 있어요. 본인 아이디가 맞다면 관리자에게 알려 주세요.`,
      409,
    );
  }

  let added = false;
  if (!existing) {
    try {
      await Accounts.create({ uid: user._id, igUsername: ig });
      added = true;
    } catch (err) {
      // 같은 순간에 두 번 불렸다 — 유일 인덱스가 하나만 남긴다
      const again = await Accounts.findOne({ igUsername: ig }).lean().exec();
      if (!again || String(again.uid) !== String(user._id)) throw err;
    }
  } else if (existing.removedAt) {
    await Accounts.updateOne({ _id: existing._id }, { $set: { removedAt: null } }).exec();
    added = true;
  }

  const [states, usage] = await Promise.all([
    getIgStateModel().find({ uid: user._id, igUsername: ig }, { key: 1, bytes: 1, updatedAt: 1, deviceId: 1 }).lean().exec(),
    todayUsage(user._id, ig),
  ]);

  return NextResponse.json({
    ok: true,
    igUsername: ig,
    added,
    saved: states.map((s) => ({
      key: s.key,
      bytes: s.bytes ?? 0,
      updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : null,
      deviceId: s.deviceId ?? "",
    })),
    todayUsage: usage,
  });
}
