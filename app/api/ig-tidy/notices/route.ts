import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { activeNotices, migrateLegacyNotice, requireIgTidyUser } from "@/lib/igTidy";

export const runtime = "nodejs";

/**
 * 공지 게시판 — IG Tidy 앱이 읽는다(2026-11-08).
 *
 *   GET → { ok, notices: [{ id, title, body, level, publishedAt }] }   켜진 것만 · 최근부터 · 20개까지
 *
 * level 은 info(알림) · important(중요). 앱은 publishedAt 으로 「새 공지」 를 가린다.
 * 예전 앱은 이 주소를 모르고 /api/ig-tidy/me 의 settings.notice 한 줄을 본다 → lib/igTidy.ts noticeCompat
 */
export async function GET(req: Request) {
  const auth = await requireIgTidyUser(req);
  if ("error" in auth) return auth.error;
  try {
    await connectDB();
    await migrateLegacyNotice();
    const notices = (await activeNotices(20)).map(({ id, title, body, level, publishedAt }) => ({ id, title, body, level, publishedAt }));
    return NextResponse.json({ ok: true, notices });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ ok: false, error: `공지를 불러오지 못했어요: ${message}` }, { status: 500 });
  }
}
