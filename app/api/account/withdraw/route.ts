import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { canRestore, purgeDueAt, restoreDaysLeft } from "@/lib/accountLifecycle";
import { requireSessionUser } from "@/lib/serverSession";

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
 * 탈퇴한다.
 *
 * ⚠️ **비밀번호(또는 PIN)를 다시 받는다.** 세션만으로 처리하면 남의 브라우저를
 * 잠깐 만진 사람이 계정을 닫을 수 있다. 되돌릴 수는 있지만 6개월 안에
 * 알아차려야 하고, 그 사이 여섯 앱이 전부 막힌다.
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

    /*
      "탈퇴합니다" 를 직접 치게 한다. 버튼 하나로 끝나면 잘못 누른다.
      비밀번호 확인과 **둘 다** 받는다.
    */
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

    const now = new Date();
    user.withdrawnAt = now;
    await user.save();

    return NextResponse.json({
      ok: true,
      withdrawnAt: now.toISOString(),
      purgeAt: purgeDueAt(now).toISOString(),
      restoreDaysLeft: restoreDaysLeft(user),
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
