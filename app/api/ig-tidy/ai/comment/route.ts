import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { igError, loadSettings, normalizeIg, publicSettings, requireIgTidyUser, startOfTodayKst } from "@/lib/igTidy";
import { generateIgComment } from "@/lib/igTidyAi";
import { getIgAccountModel, getIgAiLogModel, getIgPermModel } from "@/models/IgTidy";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * AI 댓글 하나 만들기 — IG Tidy 앱의 「AI 피드 댓글」 이 글마다 부른다.
 *
 * 본문: `{ igUsername, post: { author, caption, imageAlt, imageDataUrl, permalink }, tone }`
 * 응답: `{ ok, skip, reason, comment, usedToday, cap }`
 *
 * 막는 것(code)
 *   ai_not_allowed  이 회원은 AI 댓글 허용 전 — 앱이 「관리자에게 요청하기」 를 보여 준다
 *   ai_disabled     관리자가 AI 댓글을 전체로 꺼 둠
 *   ai_cap          이 인스타그램 아이디의 오늘 만들기 상한에 닿음
 *
 * 만든 문구는 기록(ai_logs)에 남는다. 게시는 앱이 한다 — 서버는 만들기만 한다.
 */
const MAX_IMAGE = 1_500_000;   // data URL 길이(약 1.1MB 사진)

export async function POST(req: Request) {
  const auth = await requireIgTidyUser(req);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const body = (await req.json().catch(() => ({}))) as {
    igUsername?: unknown; tone?: unknown;
    post?: { author?: unknown; caption?: unknown; imageAlt?: unknown; imageDataUrl?: unknown; permalink?: unknown };
  };
  const ig = normalizeIg(body.igUsername);
  const post = body.post ?? {};
  const author = String(post.author ?? "").slice(0, 40);
  if (!ig || !author) return igError("bad_request", "글 정보가 모자라요.", 400);

  await connectDB();
  const perm = await getIgPermModel().findOne({ uid: user._id }).lean().exec();
  if (!perm || perm.aiComment !== true) {
    return igError("ai_not_allowed", "AI 댓글은 관리자 허용이 필요해요. 관리자에게 요청해 주세요.", 403, {
      requested: !!(perm && perm.aiRequestedAt),
    });
  }
  const settings = publicSettings(await loadSettings());
  if (!settings.aiEnabled) return igError("ai_disabled", "관리자가 AI 댓글을 잠시 꺼 두었어요.", 503);

  const account = await getIgAccountModel().findOne({ igUsername: ig }).lean().exec();
  if (!account || String(account.uid) !== String(user._id)) {
    return igError("account_taken", `@${ig} 는 이 계정에 등록된 아이디가 아니에요.`, 409);
  }

  const Logs = getIgAiLogModel();
  const usedToday = await Logs.countDocuments({ uid: user._id, igUsername: ig, at: { $gte: startOfTodayKst() }, ok: true }).exec();
  if (settings.aiDailyCap && usedToday >= settings.aiDailyCap) {
    return igError("ai_cap", `오늘 AI 댓글 ${settings.aiDailyCap}개를 다 만들었어요. 내일 다시 할 수 있어요.`, 429, {
      usedToday, cap: settings.aiDailyCap,
    });
  }

  const imageDataUrl = typeof post.imageDataUrl === "string" && post.imageDataUrl.length <= MAX_IMAGE ? post.imageDataUrl : undefined;
  const base = {
    uid: user._id, igUsername: ig, target: author,
    permalink: String(post.permalink ?? "").slice(0, 200), withImage: !!imageDataUrl,
  };
  const t0 = Date.now();
  try {
    const r = await generateIgComment({
      author,
      caption: String(post.caption ?? ""),
      imageAlt: typeof post.imageAlt === "string" ? post.imageAlt : undefined,
      imageDataUrl,
      tone: typeof body.tone === "string" ? body.tone : "",
    });
    await Logs.create({
      ...base, model: r.model, promptTokens: r.usage.prompt, completionTokens: r.usage.completion,
      totalTokens: r.usage.total, ms: Date.now() - t0, ok: true, skip: r.skip, comment: r.comment, reason: r.reason,
    });
    return NextResponse.json({
      ok: true, skip: r.skip, reason: r.reason, comment: r.comment,
      usedToday: usedToday + 1, cap: settings.aiDailyCap,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    await Logs.create({ ...base, ms: Date.now() - t0, ok: false, error: message.slice(0, 300) }).catch(() => {});
    return NextResponse.json({ ok: false, code: "ai_failed", error: `AI 가 댓글을 만들지 못했어요: ${message}` }, { status: 502 });
  }
}
