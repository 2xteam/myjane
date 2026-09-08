import type { UserDocument } from "@/models/User";

/**
 * 계정 찾기·비밀번호 재설정 메일의 재발송 쿨다운.
 *
 * ⚠️ **이 메일들은 아무나 남의 주소로 쏠 수 있다.** 이메일만 넣으면 그 주소로
 * 발송되기 때문이다. 쿨다운이 없으면 버튼 연타가 그대로 **남의 메일함에 대한
 * 폭탄**이 된다. 인증 메일(`emailVerification.ts`)에는 이미 있던 것을 이쪽에도 둔다.
 *
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */
export const AUTH_MAIL_COOLDOWN_MS = 60 * 1000;

/** 다음 발송까지 남은 밀리초. 0이면 지금 보내도 된다 */
export function remainingAuthMailCooldownMs(user: UserDocument): number {
  const sentAt = user.authMailSentAt;
  if (!sentAt) return 0;
  const left = sentAt.getTime() + AUTH_MAIL_COOLDOWN_MS - Date.now();
  return left > 0 ? left : 0;
}

export function authMailOnCooldown(user: UserDocument): boolean {
  return remainingAuthMailCooldownMs(user) > 0;
}
