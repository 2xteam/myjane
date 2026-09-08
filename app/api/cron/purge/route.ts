import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { WITHDRAW_RETENTION_DAYS } from "@/lib/accountLifecycle";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";
/* 지울 것이 많은 날이 있다. 기본 10초로는 모자란다 */
export const maxDuration = 60;

/**
 * 탈퇴한 지 보관 기간이 지난 계정을 **실제로 지운다.**
 *
 * 방침 5항에 "6개월 동안 보관한 뒤 폐기" 라고 적어 공개했다. 지우는 장치가
 * 없으면 그 문구가 거짓말이 된다. 이 라우트가 그 약속을 지키는 자리다.
 *
 * 하루 한 번 Vercel Cron 이 부른다 → vercel.json 의 `crons`
 *
 * ⚠️ **앱 데이터는 여기서 지우지 못한다.** 회원 문서는 포털이 갖고 있지만
 * 단어장·오답노트·검사 기록은 각 앱 DB 에 있고, 결과지 사진은 R2 에 있다.
 * 그 정리는 각 앱이 해야 한다 — 아래 "남은 것" 참고.
 *
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */

/**
 * 앱 데이터를 치울 곳.
 *
 * 주소는 환경 변수로 둔다 — 미리보기 배포에서 운영 데이터를 지우면 안 된다.
 * 변수가 없으면 그 앱은 **건너뛴다.** 지울 곳을 짐작하지 않는다.
 *
 * ⚠️ 지금 `/api/admin/purge-user` 가 있는 곳은 2hbk 뿐이다. 나머지 앱은
 * 그 라우트를 만들면 여기에 한 줄씩 더한다.
 */
const PURGE_TARGETS = [{ key: "2hbk", env: "APP_2HBK_ORIGIN" }] as const;

/**
 * Vercel Cron 인지 확인한다.
 *
 * Vercel 은 크론 요청에 `Authorization: Bearer <CRON_SECRET>` 을 붙인다.
 * 이 라우트는 계정을 **영구 삭제**하므로 아무나 부르게 두면 안 된다.
 * `CRON_SECRET` 이 없으면 아예 돌지 않는다 — 열어 두는 것보다 안 도는 편이 낫다.
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 이 필요합니다." },
      { status: 401 },
    );
  }

  try {
    await connectDB();
    const User = getUserModel();

    const cutoff = new Date(Date.now() - WITHDRAW_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    /*
      먼저 **세어 보고 목록을 남긴 뒤** 지운다.
      지우고 나면 무엇을 지웠는지 확인할 길이 없다.
    */
    const doomed = await User.find(
      { withdrawnAt: { $ne: null, $lte: cutoff } },
      { _id: 1, userId: 1, withdrawnAt: 1 },
    )
      .limit(500)
      .lean()
      .exec();

    if (doomed.length === 0) {
      return NextResponse.json({ ok: true, purged: 0, cutoff: cutoff.toISOString() });
    }

    /*
      회원 문서를 지우기 **전에** 각 앱의 데이터를 치운다.

      포털은 앱 DB 를 직접 읽지 않는다 — 통합 admin 과 같은 규칙이다.
      각 앱의 `/api/admin/purge-user` 를 부르고, 인증은 공유 비밀 하나다.

      ⚠️ 앱 정리가 실패해도 **회원 문서는 지운다.** 여기서 멈추면 그 사람은
      영원히 폐기되지 않는다 — 방침에 적은 6개월이 지켜지지 않는다.
      실패는 로그로 남기고 다음에 손으로 치운다.
    */
    for (const d of doomed) {
      if (!d.userId) continue;
      for (const app of PURGE_TARGETS) {
        const base = process.env[app.env];
        if (!base) continue;
        try {
          const res = await fetch(`${base.replace(/\/+$/, "")}/api/admin/purge-user`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${process.env.ADMIN_API_SECRET ?? ""}`,
            },
            body: JSON.stringify({ userId: d.userId }),
          });
          if (!res.ok) {
            console.error(`[purge] ${app.key} 정리 실패 ${res.status} — ${d.userId}`);
          }
        } catch (e) {
          console.error(`[purge] ${app.key} 정리 실패 — ${d.userId}`, e);
        }
      }
    }

    const ids = doomed.map((d) => d._id);
    const result = await User.deleteMany({ _id: { $in: ids } }).exec();

    console.log(
      `[purge] ${result.deletedCount}건 폐기 (기준 ${cutoff.toISOString()}) ` +
        doomed.map((d) => d.userId ?? String(d._id)).join(","),
    );

    return NextResponse.json({
      ok: true,
      purged: result.deletedCount,
      cutoff: cutoff.toISOString(),
      /* 한 번에 500건까지만 본다. 남으면 다음 날 이어서 지운다 */
      more: doomed.length === 500,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    console.error("[purge] 실패:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
