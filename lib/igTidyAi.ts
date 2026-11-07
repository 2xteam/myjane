import OpenAI from "openai";

/**
 * IG Tidy — AI 댓글 만들기 (2026-11-07).
 *
 * 피드 글(글쓴이 · 본문 · 사진)을 읽고 그 글에 어울리는 짧은 댓글 하나를 만든다.
 * 호출 방식은 SnapWord 와 같다 — OpenAI SDK · `OPENAI_API_KEY` · 모델 `OPENAI_MODEL`(기본 gpt-4o-mini)
 * → SnapWord/lib/llm.ts
 *
 * 지키는 것 → my-obsidian-vault / 30-Patterns/AI 채팅 패턴.md
 *   · 글에 없는 사실을 지어내지 않는다(기록 · 장소 · 관계를 넘겨짚지 않는다)
 *   · 상투적인 말과 홍보 · 링크 · 해시태그를 쓰지 않는다
 *   · 댓글을 달기 어색한 글(부고 · 사고 · 정치 · 광고 · 판매 · 내용 없음)은 **건너뛰라고** 답하게 한다
 * 정책(금지 사항)은 지침 **맨 뒤**에 둔다 — 앞에 두면 뒤의 말투 지시에 밀린다(볼트 기록).
 */

export type AiCommentInput = {
  author: string;
  caption: string;
  /** 인스타그램이 사진에 붙이는 설명(alt) — "사람 1명, 운동화 이미지일 수 있음" 같은 것 */
  imageAlt?: string;
  /** data:image/jpeg;base64,… — 앱이 받아서 줄여 보낸다. 없으면 글만 읽는다 */
  imageDataUrl?: string;
  /** 사용자가 정한 말투 · 계정 성격(예: "러닝 계정, 다정하게, 반말 금지") — 스타일 위에 덧붙는다 */
  tone?: string;
  /** 댓글 스타일 — basic · hip · lively · humor · custom. 모르는 값이면 basic */
  style?: string;
  /** style 이 custom 일 때 쓰는 맞춤 지침(서버가 계정에서 꺼내 넣는다). 비어 있으면 basic */
  customGuide?: string;
};

/**
 * 댓글 스타일 (2026-11-07 사용자 요청 — "기본이 너무 진지해 보인다").
 *
 * 예시는 **결을 보여 주려는 것**이지 베낄 문장이 아니다 — 지침에도 그렇게 적는다.
 * 예시를 그대로 따라 쓰면 모든 글에 같은 댓글이 달린다.
 * temperature 는 스타일마다 다르다. 유머·힙은 조금 더 흔들어야 매번 다른 말이 나온다.
 */
export const IG_COMMENT_STYLES = {
  basic: {
    label: "기본",
    temperature: 0.85,
    must: "글 속 구체적인 것 하나를 짚는 담백한 한 문장.",
    guide: `친구 글에 다는 것처럼 편하고 짧게. **감탄 한마디 + 글 속 구체적인 것 하나**면 충분해요.
**반드시 해요체**로 끝내요. 말끝은 가볍게("~네요", "~했다니!", "~예요 ㅎㅎ"). 15~35자.
평가하거나 축사처럼 들리는 말("멋진 성과", "훌륭한 노력", "대단하십니다", "인상적이에요")은 쓰지 않아요.
결 예시: "새벽 한강 달리기라니 부지런해요 ☺️" / "이 김밥 비주얼 반칙이에요 ㅎㅎ"`,
  },
  hip: {
    label: "힙한",
    temperature: 1.0,
    must: "요즘 감탄어 하나를 꼭 넣으세요(미쳤어요 · 찢었어요 · 실화예요 · 레전드예요 · 무드 · 갬성 · ㄷㄷ — 영어 글에 쓸 때만 insane · vibes · no way, 한국어 댓글에는 영어 감탄어를 쓰지 마세요). 인사말(축하드려요 · 좋으시겠어요)로 쓰지 마세요. 30자 안쪽.",
    guide: `요즘 인스타 감성으로 **툭 던지는 한 마디**. 8~25자, 문장 하나.
요즘 말 하나를 꼭 넣어요 — 미쳤다 · 찢었다 · 폼 미쳤다 · 무드 · 갬성 · 실화 · ㄷㄷ · 레전드 · 킹받네(좋은 뜻) 같은 것.
"축하드려요", "좋으시겠어요" 같은 인사말로 쓰지 말고 **요즘 감탄 한마디**로 시작해요. 끝만 존댓말("~요", "~네요"). 반말 · 명령조는 쓰지 않아요.
결 예시: "무드 미쳤어요… 🔥" / "페이스 실화예요? ㄷㄷ" / "폼 그냥 찢으셨네요 🖤"`,
  },
  lively: {
    label: "활기찬",
    temperature: 0.9,
    must: "느낌표 두 개 이상과 응원 한마디를 넣으세요.",
    guide: `에너지 넘치게 응원하는 말투. 느낌표와 힘 있는 말("최고예요", "대박이에요", "미쳤어요", "응원해요")로 기분이 좋아지게. 20~45자.
신나도 **끝은 존댓말**이에요("가보자고" 같은 반말 대신 "가봐요", "가즈아" 대신 "파이팅이에요"). 이모지는 2~3개까지 괜찮아요.
결 예시: "10K 완주 대박이에요!! 다음 기록도 응원해요 💪🔥" / "아침부터 이 텐션 최고예요!! ☀️"`,
  },
  humor: {
    label: "유머",
    temperature: 1.0,
    must: "엉뚱한 비유나 과장 하나로 피식 웃기세요(그냥 칭찬만 하면 안 됩니다). 상대를 놀리지는 마세요.",
    guide: `글 내용을 살짝 비틀어 피식 웃게 하는 한마디. 과장 · 엉뚱한 비유 · 귀여운 투정. 15~40자.
**상대를 놀리거나 깎아내리지 않아요.** 웃음의 대상은 상황이나 나 자신이에요. ㅋㅋ · 😂 는 한 번만.
끝은 존댓말이에요.
결 예시: "이 페이스면 신호등도 못 따라오겠어요 😂" / "사진 보고 저도 모르게 냉장고 열었어요 ㅋㅋ"`,
  },
} as const;
export type IgCommentStyle = keyof typeof IG_COMMENT_STYLES;
export const styleOf = (s: unknown): IgCommentStyle =>
  (typeof s === "string" && s in IG_COMMENT_STYLES ? s : "basic") as IgCommentStyle;

/** 요청의 스타일 — 맞춤(custom)까지. 맞춤은 계정에 지침이 있을 때만 쓰고 없으면 basic */
export type IgCommentStyleId = IgCommentStyle | "custom";
export const styleIdOf = (s: unknown): IgCommentStyleId => (s === "custom" ? "custom" : styleOf(s));

/** 맞춤 스타일 — 사용자 글 · 댓글에서 뽑은 지침을 guide 로 쓴다. 언어 규칙 · POLICY 가 여전히 위에 선다 */
function customStyle(guide: string) {
  return {
    label: "맞춤",
    temperature: 0.85,
    guide: `이 계정 주인이 평소 댓글을 쓰는 방식이에요. 이 사람이 직접 단 것처럼 씁니다.\n${guide.slice(0, 1500)}`,
    must: "위 [스타일 — 맞춤] 의 말투 · 길이 · 이모지 · 끝맺음 습관을 따르세요. 지침에 적힌 표현을 매번 그대로 반복하지 말고 이 글에 맞게 쓰세요.",
  };
}

export type AiCommentResult = {
  skip: boolean;
  reason: string;
  comment: string;
  model: string;
  usage: { prompt: number | null; completion: number | null; total: number | null };
};

const BASE = `당신은 인스타그램 사용자 대신 다른 사람의 피드 글에 댓글을 쓰는 도우미입니다.
글쓴이, 글 본문, 사진(또는 사진 설명)을 보고 **그 글에만 어울리는** 짧은 댓글 하나를 씁니다.

[댓글]
- **글의 주된 언어 하나로만** 씁니다. 한국어 글이면 한국어로만, 영어 글이면 영어로만, 일본어 글이면 일본어로만.
  다른 언어를 **섞지 않습니다** — 한국어 댓글에 영어 단어 · 영어 감탄사(wow · vibe · insane · cool …)를 넣지 않습니다.
  글에 나온 고유명사 · 브랜드 이름만 예외입니다. 본문이 없거나 해시태그뿐이면 한국어로 씁니다.
- 한국어로 쓸 때는 **어느 스타일이든 존댓말(해요체)** 로 끝냅니다. "~하다", "~네", "~야", "~지" 같은 반말로 끝내지 않습니다.
  다른 언어로 쓸 때는 그 언어에서 처음 보는 사람에게 쓰는 다정하고 예의 있는 말투로 씁니다.
- 1~2문장, 60자 안팎. 길게 쓰지 않습니다.
- 글이나 사진에 **실제로 보이는 것 하나**를 짚어 반응합니다(기록 · 장소 · 음식 · 표정 · 노력 등).
- 말투는 아래 [스타일] 을 따릅니다. 사용자가 말투 · 계정 성격을 적었으면 그것도 함께 따릅니다.
- 이모지는 스타일에 맞게 조금만, 문장 끝에 씁니다.
- 스타일의 예시는 **결만 참고**합니다. 예시 문장을 그대로 쓰거나 단어만 바꿔 쓰지 않습니다.

[건너뛰기]
아래면 댓글을 쓰지 말고 skip 을 true 로 답합니다.
- 부고 · 사고 · 투병 · 이별처럼 가벼운 댓글이 실례가 되는 글
- 정치 · 종교 · 논쟁 · 혐오가 담긴 글
- 광고 · 협찬 · 판매 · 공구 · 이벤트 참여 유도 글
- 내용을 거의 알 수 없는 글(본문도 사진 설명도 없음)

[출력]
JSON 한 덩어리만: {"skip": false, "reason": "", "comment": "..."}
skip 이 true 면 reason 에 까닭을 짧게, comment 는 "".`;

const POLICY = `[반드시 지킬 것 — 위 말투 지시보다 우선]
- 글이나 사진에 없는 사실을 지어내지 않습니다. 기록 · 거리 · 장소 · 관계 · 나이를 넘겨짚지 않습니다.
- "좋은 하루 되세요", "멋져요!" 처럼 어느 글에나 붙는 말만으로 끝내지 않습니다. 반드시 이 글의 내용 하나를 짚습니다.
- 해시태그 · 링크 · 계정 태그(@) · 홍보 · 맞팔 요청 · 내 계정 소개를 넣지 않습니다.
- 외모 평가 · 체형 언급 · 지나친 칭찬으로 부담을 주지 않습니다.
- 질문은 넣더라도 한 번만, 가볍게.
- 상대를 "당신", "님" 으로 부르지 않습니다(인스타 댓글에서 어색합니다). 호칭 없이 씁니다.
- 한국어 댓글은 스타일과 상관없이 **존댓말로 끝냅니다.**
- 댓글은 [이 글의 댓글 언어] 하나로만 씁니다. 스타일 예시에 다른 언어 단어가 있어도 섞지 않습니다.
- 스타일이 정한 글자 수를 넘기지 않습니다.`;

/**
 * 댓글 언어 — 모델에 맡기지 않고 **글자로 정한다**(2026-11-07).
 * 지침에 "글의 언어로" 라고만 적었더니 영어 글에 한국어로 답했다(스타일 설명이 한국어라 끌려간다).
 * 처음엔 한·영이 섞인 글에 섞어 쓰게 했는데 한국어 글에 영어가 끼어든다는 말이 나와서(2026-11-07, 사용자)
 * **주된 언어 하나로만** 쓰게 바꿨다. 해시태그 · @ · 링크는 빼고 센다.
 */
export type CommentLang = "ko" | "en" | "ja";
export function commentLanguage(caption: string): { code: CommentLang; rule: string } {
  const t = String(caption || "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#@][^\s#@]+/g, " ");
  const count = (re: RegExp) => (t.match(re) || []).length;
  const ko = count(/[\uac00-\ud7a3]/g);
  const ja = count(/[\u3040-\u30ff]/g);
  const en = count(/[A-Za-z]/g) / 2.5;   // 영문은 글자당 정보가 적어 한글 1자 ≈ 영문 2.5자로 본다
  const total = ko + ja + en;
  const KO = "한국어로만 쓰세요. 영어 단어 · 영어 감탄사 · 로마자를 섞지 마세요(글에 나온 고유명사 · 브랜드만 예외). 존댓말(해요체)로 끝내세요.";
  if (total < 4) return { code: "ko", rule: KO };
  if (ja / total > 0.3 && ja >= ko) return { code: "ja", rule: "日本語だけで書いてください。韓国語や英語を混ぜないでください。です・ます調で。" };
  if (en > ko && en > ja) return { code: "en", rule: "Write the comment in ENGLISH ONLY. Do not use any Korean or other languages." };
  return { code: "ko", rule: KO };
}

/**
 * 만든 댓글이 정한 언어를 지켰나. 어기면 한 번 다시 만들고, 그래도 어기면 건너뛴다.
 *   ko — 글에 없던 영어 단어(2글자 이상)가 있으면 어김. 글에 나온 고유명사 · 브랜드는 봐준다
 *   en · ja — 한글이 있으면 어김
 */
export function languageSlip(code: CommentLang, comment: string, caption: string): string | null {
  if (code === "ko") {
    const seen = new Set((String(caption || "").match(/[A-Za-z][A-Za-z'’.-]+/g) || []).map((w) => w.toLowerCase()));
    for (const unit of ["km", "kg", "cm", "mm", "ml", "kcal", "pb"]) seen.add(unit);   // 단위 · 기록 약어는 한국어 글에도 흔하다
    const foreign = (comment.match(/[A-Za-z][A-Za-z'’.-]+/g) || []).filter((w) => !seen.has(w.toLowerCase()));
    return foreign.length ? foreign.join(", ") : null;
  }
  const hangul = comment.match(/[\uac00-\ud7a3]+/g);
  return hangul ? hangul.join(" ") : null;
}

function extractJson(raw: string): Record<string, unknown> | null {
  const t = raw.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 댓글로 쓰면 안 되는 것을 마지막으로 걷어 낸다(모델이 지침을 어겼을 때) */
function cleanComment(s: string): string {
  return s
    .replace(/https?:\/\/\S+/g, "")
    .replace(/(^|\s)#[^\s#]+/g, "$1")
    .replace(/(^|\s)@[A-Za-z0-9._]+/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
}

export async function generateIgComment(input: AiCommentInput): Promise<AiCommentResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.");
  const model = (process.env.OPENAI_MODEL ?? "gpt-4o-mini").trim() || "gpt-4o-mini";

  const tone = (input.tone ?? "").trim().slice(0, 300);
  const custom = input.style === "custom" && (input.customGuide ?? "").trim();
  const style = custom ? customStyle(custom) : IG_COMMENT_STYLES[styleOf(input.style)];
  const lang = commentLanguage(input.caption);
  const system = `${BASE}\n\n[스타일 — ${style.label}]\n${style.guide}`
    + `${tone ? `\n\n[사용자가 정한 말투 · 계정 성격]\n${tone}` : ""}\n\n${POLICY}`
    + `\n\n[이 글의 댓글 언어 — 무엇보다 우선]\n${lang.rule}`
    + `\n\n[이번 댓글에 꼭 들어갈 것 — ${style.label}]\n${style.must}`;

  const text = [
    `글쓴이: @${input.author}`,
    `본문:\n${(input.caption || "(본문 없음)").slice(0, 1500)}`,
    input.imageAlt ? `사진 설명(인스타그램 자동 설명): ${input.imageAlt.slice(0, 300)}` : "",
    `댓글 언어: ${lang.rule}`,
    `스타일(${style.label}): ${style.must}`,
  ].filter(Boolean).join("\n\n");

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: "text", text }];
  if (input.imageDataUrl && /^data:image\/(jpeg|png|webp);base64,/.test(input.imageDataUrl)) {
    // 사진은 낮은 해상도로 — 댓글 하나에는 충분하고 비용이 가장 싸다
    content.push({ type: "image_url", image_url: { url: input.imageDataUrl, detail: "low" } });
  }

  const client = new OpenAI({ apiKey });
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content },
  ];
  const usage = { prompt: 0, completion: 0, total: 0 };
  let usedModel = model;
  let skip = false;
  let reason = "";
  let comment = "";
  // 언어를 어기면 한 번만 다시 — 두 번째도 어기면 그 글은 건너뛴다(다른 언어가 섞인 댓글을 올리지 않는다)
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await client.chat.completions.create({
      model,
      temperature: attempt ? Math.min(style.temperature, 0.7) : style.temperature,
      max_tokens: 200,
      response_format: { type: "json_object" },
      messages,
    });
    usedModel = completion.model || model;
    const u = completion.usage;
    usage.prompt += u?.prompt_tokens ?? 0;
    usage.completion += u?.completion_tokens ?? 0;
    usage.total += u?.total_tokens ?? 0;

    const raw = completion.choices[0]?.message?.content ?? "";
    const j = extractJson(raw) ?? {};
    skip = j.skip === true;
    reason = skip ? String(j.reason ?? "").slice(0, 120) : "";
    comment = skip ? "" : cleanComment(String(j.comment ?? ""));
    if (skip || !comment) break;

    const slip = languageSlip(lang.code, comment, input.caption);
    if (!slip) break;
    if (attempt === 1) {
      skip = true;
      reason = `댓글 언어를 맞추지 못해 건너뜀(${slip.slice(0, 40)})`;
      comment = "";
      break;
    }
    messages.push(
      { role: "assistant", content: raw },
      { role: "user", content: `방금 댓글에 다른 언어가 섞였어요: ${slip}. ${lang.rule} 같은 뜻을 이 언어로만 다시 써서 같은 JSON 으로 답하세요.` },
    );
  }
  return {
    skip: skip || !comment,
    reason: skip ? reason : comment ? "" : "댓글을 만들지 못했어요",
    comment,
    model: usedModel,
    usage: { prompt: usage.prompt || null, completion: usage.completion || null, total: usage.total || null },
  };
}


/* ── 맞춤 스타일 분석 (2026-11-07) ─────────────────────────────
 * 앱이 내 글(본문)과 그 글들에 **내가 단 댓글 · 답글**을 모아 보내면, 댓글 쓰는 습관을 지침으로 정리한다.
 * 지침은 댓글을 만들 때 [스타일 — 맞춤] 자리에 들어간다(언어 규칙 · POLICY 가 위에 선다).
 * 지침에는 사람 이름 · 계정 · 장소 같은 개인 사실을 넣지 않는다 — 말투만 옮긴다. */
export type StyleSample = { caption?: string; comments: string[] };
export type StyleAnalysis = {
  guide: string;
  summary: string;
  model: string;
  usage: { prompt: number | null; completion: number | null; total: number | null };
};

const STYLE_SYSTEM = `당신은 인스타그램 사용자의 댓글 습관을 읽고, 다른 AI 가 그 사람처럼 댓글을 쓰도록 **스타일 지침**을 만드는 분석가입니다.

입력은 이 사람이 올린 게시글 본문 몇 개와, 그 게시글들에 **이 사람이 직접 단 댓글 · 답글**입니다.
댓글이 가장 중요한 근거입니다. 본문은 말투 참고로만 씁니다.

지침에 담을 것(관찰된 것만, 근거가 없으면 적지 않음)
- 존댓말 / 반말, 끝맺음 습관(~요, ~네요, ~ㅎㅎ, 느낌표 수 등)
- 길이(대략 몇 자 · 몇 문장)
- 이모지 · 이모티콘 · ㅋㅋ/ㅎㅎ 쓰는 정도와 자주 쓰는 것
- 자주 쓰는 표현 · 감탄어 · 호응 방식(고마움 표현, 되묻기, 응원 등) — 짧은 예 2~4개까지만 따옴표로
- 분위기(다정함 · 담백함 · 유쾌함 등)와 상대를 대하는 태도
- 피하는 것(관찰되면)

지키는 것
- 사람 이름 · 계정(@) · 장소 · 날짜 · 개인 사정 같은 사실은 지침에 넣지 않습니다. 말투만 옮깁니다.
- 지침은 한국어로, 다른 AI 에게 주는 지시문 형태(~씁니다 / ~합니다)로 600자 안쪽.
- 댓글이 적으면(5개 미만) 본문 말투로 보충하되 summary 에 "근거가 적어요" 라고 적습니다.

출력은 JSON 한 덩어리만: {"guide": "...", "summary": "사용자에게 보여 줄 한두 문장 요약"}`;

export async function analyzeIgStyle(input: { igUsername: string; samples: StyleSample[] }): Promise<StyleAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.");
  const model = (process.env.OPENAI_MODEL ?? "gpt-4o-mini").trim() || "gpt-4o-mini";

  // 입력 크기를 묶는다 — 글 본문은 짧게, 댓글은 하나에 200자, 전체 12,000자
  let budget = 12_000;
  const blocks: string[] = [];
  input.samples.forEach((p, i) => {
    if (budget <= 0) return;
    const cap = (p.caption ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
    const cs = p.comments.map((c) => c.replace(/\s+/g, " ").trim().slice(0, 200)).filter(Boolean);
    const block = [`[글 ${i + 1}] ${cap || "(본문 없음)"}`, ...cs.map((c) => `  - 내 댓글: ${c}`)].join("\n");
    budget -= block.length;
    blocks.push(block);
  });

  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.4,
    max_tokens: 700,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: STYLE_SYSTEM },
      { role: "user", content: blocks.join("\n\n") || "(자료 없음)" },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? "";
  const j = extractJson(raw) ?? {};
  const guide = String(j.guide ?? "").trim().slice(0, 1500);
  if (!guide) throw new Error("지침을 만들지 못했어요");
  const u = completion.usage;
  return {
    guide,
    summary: String(j.summary ?? "").trim().slice(0, 300),
    model: completion.model || model,
    usage: { prompt: u?.prompt_tokens ?? null, completion: u?.completion_tokens ?? null, total: u?.total_tokens ?? null },
  };
}
