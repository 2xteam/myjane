import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { adminError, requireAdmin } from "@/lib/adminAuth";
import { latestRelease, loadSettings, playSummary, publicSettings, sweepLost } from "@/lib/igTidy";
import { getIgAccountModel, getIgAiLogModel, getIgPermModel, getIgPlayModel, getIgRequestModel, getIgStateModel } from "@/models/IgTidy";
import { startOfTodayKst } from "@/lib/igTidy";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

/**
 * IG Tidy 관리 화면 첫 장 — 한 번에 그린다.
 *
 *   waiting  아직 허용 안 된 사람 — **앱에서 로그인해 기다리는 사람**(가입 출처 무관) +
 *            ig-tidy 로 가입한 사람. 요청이 최근인 순
 *   members  허용된 사람 · 인스타그램 아이디 · 마지막 실행 · 저장된 기록 크기
 *   live     지금 실행 중
 *
 * IG Tidy 데이터는 포털 자신의 것(`igtidy` DB)이라 앱 API 를 거치지 않고 직접 읽는다.
 */
const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : null);

export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    await connectDB();
    await sweepLost();
    const Users = getUserModel();
    const projection = { name: 1, nickname: 1, email: 1, signupFrom: 1, createdAt: 1, lastLoginAt: 1, igTidyAllowedAt: 1 };

    const requests = await getIgRequestModel().find({}).sort({ lastAt: -1 }).limit(200).lean().exec();
    const reqOf = new Map(requests.map((r) => [String(r.uid), r]));
    const [allowed, waiting, accounts, live, bytes, settings, release] = await Promise.all([
      Users.find({ igTidyAllowed: true }, projection).sort({ igTidyAllowedAt: -1 }).lean().exec(),
      Users.find(
        {
          igTidyAllowed: { $ne: true },
          withdrawnAt: null,
          $or: [{ signupFrom: "ig-tidy" }, { _id: { $in: requests.map((r) => r.uid) } }],
        },
        projection,
      ).limit(200).lean().exec(),
      getIgAccountModel().find({}).sort({ lastPlayAt: -1 }).lean().exec(),
      getIgPlayModel().find({ status: "running" }).sort({ startedAt: -1 }).lean().exec(),
      getIgStateModel().aggregate<{ _id: { uid: unknown; ig: string }; bytes: number; at: Date }>([
        { $group: { _id: { uid: "$uid", ig: "$igUsername" }, bytes: { $sum: "$bytes" }, at: { $max: "$updatedAt" } } },
      ]),
      loadSettings(),
      latestRelease(),
    ]);

    const [perms, aiToday] = await Promise.all([
      getIgPermModel().find({}).lean().exec(),
      getIgAiLogModel().aggregate<{ _id: unknown; n: number; tokens: number }>([
        { $match: { at: { $gte: startOfTodayKst() }, ok: true } },
        { $group: { _id: "$uid", n: { $sum: 1 }, tokens: { $sum: { $ifNull: ["$totalTokens", 0] } } } },
      ]),
    ]);
    const permOf = new Map(perms.map((p) => [String(p.uid), p]));
    const aiOf = new Map(aiToday.map((a) => [String(a._id), a]));

    const nameOf = new Map<string, string>();
    for (const u of [...allowed, ...waiting]) nameOf.set(String(u._id), u.nickname ?? u.name ?? u.email ?? "");
    const sizeOf = new Map(bytes.map((b) => [`${String(b._id.uid)}:${b._id.ig}`, { bytes: b.bytes, at: iso(b.at) }]));

    const accountsOf = new Map<string, Array<Record<string, unknown>>>();
    for (const a of accounts) {
      const k = String(a.uid);
      const list = accountsOf.get(k) ?? [];
      const size = sizeOf.get(`${k}:${a.igUsername}`);
      list.push({
        igUsername: a.igUsername,
        addedAt: iso(a.addedAt),
        lastPlayAt: iso(a.lastPlayAt),
        removed: !!a.removedAt,
        savedBytes: size?.bytes ?? 0,
        savedAt: size?.at ?? null,
      });
      accountsOf.set(k, list);
    }

    return NextResponse.json({
      ok: true,
      settings: publicSettings(settings),
      release,
      waiting: waiting
        .map((u) => {
          const r = reqOf.get(String(u._id));
          return {
            id: String(u._id), name: u.nickname ?? u.name ?? "", email: u.email ?? null, createdAt: iso(u.createdAt),
            signupFrom: u.signupFrom ?? null,
            requestedAt: iso(r?.lastAt), firstRequestedAt: iso(r?.firstAt),
            deviceName: (r?.deviceName as string) ?? "",
          };
        })
        .sort((a, b) => String(b.requestedAt ?? b.createdAt).localeCompare(String(a.requestedAt ?? a.createdAt))),
      members: allowed.map((u) => ({
        id: String(u._id),
        name: u.nickname ?? u.name ?? "",
        email: u.email ?? null,
        allowedAt: iso(u.igTidyAllowedAt),
        lastLoginAt: iso(u.lastLoginAt),
        accounts: accountsOf.get(String(u._id)) ?? [],
        aiComment: permOf.get(String(u._id))?.aiComment === true,
        aiRequestedAt: iso(permOf.get(String(u._id))?.aiRequestedAt),
        aiToday: aiOf.get(String(u._id))?.n ?? 0,
        aiTokensToday: aiOf.get(String(u._id))?.tokens ?? 0,
      })),
      live: live.map((p) => ({ ...playSummary(p), uid: String(p.uid), member: nameOf.get(String(p.uid)) ?? "" })),
    });
  } catch (err) {
    return adminError(err);
  }
}
