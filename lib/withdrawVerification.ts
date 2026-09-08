import crypto from "node:crypto";
import { sendMail } from "@/lib/mail";
import type { UserDocument } from "@/models/User";

/**
 * 탈퇴 확인 메일 — 토큰 발급과 본문.
 *
 * 이메일 인증(`lib/emailVerification.ts`)과 **같은 모양**이다. 새 방식을 만들지
 * 않고 그 패턴을 옮겼다: 임의 토큰 → 30분 만료 → 링크를 메일로 → 쓰면 폐기.
 *
 * 왜 메일까지 받나 — 비밀번호와 확인 문구만으로 닫으면 남의 브라우저를 잠깐
 * 만진 사람이 계정을 닫을 수 있다. 되돌리려면 6개월 안에 알아차려야 하고
 * 그 사이 여섯 앱이 전부 막힌다. **메일함까지 가진 사람만** 닫을 수 있게 한다.
 *
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */

/** 토큰 수명. 이메일 인증과 같다 */
export const WITHDRAW_TOKEN_TTL_MS = 30 * 60 * 1000;

function confirmUrl(token: string): string {
  const origin = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.myjane.co.kr";
  return `${origin}/account/withdraw?token=${token}`;
}

/**
 * 토큰을 발급해 문서에 얹고 메일을 보낸다. **저장은 부르는 쪽에서 한다.**
 *
 * ⚠️ 메일을 **먼저 보내고** 문서에 얹는다. 반대로 하면 발송이 실패해도 토큰이
 * 남아, 오지 않은 메일을 기다리게 된다 — 이메일 인증과 같은 이유다.
 */
export async function issueWithdrawToken(
  user: UserDocument,
  email: string,
): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  await sendWithdrawMail(email, user.name ?? user.nickname ?? "회원", token);

  user.withdrawToken = token;
  user.withdrawTokenExpires = new Date(Date.now() + WITHDRAW_TOKEN_TTL_MS);
}

/**
 * 탈퇴 확인 메일.
 *
 * 메일 HTML 은 CSS 변수를 쓸 수 없어 색을 리터럴로 적는다 —
 * `scripts/design-check.mjs` 가 `api/auth` 와 함께 이 자리를 예외로 둔다.
 *
 * ⚠️ **본인이 요청하지 않았을 때 무엇을 해야 하는지**를 분명히 쓴다.
 * 이 메일은 계정이 닫히기 직전에 가는 마지막 신호다.
 */
async function sendWithdrawMail(to: string, name: string, token: string) {
  const url = confirmUrl(token);
  await sendMail(
    to,
    "[myjane] 회원 탈퇴 확인",
    `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#116271;margin:0 0 16px;">myjane</h2>
      <p>안녕하세요, <strong>${name}</strong>님.</p>
      <p><strong>회원 탈퇴</strong>를 요청하셨습니다. 아래 버튼을 누르면 탈퇴가 완료됩니다.</p>
      <div style="background:#fdf0f2;border:1px solid #f3d4da;border-radius:12px;padding:14px 16px;margin:18px 0;">
        <p style="margin:0 0 6px;font-weight:700;color:#a83447;">탈퇴하면 이렇게 됩니다</p>
        <ul style="margin:0;padding-left:18px;color:#4b5563;font-size:13px;line-height:1.7;">
          <li>myjane · SnapWord · SnapNote · FitLog · 2hbk · TypeLog <strong>여섯 서비스가 함께 닫힙니다</strong></li>
          <li>기록은 <strong>6개월 동안 보관한 뒤 폐기</strong>합니다</li>
          <li>그 6개월 안에는 로그인 화면에서 되살릴 수 있습니다</li>
        </ul>
      </div>
      <div style="text-align:center;margin:24px 0;">
        <a href="${url}" style="display:inline-block;padding:14px 32px;background:#a83447;color:#ffffff;font-weight:700;border-radius:12px;text-decoration:none;font-size:15px;">
          탈퇴 확인하기
        </a>
      </div>
      <p style="color:#888;font-size:13px;">이 링크는 30분 동안 유효합니다.</p>
      <p style="color:#a83447;font-size:13px;font-weight:700;">본인이 요청하지 않으셨다면 이 링크를 누르지 마시고, 비밀번호를 바꿔 주세요. 누군가 회원님의 계정에 접근했을 수 있습니다.</p>
      <p style="color:#aaa;font-size:11px;margin-top:24px;word-break:break-all;">링크가 동작하지 않으면 아래 URL을 브라우저에 붙여넣기 하세요:<br/>${url}</p>
    </div>`,
  );
}

/** 토큰이 이 사람의 것이고 아직 살아 있나 */
export function withdrawTokenValid(user: UserDocument, token: string): boolean {
  if (!user.withdrawToken || !user.withdrawTokenExpires) return false;
  if (user.withdrawTokenExpires.getTime() < Date.now()) return false;
  /* 길이가 다르면 timingSafeEqual 이 던진다 */
  if (token.length !== user.withdrawToken.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(user.withdrawToken));
}
