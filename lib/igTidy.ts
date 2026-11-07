import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import { requireSessionUser } from "@/lib/serverSession";
import type { UserDocument } from "@/models/User";
import {
  getIgPlayModel,
  getIgReleaseModel,
  getIgSettingsModel,
  type IgTidySettings,
} from "@/models/IgTidy";

/**
 * IG Tidy API 공용 — 누가 쓸 수 있는지, 실행 잠금, 버전 비교.
 * → my-obsidian-vault / 10-Projects/IG Tidy.md
 *
 * 앱에 돌려주는 모든 거절에는 **`code`** 를 붙인다. 앱은 문구가 아니라 code 를 보고
 * 알맞은 안내 화면(로그인 · 승인 대기 · 업데이트 · 다른 PC 에서 실행 중 …)을 고른다.
 */

/** 임대 길이. 앱은 60초마다 늘린다 — 두 번 놓치면 풀린다 */
export const LEASE_MS = 2 * 60 * 1000;

export type IgCode =
  | "login_required"
  | "not_allowed"
  | "withdrawn"
  | "disabled"
  | "update_required"
  | "busy_elsewhere"
  | "account_taken"
  | "play_gone"
  | "bad_request";

export function igError(code: IgCode, message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, code, error: message, ...extra }, { status });
}

/** 아이디 모양 — 인스타그램 규칙(영문·숫자·점·밑줄, 30자) */
export function normalizeIg(raw: unknown): string | null {
  const s = String(raw ?? "").trim().replace(/^@/, "").toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(s) ? s : null;
}

/**
 * 로그인 + 사용 허용까지 확인한다.
 *
 * `requireSessionUser` 가 서명 토큰 · 탈퇴 · 자녀 프로필 · **관리자 대리 로그인**을 이미 막는다.
 * 대리 로그인으로 고객의 인스타그램을 대신 돌리는 일은 없게 한다.
 */
export async function requireIgTidyUser(
  req: Request,
): Promise<{ user: UserDocument } | { error: NextResponse }> {
  const auth = await requireSessionUser(req);
  if ("error" in auth) {
    const status = auth.error.status;
    if (status === 401) {
      return { error: igError("login_required", "myjane 계정으로 로그인해 주세요.", 401) };
    }
    const body = (await auth.error.clone().json().catch(() => ({}))) as { error?: string; withdrawn?: boolean };
    return {
      error: igError(body.withdrawn ? "withdrawn" : "not_allowed", body.error ?? "이 계정으로는 쓸 수 없어요.", 403),
    };
  }
  if (!auth.user.igTidyAllowed) {
    return {
      error: igError(
        "not_allowed",
        "관리자 확인을 기다리고 있어요. 허용되면 바로 쓸 수 있어요.",
        403,
        { email: auth.user.email ?? null },
      ),
    };
  }
  return { user: auth.user };
}

/** 설정 문서. 없으면 기본값으로 만든다 */
export async function loadSettings(): Promise<IgTidySettings> {
  const Settings = getIgSettingsModel();
  const doc = await Settings.findOneAndUpdate(
    { _id: "main" },
    { $setOnInsert: { _id: "main" } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
    .lean()
    .exec();
  return doc as IgTidySettings;
}

/** "1.2.10" 과 "1.2.9" 를 숫자로 비교한다. a<b 면 음수 */
export function compareVersion(a: string, b: string): number {
  const pa = String(a || "0").split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b || "0").split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** 가장 최근에 올린 버전 */
export async function latestRelease() {
  const r = await getIgReleaseModel().findOne().sort({ publishedAt: -1 }).lean().exec();
  if (!r) return null;
  return {
    version: r.version,
    notes: r.notes ?? "",
    url: r.url ?? "",
    sha256: r.sha256 ?? "",
    size: r.size ?? 0,
    mandatory: !!r.mandatory,
    publishedAt: r.publishedAt instanceof Date ? r.publishedAt.toISOString() : null,
  };
}

/** 지금 살아 있는 실행(이 회원) — 임대가 안 지난 running */
export async function livePlay(uid: Types.ObjectId) {
  return getIgPlayModel()
    .findOne({ uid, status: "running", leaseUntil: { $gt: new Date() } })
    .sort({ startedAt: -1 })
    .lean()
    .exec();
}

/**
 * 임대가 지난 running 을 `lost` 로 닫는다. 앱이 죽었거나 네트워크가 끊긴 실행이다.
 * 목록·이력이 "실행 중" 으로 영영 남지 않게, 읽는 쪽에서 그때그때 정리한다.
 */
export async function sweepLost(filter: Record<string, unknown> = {}) {
  const now = new Date();
  await getIgPlayModel()
    .updateMany(
      { ...filter, status: "running", leaseUntil: { $lte: now } },
      [{ $set: { status: "lost", endedAt: "$leaseUntil", reason: "앱과 연결이 끊겨 기록을 닫았어요." } }],
    )
    .exec();
}

/** 한국 시각 기준 오늘 0시 */
export function startOfTodayKst(now = new Date()): Date {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  kst.setUTCHours(0, 0, 0, 0);
  return new Date(kst.getTime() - 9 * 3600 * 1000);
}

type Tally = Record<string, { ok?: number } | undefined>;

/**
 * 오늘(한국 시각) 이 인스타그램 아이디로 성공한 행동 수 — 기기를 가리지 않고 합친다.
 * 하루 상한은 인스타그램 아이디 단위다. 인스타그램이 그 단위로 막기 때문이다.
 */
export async function todayUsage(uid: Types.ObjectId, igUsername: string): Promise<Record<string, number>> {
  const plays = await getIgPlayModel()
    .find({ uid, igUsername, startedAt: { $gte: startOfTodayKst() } }, { tally: 1 })
    .lean()
    .exec();
  const sum: Record<string, number> = {};
  for (const p of plays) {
    for (const [action, c] of Object.entries((p.tally ?? {}) as Tally)) {
      sum[action] = (sum[action] ?? 0) + (Number(c?.ok) || 0);
    }
  }
  return sum;
}

/** 앱에 내려 주는 설정 모양 */
export function publicSettings(s: IgTidySettings) {
  return {
    enabled: s.enabled !== false,
    disabledMessage: s.disabledMessage || "",
    minVersion: s.minVersion || "0.0.0",
    dailyCaps: (s.dailyCaps ?? {}) as Record<string, number>,
    minDelaySec: Number(s.minDelaySec) || 0,
  };
}

/** 앱에 보여 줄 실행 요약 — 다른 PC 에서 돌고 있을 때 "무엇을 어디서" 를 알린다 */
export function playSummary(p: {
  _id: unknown; deviceId?: string; deviceName?: string; igUsername?: string; kind?: string;
  startedAt?: Date | null; lastBeatAt?: Date | null; tally?: unknown; status?: string;
}) {
  const tally = (p.tally ?? {}) as Tally;
  const done = Object.values(tally).reduce((s, c) => s + (Number(c?.ok) || 0), 0);
  return {
    id: String(p._id),
    deviceId: p.deviceId ?? "",
    deviceName: p.deviceName ?? "",
    igUsername: p.igUsername ?? "",
    kind: p.kind ?? "",
    status: p.status ?? "",
    startedAt: p.startedAt instanceof Date ? p.startedAt.toISOString() : null,
    lastBeatAt: p.lastBeatAt instanceof Date ? p.lastBeatAt.toISOString() : null,
    done,
  };
}
