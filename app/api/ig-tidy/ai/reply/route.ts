import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { aiQuota, igError, loadSettings, normalizeIg, publicSettings, requireIgTidyUser } from "@/lib/igTidy";
import { generateIgReply, langOf, replyPrecheck, styleIdOf } from "@/lib/igTidyAi";
import { getIgAccountModel, getIgAiLogModel, getIgPermModel } from "@/models/IgTidy";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * AI 답글 하나 만들기 — IG Tidy 앱이 **내 글**에 달린 남의 댓글마다 부른다(2026-11-08).
 *
 * 본문: `{ igUsername, style, lang, tone, post: { caption, permalink }, comment: { author, text } }`
 * 응답: `{ ok, skip, reason, reply, quota }`
 *   reply 에는 @멘션이 없다 — 앱이 `@상대 ` 를 앞에 붙여 단다.
 *   skip 이면 reply 는 "" 이고 reason 에 까닭(스팸 · 태그만 · 내 댓글 …).
 *
 * 막는 것(code) — /api/ig-tidy/ai/comment 와 같다
 *   ai_disabled     관리자가 AI 를 전체로 꺼 둠
 *   account_taken   이 계정의 IG 아이디가 아님
 *   ai_cap          오늘 한도를 다 씀
 *
 * 비용은 글만 1단위(사진 없음). 기록은 ai_logs 에 kind "reply" 로 — target = 댓글 쓴 사람, inReplyTo = 그 댓글.
 * 내 댓글 · 빈 댓글 · 남을 태그만 한 댓글은 AI 를 부르지 않고 바로 건너뛴다(한도도 쓰지 않고 기록도 남기지 않는다).
 */
export async function POST(req: Request) {
  const auth = await requireIgTidyUser(req);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const body = (await req.json().catch(() => ({}))) as {
    igUsername?: unknown; tone?: unknown; style?: unknown; lang?: unknown;
    post?: { caption?: unknown; permalink?: unknown };
    comment?: { author?: unknown; text?: unknown };
  };
  const ig = normalizeIg(body.igUsername);
  const post = body.post ?? {};
  const comment = body.comment ?? {};
  const author = String(comment.author ?? "").trim().replace(/^@/, "").slice(0, 40);
  const text = String(comment.text ?? "").slice(0, 1000);
  if (!ig || !author) return igError("bad_request", "댓글 정보가 모자라요.", 400);

  await connectDB();
  const perm = await getIgPermModel().findOne({ uid: user._id }).lean().exec();
  const approved = !!(perm && perm.aiComment === true);
  const settings = publicSettings(await loadSettings());
  if (!settings.aiEnabled) return igError("ai_disabled", "관리자가 AI 댓글을 잠시 꺼 두었어요.", 503);

  const account = await getIgAccountModel().findOne({ igUsername: ig }).lean().exec();
  if (!account || String(account.uid) !== String(user._id)) {
    return igError("account_taken", `@${ig} 는 이 계정에 등록된 아이디가 아니에요.`, 409);
  }

  const quota = await aiQuota(user._id, approved, settings);
  const pre = replyPrecheck(text, author, ig);
  if (pre) return NextResponse.json({ ok: true, skip: true, reason: pre, reply: "", quota });

  if (quota.leftUnits < 1) {
    const msg = approved
      ? `오늘 AI 한도(사진 포함 ${quota.photoDaily}개 분)를 다 썼어요. 내일 다시 할 수 있어요.`
      : `오늘 무료 AI 한도(사진 포함 ${quota.photoDaily}개 분)를 다 썼어요. 관리자 승인을 받으면 하루 사진 포함 ${quota.approvedPhotoDaily}개까지 쓸 수 있어요.`;
    return igError("ai_cap", msg, 429, { quota, requested: !!(perm && perm.aiRequestedAt) });
  }

  const base = {
    uid: user._id, igUsername: ig, target: author, kind: "reply", inReplyTo: text.slice(0, 300),
    permalink: String(post.permalink ?? "").slice(0, 200), withImage: false,
    style: styleIdOf(body.style),
  };
  // 맞춤 — 이 IG 계정에 저장된 지침을 쓴다. 지침이 없으면 기본으로(댓글과 같다)
  const customGuide = base.style === "custom" ? String((account as { customStyleGuide?: string }).customStyleGuide ?? "").trim() : "";
  if (base.style === "custom" && !customGuide) base.style = "basic";
  const Logs = getIgAiLogModel();
  const t0 = Date.now();
  try {
    const r = await generateIgReply({
      owner: ig,
      caption: String(post.caption ?? ""),
      commentAuthor: author,
      commentText: text,
      tone: typeof body.tone === "string" ? body.tone : "",
      style: base.style,
      customGuide: customGuide || undefined,
      fallbackLang: langOf(body.lang),
    });
    await Logs.create({
      ...base, model: r.model, promptTokens: r.usage.prompt, completionTokens: r.usage.completion,
      totalTokens: r.usage.total, ms: Date.now() - t0, ok: true, skip: r.skip, comment: r.reply, reason: r.reason,
    });
    const after = { ...quota, usedUnits: quota.usedUnits + 1, leftUnits: Math.max(0, quota.leftUnits - 1) };
    return NextResponse.json({ ok: true, skip: r.skip, reason: r.reason, reply: r.reply, quota: after });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    await Logs.create({ ...base, ms: Date.now() - t0, ok: false, error: message.slice(0, 300) }).catch(() => {});
    return NextResponse.json({ ok: false, code: "ai_failed", error: `AI 가 답글을 만들지 못했어요: ${message}` }, { status: 502 });
  }
}
