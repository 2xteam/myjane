import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { adminError, requireAdmin } from "@/lib/adminAuth";
import { listShareLinks, parseShareLinkBody } from "@/lib/shareLinks";
import { getShareLinkModel } from "@/models/ShareLink";

export const runtime = "nodejs";

/**
 * 공유형 링크 관리 — 목록(GET) · 등록(POST). 운영자·마스터 모두 할 수 있다.
 * 공개 화면은 `/share` (app/share/page.tsx) 가 같은 컬렉션의 켜진 것만 읽는다.
 * → lib/shareLinks.ts · models/ShareLink.ts
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  try {
    await connectDB();
    return NextResponse.json({ ok: true, links: await listShareLinks() });
  } catch (err) {
    return adminError(err);
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;
  try {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }
    const { out, errors } = parseShareLinkBody(body);
    if (errors.length) return NextResponse.json({ ok: false, error: errors[0] }, { status: 400 });

    await connectDB();
    const ShareLink = getShareLinkModel();
    if (out.order === undefined) {
      const last = await ShareLink.findOne({}).sort({ order: -1 }).lean().exec();
      out.order = (last?.order ?? -1) + 1;
    }
    await ShareLink.create({ ...out, updatedAt: new Date() });
    return NextResponse.json({ ok: true, links: await listShareLinks() });
  } catch (err) {
    return adminError(err);
  }
}
