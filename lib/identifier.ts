import { normalizePhone } from "@/lib/phone";

/**
 * 로그인·가입에서 받는 **하나의 입력칸**을 이메일인지 전화번호인지 가른다.
 *
 * 네 앱이 회원을 공유하지만 로그인 수단은 갈렸다 — Snap 계열·FitLog는
 * 전화번호+PIN, 2hbk는 이메일+비밀번호다. 사람에게 "당신은 어느 쪽이냐"를
 * 묻는 것이 이상해서, 아무거나 넣으면 알아서 판단하도록 합쳤다.
 */

export type Identifier =
  | { kind: "email"; email: string }
  | { kind: "phone"; phone: string }
  | { kind: "unknown" };

export function parseIdentifier(input: string): Identifier {
  const raw = (input ?? "").trim();
  if (!raw) return { kind: "unknown" };

  // `@`가 있으면 이메일로 본다. 전화번호에는 `@`가 들어갈 수 없다
  if (raw.includes("@")) {
    const email = raw.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { kind: "email", email } : { kind: "unknown" };
  }

  const phone = normalizePhone(raw);
  // 국내 휴대폰은 10~11자리. 하이픈·공백은 normalizePhone이 걷어낸다
  if (phone.length >= 9 && phone.length <= 11) return { kind: "phone", phone };

  return { kind: "unknown" };
}

/** 사람이 읽을 안내 문구 — 입력칸 하나로 합쳐 놓았으니 무엇이 가능한지 알려야 한다 */
export const IDENTIFIER_HINT = "이메일 또는 전화번호로 로그인할 수 있어요.";
