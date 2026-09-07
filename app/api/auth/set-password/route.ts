import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { passwordProblem } from "@/lib/password";
import { requireSessionUser } from "@/lib/serverSession";

export const runtime = "nodejs";

/**
 * 전화번호로만 가입했던 사람이 이메일 인증을 마친 뒤 **비밀번호를 정하는** 자리.
 *
 * ⚠️ **`pin` 을 지우지 않는다.** 지우면 그 사람이 여태 쓰던 로그인 방법이
 * 갑자기 사라진다. 둘 다 가진 계정은 어느 쪽으로도 로그인된다 —
 * `/api/auth/login` 이 `[password, pin]` 을 차례로 맞춰 보기 때문에 이미 그렇게
 * 동작한다 → my-obsidian-vault / 30-Patterns/인증과 세션 공유.md
 *
 * 인증을 마친 계정만 통과시킨다. 인증되지 않은 주소로 비밀번호를 세워 두면
 * 잊었을 때 되찾을 곳이 없어, 지금 상태보다 나아지지 않는다.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireSessionUser(req);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    let body: { password?: string; passwordConfirm?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 },
      );
    }

    if (!user.email || !user.emailVerified) {
      return NextResponse.json(
        {
          ok: false,
          error: "이메일 인증을 먼저 마쳐 주세요. 비밀번호를 잊었을 때 되찾을 곳이 필요해요.",
        },
        { status: 400 },
      );
    }

    const password = body.password ?? "";
    const problem = passwordProblem(password);
    if (problem) {
      return NextResponse.json({ ok: false, error: problem }, { status: 400 });
    }

    if (password !== (body.passwordConfirm ?? password)) {
      return NextResponse.json(
        { ok: false, error: "입력한 두 비밀번호가 일치하지 않습니다." },
        { status: 400 },
      );
    }

    user.password = await bcrypt.hash(password, 10);
    // `pin` 은 그대로 둔다 — 위 주석 참고
    await user.save();

    return NextResponse.json({ ok: true, keptPin: Boolean(user.pin) });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
