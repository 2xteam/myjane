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
  /** 사용자가 정한 말투 · 계정 성격(예: "러닝 계정, 다정하게, 반말 금지") */
  tone?: string;
};

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
- 한국어로 씁니다. 본문이 영어 등 다른 언어면 그 언어로 씁니다.
- 1~2문장, 60자 안팎. 길게 쓰지 않습니다.
- 글이나 사진에 **실제로 보이는 것 하나**를 짚어 반응합니다(기록 · 장소 · 음식 · 표정 · 노력 등).
- 존댓말(해요체)을 기본으로 합니다. 사용자가 말투를 정했으면 그것을 따릅니다.
- 이모지는 0~2개만, 문장 끝에 씁니다.

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
- 질문은 넣더라도 한 번만, 가볍게.`;

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
  const system = `${BASE}${tone ? `\n\n[사용자가 정한 말투 · 계정 성격]\n${tone}` : ""}\n\n${POLICY}`;

  const text = [
    `글쓴이: @${input.author}`,
    `본문:\n${(input.caption || "(본문 없음)").slice(0, 1500)}`,
    input.imageAlt ? `사진 설명(인스타그램 자동 설명): ${input.imageAlt.slice(0, 300)}` : "",
  ].filter(Boolean).join("\n\n");

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: "text", text }];
  if (input.imageDataUrl && /^data:image\/(jpeg|png|webp);base64,/.test(input.imageDataUrl)) {
    // 사진은 낮은 해상도로 — 댓글 하나에는 충분하고 비용이 가장 싸다
    content.push({ type: "image_url", image_url: { url: input.imageDataUrl, detail: "low" } });
  }

  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.8,
    max_tokens: 200,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const j = extractJson(raw) ?? {};
  const skip = j.skip === true;
  const comment = skip ? "" : cleanComment(String(j.comment ?? ""));
  const u = completion.usage;
  return {
    skip: skip || !comment,
    reason: skip ? String(j.reason ?? "").slice(0, 120) : comment ? "" : "댓글을 만들지 못했어요",
    comment,
    model: completion.model || model,
    usage: { prompt: u?.prompt_tokens ?? null, completion: u?.completion_tokens ?? null, total: u?.total_tokens ?? null },
  };
}
