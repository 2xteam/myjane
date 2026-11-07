import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { aiQuota, igError, loadSettings, normalizeIg, publicSettings, requireIgTidyUser } from "@/lib/igTidy";
import { analyzeIgStyle, type StyleSample } from "@/lib/igTidyAi";
import { getIgAccountModel, getIgAiLogModel, getIgPermModel } from "@/models/IgTidy";

export const runtime = "nodejs";
export const maxDuration = 45;

/**
 * 「맞춤」 댓글 스타일 — IG Tidy 앱 AI댓글 탭의 「내 스타일 분석」 (2026-11-07).
 *
 *   GET  ?ig=<아이디>                          저장된 지침 { guide, summary, posts, comments, at }
 *   POST { igUsername, samples:[{caption, comments[]}] }   분석해 지침을 만들고 저장 — 단위 STYLE_UNITS 를 쓴다
 *   PUT  { igUsername, guide }                 사용자가 고친 지침 저장(AI 를 부르지 않는다 · 비우면 지운다)
 *
 * 앱이 내 프로필 글을 차례로 읽고 **내가 단 댓글 · 답글**만 골라 보낸다(인스타그램에는 아무것도 쓰지 않는다).
 * 지침은 그 IG 계정(igtidy.accounts)에 붙는다 — 다른 PC 에서도 같은 지침을 쓴다.
 * 허용 · 계정 주인 확인은 /api/ig-tidy/ai/comment 와 같다.
 */
const STYLE_UNITS = 5;   // 분석 한 번 = 글만 댓글 5개 분(입력이 길다)
const MAX_SAMPLES = 200;

async function ownAccount(uid: unknown, ig: string) {
  const account = await getIgAccountModel().findOne({ igUsername: ig }).lean().exec();
  if (!account || String(account.uid) !== String(uid)) return null;
  return account as typeof account & {
    customStyleGuide?: string; customStyleSummary?: string; customStylePosts?: number; customStyleComments?: number; customStyleAt?: Date | null;
  };
}

const view = (a: Awaited<ReturnType<typeof ownAccount>>) => ({
  guide: a?.customStyleGuide ?? "",
  summary: a?.customStyleSummary ?? "",
  posts: a?.customStylePosts ?? 0,
  comments: a?.customStyleComments ?? 0,
  at: a?.customStyleAt instanceof Date ? a.customStyleAt.toISOString() : null,
});

export async function GET(req: Request) {
  const auth = await requireIgTidyUser(req);
  if ("error" in auth) return auth.error;
  const ig = normalizeIg(new URL(req.url).searchParams.get("ig"));
  if (!ig) return igError("bad_request", "인스타그램 아이디가 필요해요.", 400);
  await connectDB();
  const account = await ownAccount(auth.user._id, ig);
  if (!account) return igError("account_taken", `@${ig} 는 이 계정에 등록된 아이디가 아니에요.`, 409);
  return NextResponse.json({ ok: true, style: view(account) });
}

export async function PUT(req: Request) {
  const auth = await requireIgTidyUser(req);
  if ("error" in auth) return auth.error;
  const body = (await req.json().catch(() => ({}))) as { igUsername?: unknown; guide?: unknown };
  const ig = normalizeIg(body.igUsername);
  if (!ig) return igError("bad_request", "인스타그램 아이디가 필요해요.", 400);
  await connectDB();
  const account = await ownAccount(auth.user._id, ig);
  if (!account) return igError("account_taken", `@${ig} 는 이 계정에 등록된 아이디가 아니에요.`, 409);
  const guide = String(body.guide ?? "").trim().slice(0, 1500);
  await getIgAccountModel().updateOne(
    { _id: account._id },
    guide ? { $set: { customStyleGuide: guide, customStyleAt: new Date() } }
      : { $set: { customStyleGuide: "", customStyleSummary: "", customStylePosts: 0, customStyleComments: 0, customStyleAt: null } },
  ).exec();
  return NextResponse.json({ ok: true, style: view(await ownAccount(auth.user._id, ig)) });
}

export async function POST(req: Request) {
  const auth = await requireIgTidyUser(req);
  if ("error" in auth) return auth.error;
  const user = auth.user;
  const body = (await req.json().catch(() => ({}))) as { igUsername?: unknown; samples?: unknown };
  const ig = normalizeIg(body.igUsername);
  if (!ig) return igError("bad_request", "인스타그램 아이디가 필요해요.", 400);

  const samples: StyleSample[] = (Array.isArray(body.samples) ? body.samples : []).slice(0, MAX_SAMPLES).map((x) => {
    const o = (x ?? {}) as { caption?: unknown; comments?: unknown };
    return {
      caption: String(o.caption ?? "").slice(0, 1000),
      comments: (Array.isArray(o.comments) ? o.comments : []).slice(0, 30).map((c) => String(c ?? "").slice(0, 500)).filter(Boolean),
    };
  });
  const commentCount = samples.reduce((n, p) => n + p.comments.length, 0);
  if (!samples.length) return igError("bad_request", "분석할 글이 없어요.", 400);
  if (commentCount < 1) {
    return igError("bad_request", "내가 단 댓글을 하나도 찾지 못했어요. 내 글에 답글을 단 적이 있으면 개수를 늘려 다시 해 보세요.", 400);
  }

  await connectDB();
  const perm = await getIgPermModel().findOne({ uid: user._id }).lean().exec();
  const approved = !!(perm && perm.aiComment === true);
  const settings = publicSettings(await loadSettings());
  if (!settings.aiEnabled) return igError("ai_disabled", "관리자가 AI 댓글을 잠시 꺼 두었어요.", 503);
  const account = await ownAccount(user._id, ig);
  if (!account) return igError("account_taken", `@${ig} 는 이 계정에 등록된 아이디가 아니에요.`, 409);

  const quota = await aiQuota(user._id, approved, settings);
  if (quota.leftUnits < STYLE_UNITS) {
    return igError("ai_cap", `오늘 남은 AI 한도가 모자라요(분석에 글만 댓글 ${STYLE_UNITS}개 분이 들어요). 내일 다시 해 주세요.`, 429, { quota });
  }

  const Logs = getIgAiLogModel();
  const base = { uid: user._id, igUsername: ig, target: ig, style: "analyze", withImage: false, units: STYLE_UNITS };
  const t0 = Date.now();
  try {
    const r = await analyzeIgStyle({ igUsername: ig, samples });
    await Logs.create({
      ...base, model: r.model, promptTokens: r.usage.prompt, completionTokens: r.usage.completion, totalTokens: r.usage.total,
      ms: Date.now() - t0, ok: true, comment: r.guide.slice(0, 500), reason: `글 ${samples.length} · 내 댓글 ${commentCount}`,
    });
    await getIgAccountModel().updateOne({ _id: account._id }, {
      $set: {
        customStyleGuide: r.guide, customStyleSummary: r.summary, customStylePosts: samples.length,
        customStyleComments: commentCount, customStyleAt: new Date(),
      },
    }).exec();
    const after = { ...quota, usedUnits: quota.usedUnits + STYLE_UNITS, leftUnits: Math.max(0, quota.leftUnits - STYLE_UNITS) };
    return NextResponse.json({ ok: true, style: view(await ownAccount(user._id, ig)), quota: after, units: STYLE_UNITS });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    await Logs.create({ ...base, ms: Date.now() - t0, ok: false, error: message.slice(0, 300) }).catch(() => {});
    return NextResponse.json({ ok: false, code: "ai_failed", error: `AI 가 지침을 만들지 못했어요: ${message}` }, { status: 502 });
  }
}
