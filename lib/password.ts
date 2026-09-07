/**
 * 비밀번호 규칙 — 가입과 "비밀번호 설정" 두 자리가 같은 규칙을 써야 한다.
 *
 * 규칙이 두 벌이면 한쪽에서 통과한 값이 다른 쪽에서 거부되고, 사람은 왜인지
 * 알 수 없다.
 *
 * ⚠️ PIN 은 여기 규칙을 쓰지 않는다. 4자 이상 숫자이고, 전화번호로 가입한
 * 옛 계정의 로그인 수단이다. 비밀번호를 설정해도 **PIN 은 지우지 않는다** —
 * 둘 다 가진 계정은 어느 쪽으로도 로그인된다
 * → my-obsidian-vault / 30-Patterns/인증과 세션 공유.md
 */

export const MIN_PASSWORD = 8;

/** 문제가 있으면 안내 문구, 없으면 `null` */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return `비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다.`;
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "비밀번호에 영문과 숫자를 함께 넣어 주세요.";
  }
  return null;
}
