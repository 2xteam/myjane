import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSessionUser } from "@/lib/serverSession";
import {
  aiQuota,
  compareVersion,
  igError,
  latestRelease,
  livePlay,
  loadSettings,
  noticeCompat,
  playSummary,
  publicSettings,
  sweepLost,
} from "@/lib/igTidy";
import { getIgAccountModel, getIgPermModel, getIgRequestModel } from "@/models/IgTidy";

export const runtime = "nodejs";

/**
 * IG Tidy 앱이 켜질 때 가장 먼저 부른다 — 이 한 번으로 어떤 화면을 보여 줄지 정한다.
 *
 *   로그인 안 됨     → 401 login_required        → 「myjane 계정으로 로그인」
 *   허용 전          → 200 allowed:false          → 「관리자 확인을 기다리고 있어요」
 *   업데이트 필요    → 200 updateRequired:true    → 「새 버전으로 업데이트해 주세요」
 *   다른 PC 에서 실행 → 200 live:{…}              → 「집 PC 에서 피드 좋아요 중」
 *
 * 허용 전이어도 401/403 이 아니라 200 으로 돌려준다. 앱은 "누구로 로그인했는지" 를
 * 보여 줘야 해서다(다른 계정으로 잘못 들어왔을 때 알아차릴 수 있게).
 *
 * `?v=1.2.3` — 앱 버전. 최소 버전보다 낮으면 updateRequired.
 */
export async function GET(req: Request) {
  const auth = await requireSessionUser(req);
  if ("error" in auth) {
    if (auth.error.status === 401) return igError("login_required", "myjane 계정으로 로그인해 주세요.", 401);
    return auth.error;
  }
  const user = auth.user;
  const version = new URL(req.url).searchParams.get("v") ?? "";

  try {
    await connectDB();
    const [settings, release] = await Promise.all([loadSettings(), latestRelease()]);
    /* 공지 — 예전 앱은 settings.notice · noticeAt 한 줄을 띠로 보여 준다. 게시판으로 옮긴 뒤(2026-11-08)에는
       그 두 칸을 가장 최근에 켜진 공지로 채운다. 새 앱은 /api/ig-tidy/notices 를 따로 읽는다 */
    const s = { ...publicSettings(settings), ...(await noticeCompat(settings)) };

    const base = {
      ok: true,
      user: {
        id: String(user._id),
        name: user.nickname ?? user.name ?? "",
        email: user.email ?? null,
        // myjane 관리자(master · operator) — 앱이 개발자 도구 메뉴를 이 사람에게만 보인다(2026-11-08)
        admin: ["master", "operator"].includes(String((user as { adminRole?: unknown }).adminRole ?? "")),
      },
      allowed: !!user.igTidyAllowed,
      settings: s,
      release,
      updateAvailable: !!(release && version && compareVersion(version, release.version) < 0),
      updateRequired: !!(version && compareVersion(version, s.minVersion) < 0),
    };
    if (!user.igTidyAllowed) {
      // 허용 요청으로 남긴다 — 관리 화면 「허용을 기다리는 사람」 에 가입 출처와 상관없이 나온다
      await getIgRequestModel()
        .updateOne(
          { uid: user._id },
          {
            $set: { lastAt: new Date(), deviceName: (req.headers.get("x-igt-device") ?? "").slice(0, 60), appVersion: version.slice(0, 20) },
            $setOnInsert: { uid: user._id, firstAt: new Date() },
          },
          { upsert: true },
        )
        .exec();
      return NextResponse.json(base);
    }

    await sweepLost({ uid: user._id });
    const [accounts, live, perm] = await Promise.all([
      getIgAccountModel().find({ uid: user._id, removedAt: null }).sort({ lastPlayAt: -1, addedAt: 1 }).lean().exec(),
      livePlay(user._id),
      getIgPermModel().findOne({ uid: user._id }).lean().exec(),
    ]);

    return NextResponse.json({
      ...base,
      accounts: accounts.map((a) => ({
        igUsername: a.igUsername,
        addedAt: a.addedAt instanceof Date ? a.addedAt.toISOString() : null,
        lastPlayAt: a.lastPlayAt instanceof Date ? a.lastPlayAt.toISOString() : null,
      })),
      live: live ? playSummary(live) : null,
      /** 기능별 허용 — 앱이 탭을 열지, 「관리자에게 요청하기」 를 보여 줄지 정한다 */
      features: {
        // 승인 전에도 무료로 쓴다 — 승인은 한도를 올린다
        aiComment: s.aiEnabled,
        aiCommentAllowed: !!(perm && perm.aiComment === true),
        aiRequested: !!(perm && perm.aiRequestedAt),
        aiQuota: await aiQuota(user._id, !!(perm && perm.aiComment === true), s),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ ok: false, error: `서버에서 확인하지 못했어요: ${message}` }, { status: 500 });
  }
}
