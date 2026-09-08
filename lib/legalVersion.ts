/**
 * 법적 문서의 개정일 — **원본은 이 파일 하나다.**
 *
 * 세 페이지(`app/legal/*`)가 화면에 찍는 "최종 개정일"과, 가입 라우트가
 * `users.agreedPolicyVersion` 에 남기는 값이 같아야 한다. 따로 적어 두면
 * 방침을 고쳤을 때 한쪽만 바뀌고, 그러면 **누가 어느 문서에 동의했는지**
 * 알 수 없게 된다.
 *
 * 방침·약관을 고칠 때 이 값을 함께 올린다. 올리면 그 전에 가입한 회원의
 * `agreedPolicyVersion` 이 이 값과 달라지므로 재동의 대상을 골라낼 수 있다.
 *
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */
export const POLICY_VERSION = "2026-09-08";
