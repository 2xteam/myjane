import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { canRestore, purgeDueAt, restoreDaysLeft } from "@/lib/accountLifecycle";
import { connectDB } from "@/lib/db";
import { requireSessionUser } from "@/lib/serverSession";
import { issueWithdrawToken, withdrawTokenValid } from "@/lib/withdrawVerification";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

/**
 * 탈퇴와 되살리기 — **여섯 서비스 공통이다.**
 *
 * 지우지 않고 `withdrawnAt` 만 남긴다. 방침 5항에 "6개월 보관한 뒤 폐기하고
 * 그 안에는 되살릴 수 있다" 고 적어 공개했기 때문이다. 실제 삭제는 정리
 * 작업이 한다 → app/api/cron/purge
 *
 * ⚠️ 화면은 **포털에만** 둔다. 여섯 앱에 각각 두면 "여기서 탈퇴하면 여섯 곳이
 * 다 닫힙니다" 를 여섯 번 다르게 쓰게 된다. 앱들은 링크만 보여 준다
 * → 각 앱 lib/portal.ts 의 withdrawUrl()
 *
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */

/** 지금 상태 — 탈퇴했나, 되살릴 수 있나 */
export async function GET(req: Request) {
  try {
    const auth = await requireSessionUser(req, { allowWithdrawn: true });
    if ("error" in auth) return auth.error;
    const { user } = auth;

    return NextResponse.json({
      ok: true,
      withdrawn: Boolean(user.withdrawnAt),
      withdrawnAt: user.withdrawnAt?.toISOString() ?? null,
      purgeAt: user.withdrawnAt ? purgeDueAt(user.withdrawnAt).toISOString() : null,
      restoreDaysLeft: restoreDaysLeft(user),
      canRestore: canRestore(user),
      /* PIN 으로만 쓰는 계정은 확인할 비밀번호가 없다 → PIN 을 받는다 */
      verifyWith: user.password ? "password" : user.pin ? "pin" : "none",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * 탈퇴를 **신청한다.** 여기서 닫히지 않는다.
 *
 * 세 단계를 모두 통과해야 한다.
 *   1. 비밀번호(또는 PIN) 확인 — 세션만으로는 남의 브라우저로도 닫을 수 있다
 *   2. "탈퇴합니다" 입력 — 버튼 하나면 잘못 누른다
 *   3. **메일의 링크** — 메일함까지 가진 사람만 닫을 수 있게 한다
 *
 * ⚠️ 이메일이 없는 계정(전화번호+PIN)은 3단계를 쓸 수 없다. 그때는 1·2 만으로
 * 닫는다. 막아 두면 그 사람은 탈퇴할 길이 아예 없어진다.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireSessionUser(req);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    if (user.withdrawnAt) {
      return NextResponse.json(
        { ok: false, error: "이미 탈퇴 처리된 계정입니다." },
        { status: 409 },
      );
    }

    let body: { secret?: string; confirm?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }

    if (body.confirm?.trim() !== "탈퇴합니다") {
      return NextResponse.json(
        { ok: false, error: "확인 문구를 정확히 입력해 주세요." },
        { status: 400 },
      );
    }

    const secret = typeof body.secret === "string" ? body.secret : "";
    const hash = user.password ?? user.pin ?? null;
    if (hash) {
      if (!secret || !(await bcrypt.compare(secret, hash))) {
        return NextResponse.json(
          { ok: false, error: user.password ? "비밀번호가 맞지 않습니다." : "PIN 이 맞지 않습니다." },
          { status: 401 },
        );
      }
    }

    /*
      이메일이 있으면 확인 메일을 보내고 **여기서 멈춘다.** 링크를 눌러야 닫힌다.
      발송이 실패하면 탈퇴시키지 않는다 — 오지 않는 메일을 기다리게 하느니
      실패를 알리고 다시 시도하게 하는 편이 낫다.
    */
    const email = user.email ?? null;
    if (email) {
      try {
        await issueWithdrawToken(user, email);
      } catch {
        return NextResponse.json(
          { ok: false, error: "확인 메일을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요." },
          { status: 502 },
        );
      }
      await user.save();
      return NextResponse.json({ ok: true, needsEmailConfirm: true, email });
    }

    /* 이메일이 없는 계정 — 여기서 닫는다 */
    const now = new Date();
    user.withdrawnAt = now;
    await user.save();

    return NextResponse.json({
      ok: true,
      needsEmailConfirm: false,
      withdrawnAt: now.toISOString(),
      purgeAt: purgeDueAt(now).toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * 메일의 링크로 들어와 **탈퇴를 확정한다.**
 *
 * 세션을 요구하지 않는다 — 메일을 다른 기기에서 열 수 있다. 토큰 자체가 증명이다
 * (`/verify-email` 과 같다). 쓰면 곧바로 폐기한다.
 */
export async function PATCH(req: Request) {
  try {
    let body: { token?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }

    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
      return NextResponse.json({ ok: false, error: "토큰이 필요합니다." }, { status: 400 });
    }

    await connectDB();
    const user = await getUserModel().findOne({ withdrawToken: token }).exec();
    if (!user || !withdrawTokenValid(user, token)) {
      return NextResponse.json(
        { ok: false, error: "링크가 만료되었거나 올바르지 않습니다. 다시 신청해 주세요." },
        { status: 400 },
      );
    }

    const now = new Date();
    user.withdrawnAt = now;
    /* 한 번 쓰면 폐기한다 */
    user.withdrawToken = undefined;
    user.withdrawTokenExpires = undefined;
    await user.save();

    return NextResponse.json({
      ok: true,
      withdrawnAt: now.toISOString(),
      purgeAt: purgeDueAt(now).toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * 되살린다. 보관 기간이 지났으면 거절한다 — 이미 폐기 대상이다.
 *
 * 정리 작업이 아직 돌지 않아 문서가 남아 있을 수 있는데, 그 틈에 되살리면
 * 방침에 적은 기간보다 오래 쓰게 된다. 남아 있느냐가 아니라 **기간**으로 가른다.
 */
export async function DELETE(req: Request) {
  try {
    const auth = await requireSessionUser(req, { allowWithdrawn: true });
    if ("error" in auth) return auth.error;
    const { user } = auth;

    if (!user.withdrawnAt) {
      return NextResponse.json({ ok: true, restored: true, alreadyActive: true });
    }
    if (!canRestore(user)) {
      return NextResponse.json(
        { ok: false, error: "되살릴 수 있는 기간이 지났습니다." },
        { status: 410 },
      );
    }

    user.withdrawnAt = null;
    await user.save();

    return NextResponse.json({ ok: true, restored: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
