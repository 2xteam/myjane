import crypto from "node:crypto";
import { parseIdentifier } from "@/lib/identifier";
import { sendMail } from "@/lib/mail";
import type { UserDocument } from "@/models/User";

/**
 * 이메일 인증 — 토큰 발급 · 재발송 쿨다운 · 메일 본문.
 *
 * `forgot-pin` → `/reset-pin-email` 흐름과 **같은 모양**이다. 새 방식을 만들지 않고
 * 그 패턴을 그대로 옮겼다: 임의 토큰 발급 → 30분 만료 → 링크를 메일로 → 쓰면 폐기.
 *
 * 인증 상태(`emailVerified`)는 여섯 앱이 공유하지만 **발급과 검증은 포털에만** 둔다.
 * 앱마다 물으면 같은 사람에게 여섯 번 묻게 된다.
 *
 * → my-obsidian-vault / 30-Patterns/인증과 세션 공유.md
 */

/** 토큰 수명. `pinResetToken` 과 같다 */
export const EMAIL_TOKEN_TTL_MS = 30 * 60 * 1000;

/** 재발송 쿨다운. 없으면 버튼 연타가 그대로 메일 폭탄이 된다 */
export const RESEND_COOLDOWN_MS = 60 * 1000;

/** 안내를 다시 띄우기까지의 간격 — 하루에 한 번만 묻는다 */
export const PROMPT_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * 이메일 문자열을 정규화한다. 형식이 아니면 `null`.
 *
 * 정규식을 또 쓰지 않고 `parseIdentifier` 를 그대로 쓴다 — 로그인·가입이 이메일인지
 * 전화번호인지 가르는 데 쓰는 바로 그 판단이라, 두 벌이 되면 언젠가 갈라진다.
 */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const parsed = parseIdentifier(raw);
  return parsed.kind === "email" ? parsed.email : null;
}

/** 재발송까지 남은 밀리초. 0이면 지금 보내도 된다 */
export function remainingCooldownMs(user: UserDocument): number {
  const sentAt = user.emailTokenSentAt;
  if (!sentAt) return 0;
  const left = sentAt.getTime() + RESEND_COOLDOWN_MS - Date.now();
  return left > 0 ? left : 0;
}

/** 다음 안내 시각 — 지금부터 하루 뒤 */
export function nextPromptAt(): Date {
  return new Date(Date.now() + PROMPT_INTERVAL_MS);
}

/**
 * 인증 토큰을 발급해 문서에 얹고 메일을 보낸다. **저장은 부르는 쪽에서 한다** —
 * 이메일 등록처럼 같은 저장에 다른 필드도 함께 담아야 하는 자리가 있어서다.
 *
 * 메일 발송이 실패하면 예외가 그대로 올라간다. 토큰만 심어 두고 "보냈다"고
 * 답하면 사람은 오지 않는 메일을 기다리게 된다.
 */
export async function issueEmailToken(
  user: UserDocument,
  email: string,
): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");

  /*
    ⚠️ 메일을 **먼저 보내고** 그 다음에 문서에 얹는다.

    반대로 하면 발송이 실패했을 때도 `emailTokenSentAt` 이 남아, 오지도 않은
    메일 때문에 60초 동안 재발송이 막힌다. 사람은 기다릴 이유가 없는 것을
    기다리게 된다.
  */
  await sendVerificationMail(email, user.name ?? user.nickname ?? "회원", token);

  user.emailToken = token;
  user.emailTokenExpires = new Date(Date.now() + EMAIL_TOKEN_TTL_MS);
  user.emailTokenSentAt = new Date();
}

function verifyUrl(token: string): string {
  const origin = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.myjane.co.kr";
  return `${origin}/verify-email?token=${token}`;
}

/**
 * 인증 메일. `forgot-pin` 의 본문과 같은 틀이다.
 *
 * 메일 HTML 은 CSS 변수를 쓸 수 없어 색을 리터럴로 적는다 —
 * `scripts/design-check.mjs` 가 `api/auth` 와 함께 이 자리를 예외로 둔다.
 */
async function sendVerificationMail(to: string, name: string, token: string) {
  const url = verifyUrl(token);
  await sendMail(
    to,
    "[myjane] 이메일 인증",
    `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#2ee8ae;margin:0 0 16px;">myjane</h2>
      <p>안녕하세요, <strong>${name}</strong>님.</p>
      <p>아래 버튼을 눌러 이메일 주소를 확인해 주세요.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${url}" style="display:inline-block;padding:14px 32px;background:#2ee8ae;color:#000;font-weight:700;border-radius:12px;text-decoration:none;font-size:15px;">
          이메일 인증하기
        </a>
      </div>
      <p style="color:#888;font-size:13px;">이 링크는 30분 동안 유효합니다.</p>
      <p style="color:#888;font-size:13px;">인증하지 않아도 로그인은 됩니다. 다만 비밀번호를 잊었을 때 재설정 링크를 받으려면 인증이 필요해요.</p>
      <p style="color:#888;font-size:13px;">본인이 요청하지 않으셨다면 이 메일을 무시하셔도 됩니다.</p>
      <p style="color:#aaa;font-size:11px;margin-top:24px;word-break:break-all;">링크가 동작하지 않으면 아래 URL을 브라우저에 붙여넣기 하세요:<br/>${url}</p>
    </div>`,
  );
}

/**
 * 안내가 필요한 상태인지. `null` 이면 조용히 둔다.
 *
 * - `missing`    이메일이 아예 없다 (전화번호로만 가입한 계정)
 * - `pending`    새 주소를 받아 두고 링크를 기다린다 (`pendingEmail`)
 * - `unverified` 주소는 있는데 아직 인증되지 않았다
 */
export type EmailPromptState = "missing" | "pending" | "unverified" | null;

export function emailPromptState(user: {
  email?: string | null;
  pendingEmail?: string | null;
  emailVerified?: boolean | null;
}): EmailPromptState {
  if (user.pendingEmail) return "pending";
  if (!user.email) return "missing";
  if (!user.emailVerified) return "unverified";
  return null;
}
