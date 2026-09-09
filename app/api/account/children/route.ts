import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { createChild, familyFollow, listChildren, MAX_CHILDREN, validateChildInput } from "@/lib/family";
import { requireSessionUser } from "@/lib/serverSession";

export const runtime = "nodejs";

/**
 * 자녀 프로필 — 목록(GET) · 추가(POST). **보호자 세션만** 된다 (자녀 세션은 requireSessionUser 가 403).
 * → lib/family.ts · my-obsidian-vault / 50-Plans/F 보호자·자녀 계정.md
 */
function view(c: Awaited<ReturnType<typeof listChildren>>[number]) {
  return {
    id: String(c._id),
    name: c.nickname ?? c.name ?? "",
    userId: c.userId ?? null,
    birthYear: c.birthYear ?? null,
    consents: {
      guardian: Boolean(c.guardianAgreedAt),
      health: Boolean(c.healthDataAgreedAt),
      overseas: Boolean(c.overseasTransferAgreedAt),
    },
    /* 독립 진행 중 — 인증 메일을 기다리는 주소 */
    pendingEmail: c.independenceOnVerify ? (c.pendingEmail ?? null) : null,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : null,
  };
}

export async function GET(req: Request) {
  try {
    const auth = await requireSessionUser(req);
    if ("error" in auth) return auth.error;
    await connectDB();
    const children = await listChildren(auth.user._id);
    return NextResponse.json({ ok: true, max: MAX_CHILDREN, children: children.map(view) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireSessionUser(req);
    if ("error" in auth) return auth.error;
    const guardian = auth.user;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }
    const parsed = validateChildInput(body);
    if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    if (!parsed.value.consents.guardian) {
      return NextResponse.json(
        { ok: false, error: "법정대리인으로서 자녀 정보 처리에 동의해 주셔야 자녀를 추가할 수 있어요." },
        { status: 400 },
      );
    }

    await connectDB();
    const child = await createChild(guardian, parsed.value);

    /* 2hbk 가족 팔로우 — 실패해도 자녀 추가는 성공이다 */
    const all = await listChildren(guardian._id);
    const followed = await familyFollow([guardian.userId ?? "", ...all.map((c) => c.userId ?? "")]);

    return NextResponse.json({ ok: true, child: view(child as unknown as Awaited<ReturnType<typeof listChildren>>[number]), followed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    const status = /까지 추가할 수 있어요/.test(message) ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
