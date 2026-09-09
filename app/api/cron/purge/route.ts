import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { WITHDRAW_RETENTION_DAYS } from "@/lib/accountLifecycle";
import { purgeUserAcrossApps } from "@/lib/family";
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
 * 앱 데이터(단어장·오답노트·검사 기록)와 R2 파일은 각 앱의
 * `/api/admin/purge-user` 를 불러 치운다. 포털이 앱 DB 를 직접 읽지 않는
 * 통합 admin 규칙을 그대로 따른다.
 *
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */

/**
 * 앱 데이터를 치울 곳.
 *
 * 주소는 환경 변수로 둔다 — 미리보기 배포에서 운영 데이터를 지우면 안 된다.
 * 변수가 없으면 그 앱은 **건너뛴다.** 지울 곳을 짐작하지 않는다.
 *
 * ⚠️ **앱마다 사용자를 가리키는 키가 다르다.** 실측한 값이다 (2026-09-08).
 *   SnapWord · SnapNote   회원 Mongo `_id` (ObjectId 로 변환해 쓴다)
 *   FitLog · TypeLog      회원 Mongo `_id` 의 **문자열**
 *   2hbk                  도메인 식별자 `userId` (`user_xxx`)
 * 그래서 각 줄이 무엇을 받는지(`sends`)를 함께 적는다. 하나로 뭉뚱그리면
 * 한쪽이 **조용히 안 지워진다.**
 */
/* 앱별 정리 대상과 호출은 lib/family.ts 의 purgeUserAcrossApps 로 옮겼다 — 자녀 프로필 삭제와 같이 쓴다 */

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
      보호자가 폐기되면 **그 계정의 자녀 프로필도** 함께 폐기한다. 자녀는 스스로 탈퇴하지 않고
      보호자에 딸려 있다 → lib/family.ts
    */
    const children = await User.find(
      { parentId: { $in: doomed.map((d) => d._id) }, independentAt: null },
      { _id: 1, userId: 1 },
    ).lean().exec();
    const targets = [...doomed, ...children];

    /*
      회원 문서를 지우기 **전에** 각 앱의 데이터를 치운다.

      포털은 앱 DB 를 직접 읽지 않는다 — 통합 admin 과 같은 규칙이다.
      각 앱의 `/api/admin/purge-user` 를 부르고, 인증은 공유 비밀 하나다.

      ⚠️ 앱 정리가 실패해도 **회원 문서는 지운다.** 여기서 멈추면 그 사람은
      영원히 폐기되지 않는다 — 방침에 적은 6개월이 지켜지지 않는다.
      실패는 로그로 남기고 다음에 손으로 치운다.
    */
    const apps: Record<string, Record<string, string>> = {};
    for (const d of targets) {
      apps[d.userId ?? String(d._id)] = await purgeUserAcrossApps({ id: String(d._id), userId: d.userId });
    }

    const ids = targets.map((d) => d._id);
    const result = await User.deleteMany({ _id: { $in: ids } }).exec();

    console.log(
      `[purge] ${result.deletedCount}건 폐기 (기준 ${cutoff.toISOString()}) ` +
        targets.map((d) => d.userId ?? String(d._id)).join(","),
    );

    return NextResponse.json({
      ok: true,
      purged: result.deletedCount,
      children: children.length,
      apps,
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
