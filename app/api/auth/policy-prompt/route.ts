import { NextResponse } from "next/server";
import { POLICY_VERSION } from "@/lib/legalVersion";
import { requireSessionUser } from "@/lib/serverSession";

export const runtime = "nodejs";

/**
 * 방침·약관이 개정된 뒤 아직 새 판을 확인하지 않은 회원에게 안내를 띄울지(GET),
 * "확인했어요" 를 기록할지(POST).
 *
 * 가입 때 `users.agreedPolicyVersion` 에 동의한 판을 남긴다. `POLICY_VERSION` 이 올라가면
 * 그 값이 달라지므로 재안내 대상을 골라낼 수 있다 → lib/legalVersion.ts
 *
 * ⚠️ 로그인을 막지 않는다. 개정 내용이 수집 항목을 늘리는 것이면 이 띠가 아니라
 * 별도 동의 화면이 필요하다 — 2026-09-09 개정은 안전조치·보관 기간·책임자 표기라 안내로 충분하다.
 * 기존 회원 중 `agreedPolicyVersion` 이 비어 있는 계정(C 작업 전 가입)도 대상이다.
 * → my-obsidian-vault / 50-Plans/E 개인정보 보호 보강.md 10번
 */
export async function GET(req: Request) {
  try {
    const auth = await requireSessionUser(req);
    if ("error" in auth) return auth.error;
    const { user } = auth;
    return NextResponse.json({
      ok: true,
      version: POLICY_VERSION,
      show: user.agreedPolicyVersion !== POLICY_VERSION,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireSessionUser(req);
    if ("error" in auth) return auth.error;
    const { user } = auth;
    /* 처음 동의 시각(termsAgreedAt · privacyAgreedAt)은 덮어쓰지 않는다 — 처음 받은 때가 기록이다 */
    user.agreedPolicyVersion = POLICY_VERSION;
    await user.save();
    return NextResponse.json({ ok: true, version: POLICY_VERSION });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
