import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import {
  LEASE_MS,
  compareVersion,
  igError,
  livePlay,
  loadSettings,
  normalizeIg,
  playSummary,
  publicSettings,
  requireIgTidyUser,
  sweepLost,
  todayUsage,
} from "@/lib/igTidy";
import { getIgAccountModel, getIgPlayModel } from "@/models/IgTidy";

export const runtime = "nodejs";

const KINDS = new Set(["follow", "unfollow", "leavers", "mutual", "ratio", "like", "feed", "story", "refresh"]);

/**
 * 실행을 시작한다 — 「시작」 을 누를 때마다 한 번.
 *
 * 본문: `{ deviceId, deviceName, appVersion, igUsername, kind, opts, takeover? }`
 *
 * 막는 것(앱은 code 를 보고 안내 화면을 고른다)
 *   disabled         관리자가 잠시 멈춰 둠
 *   update_required  앱 버전이 최소 버전보다 낮음
 *   busy_elsewhere   **다른 PC 에서 실행 중** — 응답의 `live` 로 「집 PC 에서 14:02 부터 피드 좋아요」
 *
 * `takeover: true` 면 다른 PC 의 실행을 넘겨받는다. 그쪽은 다음 연장(1분 안)에서
 * 「다른 PC 에서 이어서 시작했어요」 로 멈춘다. 같은 PC 에서 남은 실행(앱을 껐다 켬)은 묻지 않고 닫는다.
 */
export async function POST(req: Request) {
  const auth = await requireIgTidyUser(req);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const body = (await req.json().catch(() => ({}))) as {
    deviceId?: unknown; deviceName?: unknown; appVersion?: unknown;
    igUsername?: unknown; kind?: unknown; opts?: unknown; takeover?: unknown;
  };
  const deviceId = String(body.deviceId ?? "").slice(0, 80);
  const ig = normalizeIg(body.igUsername);
  const kind = String(body.kind ?? "");
  if (!deviceId || !ig || !KINDS.has(kind)) {
    return igError("bad_request", "시작 정보가 모자라요. 앱을 다시 열어 주세요.", 400);
  }
  const appVersion = String(body.appVersion ?? "").slice(0, 20);

  await connectDB();
  const settings = publicSettings(await loadSettings());
  if (!settings.enabled) {
    return igError("disabled", settings.disabledMessage || "관리자가 잠시 멈춰 두었어요. 조금 뒤에 다시 시도해 주세요.", 503);
  }
  if (compareVersion(appVersion, settings.minVersion) < 0) {
    return igError("update_required", "새 버전으로 업데이트한 뒤에 시작할 수 있어요.", 426, {
      minVersion: settings.minVersion,
    });
  }

  const account = await getIgAccountModel().findOne({ igUsername: ig }).lean().exec();
  if (!account || String(account.uid) !== String(user._id) || account.removedAt) {
    return igError("account_taken", `@${ig} 는 이 계정에 등록된 인스타그램 아이디가 아니에요.`, 409);
  }

  const Plays = getIgPlayModel();
  await sweepLost({ uid: user._id });

  const live = await livePlay(user._id);
  if (live) {
    const sameDevice = live.deviceId === deviceId;
    if (!sameDevice && body.takeover !== true) {
      return igError("busy_elsewhere", "다른 곳에서 실행 중이에요.", 409, { live: playSummary(live) });
    }
    await Plays.updateOne(
      { _id: live._id, status: "running" },
      {
        $set: {
          status: sameDevice ? "stopped" : "taken_over",
          endedAt: new Date(),
          reason: sameDevice ? "같은 PC 에서 새로 시작했어요." : "다른 PC 에서 이어서 시작했어요.",
          stopRequest: sameDevice ? null : "다른 PC 에서 이어서 시작해 이쪽은 멈췄어요.",
        },
      },
    ).exec();
  }

  const now = new Date();
  try {
    const play = await Plays.create({
      uid: user._id,
      igUsername: ig,
      deviceId,
      deviceName: String(body.deviceName ?? "").slice(0, 60),
      appVersion,
      kind,
      opts: body.opts && typeof body.opts === "object" ? body.opts : {},
      status: "running",
      startedAt: now,
      lastBeatAt: now,
      leaseUntil: new Date(now.getTime() + LEASE_MS),
    });
    await getIgAccountModel().updateOne({ _id: account._id }, { $set: { lastPlayAt: now } }).exec();

    return NextResponse.json({
      ok: true,
      playId: String(play._id),
      leaseMs: LEASE_MS,
      beatMs: 60_000,
      settings,
      todayUsage: await todayUsage(user._id, ig),
      tookOver: !!(live && live.deviceId !== deviceId),
    });
  } catch (err) {
    // 같은 순간 다른 PC 가 먼저 시작했다 — 부분 유일 인덱스가 막았다
    if ((err as { code?: number }).code === 11000) {
      const other = await livePlay(user._id);
      return igError("busy_elsewhere", "방금 다른 곳에서 먼저 시작했어요.", 409, {
        live: other ? playSummary(other) : null,
      });
    }
    throw err;
  }
}
