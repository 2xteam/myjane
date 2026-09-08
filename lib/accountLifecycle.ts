import type { UserDocument } from "@/models/User";

/**
 * 계정의 수명에 관한 규칙 — **기간의 원본은 이 파일 하나다.**
 *
 * 방침·약관에 적어 공개한 숫자와 코드가 갈리면 그 문구가 거짓말이 된다.
 * 기간을 바꿀 때는 여기와 `app/legal/*` 본문을 **함께** 고친다.
 *
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */

/** 탈퇴 후 보관 기간. 방침 5항 "6개월 동안 보관한 뒤 폐기" 와 같아야 한다 */
export const WITHDRAW_RETENTION_DAYS = 180;

/** 비밀번호 갱신을 안내하기 시작하는 나이. "3개월에 한 번" */
export const PASSWORD_MAX_AGE_DAYS = 90;

/** "3개월 연장" 을 누르면 미루는 기간 */
export const PASSWORD_SNOOZE_DAYS = 90;

const DAY = 24 * 60 * 60 * 1000;

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY);
}

/** 탈퇴한 계정이 실제로 지워지는 시각 */
export function purgeDueAt(withdrawnAt: Date): Date {
  return new Date(withdrawnAt.getTime() + WITHDRAW_RETENTION_DAYS * DAY);
}

/** 지금 탈퇴 상태인가 (아직 폐기되지 않았을 뿐) */
export function isWithdrawn(user: Pick<UserDocument, "withdrawnAt">): boolean {
  return Boolean(user.withdrawnAt);
}

/**
 * 되살릴 수 있는 기간이 얼마나 남았나. 탈퇴 상태가 아니면 `null`.
 *
 * 0 이하가 나올 수 있다 — 정리 작업이 아직 돌지 않은 사이다.
 * 그때는 되살리기를 막는다. 이미 폐기 대상인 계정이다.
 */
export function restoreDaysLeft(
  user: Pick<UserDocument, "withdrawnAt">,
): number | null {
  if (!user.withdrawnAt) return null;
  const left = purgeDueAt(user.withdrawnAt).getTime() - Date.now();
  return Math.ceil(left / DAY);
}

export function canRestore(user: Pick<UserDocument, "withdrawnAt">): boolean {
  const left = restoreDaysLeft(user);
  return left !== null && left > 0;
}

/**
 * 비밀번호를 바꾼 지 얼마나 됐나 (일).
 *
 * `passwordChangedAt` 이 없으면 `createdAt` 으로 센다 — 이 필드가 생기기 전에
 * 가입한 사람은 가입할 때 정한 비밀번호를 그대로 쓰고 있기 때문이다.
 * 둘 다 없으면 `null` 을 준다. **모르면 묻지 않는다** — 근거 없이 띄우면
 * 안내가 아니라 잔소리가 된다.
 */
export function passwordAgeDays(
  user: Pick<UserDocument, "passwordChangedAt" | "createdAt" | "password">,
): number | null {
  if (!user.password) return null; // PIN 으로만 쓰는 계정에는 물을 것이 없다
  const base = user.passwordChangedAt ?? user.createdAt ?? null;
  if (!base) return null;
  return Math.floor((Date.now() - new Date(base).getTime()) / DAY);
}

/** 비밀번호 갱신 안내를 띄워야 하나 */
export function shouldPromptPassword(
  user: Pick<
    UserDocument,
    "passwordChangedAt" | "createdAt" | "password" | "passwordPromptSnoozedUntil" | "withdrawnAt"
  >,
): boolean {
  if (isWithdrawn(user)) return false;
  const age = passwordAgeDays(user);
  if (age === null || age < PASSWORD_MAX_AGE_DAYS) return false;
  const snoozed = user.passwordPromptSnoozedUntil;
  if (snoozed && snoozed.getTime() > Date.now()) return false;
  return true;
}
