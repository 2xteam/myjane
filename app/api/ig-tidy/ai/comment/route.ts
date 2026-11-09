import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { aiQuota, igError, loadSettings, normalizeIg, publicSettings, requireIgTidyUser } from "@/lib/igTidy";
import { captionWeight, cleanPeerComments, freePhotoModel, freeTextModel, generateIgComment, langOf, matchSkipWord, photoModel, recentAiTexts, styleIdOf } from "@/lib/igTidyAi";
import { noteFreeTokens, photoFitsFree, textFitsFree } from "@/lib/igTidyFree";
import { getIgAccountModel, getIgAiLogModel, getIgPermModel } from "@/models/IgTidy";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * AI 댓글 하나 만들기 — IG Tidy 앱의 「AI 피드 댓글」 이 글마다 부른다.
 *
 * 본문: `{ igUsername, post: { author, caption, imageAlt, imageDataUrl, permalink }, tone }`
 * 응답: `{ ok, skip, reason, comment, photoDropped, quota }` — quota 는 앱 AI댓글 대시보드가 그린다
 *
 * 막는 것(code)
 *   ai_disabled     관리자가 AI 댓글을 전체로 꺼 둠
 *   ai_cap          오늘 한도를 다 씀 — 승인 전이면 「관리자 승인을 받으면 …」 과 요청 버튼
 *
 * 승인 전(무료)에도 쓴다. 승인(igtidy.perms.aiComment)은 **한도를 올리는 것**이다(2026-11-07).
 * 사용량은 단위 — 글만 1 · 사진 포함 aiPhotoWeight → lib/igTidy.ts aiQuota
 *
 * 만든 문구는 기록(ai_logs)에 남는다. 게시는 앱이 한다 — 서버는 만들기만 한다.
 *
 * 원가 줄이기(2026-11-08)
 *   · 건너뛸 키워드(기본: 부고 · 조문)가 든 글은 AI 를 부르지 않고 건너뛴다 — skipCondolence(기본 켜짐) · skipWords. 한도도 쓰지 않는다
 *   · 본문이 aiPhotoMaxCaption 글자보다 길면 사진을 빼고 글만으로 만든다(사진 몫 대신 글 몫만 센다)
 *   · 사진 — 하루 무료 토큰이 남았으면 gpt-5.4-nano(무료), 다 쓰면 gpt-6-luna(lib/igTidyFree.ts)
 *   · 글만 — 무료 토큰이 남았으면 gpt-5.4-mini, 다 쓰면 gpt-4o-mini(2026-11-09)
 *     실패하면 사진 없이 기본 모델로 한 번 더
 */
const MAX_IMAGE = 1_500_000;   // data URL 길이(약 1.1MB 사진)

export async function POST(req: Request) {
  const auth = await requireIgTidyUser(req);
  if ("error" in auth) return auth.error;
  const user = auth.user;

  const body = (await req.json().catch(() => ({}))) as {
    igUsername?: unknown; tone?: unknown; style?: unknown; lang?: unknown; skipCondolence?: unknown; skipWords?: unknown;
    post?: { author?: unknown; caption?: unknown; imageAlt?: unknown; imageDataUrl?: unknown; permalink?: unknown; comments?: unknown };
    /** 앱이 함께 보내는 참고 자료(2026-11-09~) — 새 칸이 생겨도 앱 업데이트 없이 넘어오게 덩어리째 받는다 */
    context?: { comments?: unknown };
  };
  const ig = normalizeIg(body.igUsername);
  const post = body.post ?? {};
  const author = String(post.author ?? "").slice(0, 40);
  if (!ig || !author) return igError("bad_request", "글 정보가 모자라요.", 400);

  await connectDB();
  const perm = await getIgPermModel().findOne({ uid: user._id }).lean().exec();
  const approved = !!(perm && perm.aiComment === true);
  const settings = publicSettings(await loadSettings());
  if (!settings.aiEnabled) return igError("ai_disabled", "관리자가 AI 댓글을 잠시 꺼 두었어요.", 503);

  const account = await getIgAccountModel().findOne({ igUsername: ig }).lean().exec();
  if (!account || String(account.uid) !== String(user._id)) {
    return igError("account_taken", `@${ig} 는 이 계정에 등록된 아이디가 아니에요.`, 409);
  }

  const caption = String(post.caption ?? "");
  const Logs0 = getIgAiLogModel();
  const rawComments = body.context?.comments ?? post.comments;
  if (Array.isArray(rawComments) && rawComments.some((x) => String((x as { user?: unknown })?.user ?? "").toLowerCase() === ig)) {
    return NextResponse.json({ ok: true, skip: true, reason: "이미 내 댓글이 있는 글", comment: "", photoDropped: false, photoSkipped: "", quota: await aiQuota(user._id, approved, settings) });
  }
  const peers = cleanPeerComments(rawComments, ig);
  // 건너뛸 키워드(기본 부고 · 조문) — AI 없이 바로 건너뛴다(원가 · 한도 0). 기록은 남겨 대시보드 「건너뜀」 에 센다
  const hit = body.skipCondolence !== false ? matchSkipWord(caption, body.skipWords) : "";
  if (hit) {
    const reason = `건너뛸 키워드 「${hit}」 가 든 글`;
    await Logs0.create({
      uid: user._id, igUsername: ig, target: author, permalink: String(post.permalink ?? "").slice(0, 200),
      withImage: false, units: 0, style: styleIdOf(body.style), model: "", ok: true, skip: true, reason, comment: "", ms: 0,
    }).catch(() => {});
    return NextResponse.json({ ok: true, skip: true, reason, comment: "", photoDropped: false, photoSkipped: "", quota: await aiQuota(user._id, approved, settings) });
  }

  /* 한도 — 승인 전에도 무료로 쓴다. 사진 몫(weight)이 모자라고 글 몫(1)은 남으면
     사진을 빼고 글만으로 만든다(남은 한도를 끝까지 쓸 수 있게). */
  const Logs = getIgAiLogModel();
  const quota = await aiQuota(user._id, approved, settings);
  let imageDataUrl = typeof post.imageDataUrl === "string" && post.imageDataUrl.length <= MAX_IMAGE ? post.imageDataUrl : undefined;
  let photoDropped = false;
  if (imageDataUrl && quota.leftUnits < quota.weight) { imageDataUrl = undefined; photoDropped = true; }
  // 글이 길면 사진 없이 — 본문만으로 충분하다(0 이면 늘 사진을 쓴다)
  let photoSkipped = "";
  if (imageDataUrl && settings.aiPhotoMaxCaption > 0 && captionWeight(caption) > settings.aiPhotoMaxCaption) {
    imageDataUrl = undefined; photoSkipped = "long";
  }
  if (quota.leftUnits < 1) {
    const msg = approved
      ? `오늘 AI 댓글 한도(사진 포함 ${quota.photoDaily}개 분)를 다 썼어요. 내일 다시 할 수 있어요.`
      : `오늘 무료 AI 댓글(사진 포함 ${quota.photoDaily}개 분)을 다 썼어요. 관리자 승인을 받으면 하루 사진 포함 ${quota.approvedPhotoDaily}개까지 쓸 수 있어요.`;
    return igError("ai_cap", msg, 429, { quota, requested: !!(perm && perm.aiRequestedAt) });
  }

  const base = {
    uid: user._id, igUsername: ig, target: author,
    permalink: String(post.permalink ?? "").slice(0, 200), withImage: !!imageDataUrl,
    style: styleIdOf(body.style),
  };
  // 맞춤 — 이 IG 계정에 저장된 지침을 쓴다. 지침이 없으면 기본으로
  const customGuide = base.style === "custom" ? String((account as { customStyleGuide?: string }).customStyleGuide ?? "").trim() : "";
  if (base.style === "custom" && !customGuide) base.style = "basic";
  const t0 = Date.now();
  try {
    const input = {
      author,
      caption,
      imageAlt: typeof post.imageAlt === "string" ? post.imageAlt : undefined,
      imageDataUrl,
      tone: typeof body.tone === "string" ? body.tone : "",
      style: base.style,
      customGuide: customGuide || undefined,
      fallbackLang: langOf(body.lang),
      photoModel: imageDataUrl ? ((await photoFitsFree()) ? freePhotoModel() : photoModel()) : undefined,
      textModel: imageDataUrl ? undefined : ((await textFitsFree()) ? freeTextModel() : undefined),
      comments: peers,
      recent: await recentAiTexts(ig),
    };
    let r;
    try {
      r = await generateIgComment(input);
    } catch (photoErr) {
      if (!imageDataUrl) throw photoErr;
      // 사진 모델이 실패하면(모델 중단 · 일시 오류) 사진 없이 기본 모델로 한 번 더 — 글 몫만 센다
      await Logs.create({ ...base, ms: Date.now() - t0, ok: false, error: `사진 모델 실패 — ${photoErr instanceof Error ? photoErr.message : ""}`.slice(0, 300) }).catch(() => {});
      imageDataUrl = undefined; base.withImage = false; photoSkipped = "error";
      r = await generateIgComment({ ...input, imageDataUrl: undefined });
    }
    noteFreeTokens(r.model, r.usage.total);
    await Logs.create({
      ...base, model: r.model, promptTokens: r.usage.prompt, completionTokens: r.usage.completion,
      totalTokens: r.usage.total, cachedTokens: r.usage.cached, ms: Date.now() - t0, ok: true, skip: r.skip, comment: r.comment, reason: r.reason,
    });
    const cost = imageDataUrl ? quota.weight : 1;
    const after = { ...quota, usedUnits: quota.usedUnits + cost, leftUnits: Math.max(0, quota.leftUnits - cost) };
    return NextResponse.json({
      ok: true, skip: r.skip, reason: r.reason, comment: r.comment, photoDropped, photoSkipped, quota: after,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    await Logs.create({ ...base, ms: Date.now() - t0, ok: false, error: message.slice(0, 300) }).catch(() => {});
    return NextResponse.json({ ok: false, code: "ai_failed", error: `AI 가 댓글을 만들지 못했어요: ${message}` }, { status: 502 });
  }
}
