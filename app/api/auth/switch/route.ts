import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getSessionClaims } from "@/lib/serverSession";
import { getUserModel } from "@/models/User";
import { issueProfileSession } from "@/lib/profileSession";

export const runtime = "nodejs";

/**
 * 로그인한 상태에서 **프로필을 바꾼다.**
 *
 *   보호자 세션 → 자녀          그대로 된다 (기기의 주인은 보호자다)
 *   자녀 세션   → 보호자·형제    **보호자 비밀번호**를 다시 받는다 — 자녀가 부모의 기록을 열 수 없어야 한다
 *
 * GET 은 고를 수 있는 프로필 목록. → my-obsidian-vault / 50-Plans/F 보호자·자녀 계정.md
 */
export async function GET(req: Request) {
  try {
    const claims = getSessionClaims(req);
    if (!claims) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
    await connectDB();
    const User = getUserModel();
    const guardianId = claims.gid ?? claims.uid;
    const guardian = await User.findById(guardianId, { name: 1, nickname: 1, sessionVersion: 1 }).lean().exec();
    if (!guardian) return NextResponse.json({ ok: false, error: "계정을 찾을 수 없습니다." }, { status: 404 });
    const children = await User.find(
      { parentId: guardian._id, independentAt: null, withdrawnAt: null },
      { name: 1, nickname: 1 },
    ).sort({ createdAt: 1 }).lean().exec();
    return NextResponse.json({
      ok: true,
      current: claims.uid,
      isChild: Boolean(claims.gid),
      profiles: [
        { id: String(guardian._id), name: guardian.nickname ?? guardian.name ?? "본인", kind: "self" },
        ...children.map((c) => ({ id: String(c._id), name: c.nickname ?? c.name ?? "", kind: "child" })),
      ],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const claims = getSessionClaims(req);
    if (!claims) return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });

    let body: { profileId?: unknown; password?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }
    const profileId = typeof body.profileId === "string" ? body.profileId : "";
    if (!mongoose.isValidObjectId(profileId)) {
      return NextResponse.json({ ok: false, error: "프로필을 골라 주세요." }, { status: 400 });
    }

    await connectDB();
    const User = getUserModel();
    const guardianId = claims.gid ?? claims.uid;
    const guardian = await User.findById(guardianId).exec();
    if (!guardian || guardian.withdrawnAt) {
      return NextResponse.json({ ok: false, error: "계정을 찾을 수 없습니다." }, { status: 404 });
    }
    /* 세션 버전이 맞는 살아 있는 세션인지 — 보호자 세션이면 보호자 문서, 자녀 세션이면 자녀 문서 기준 */
    const current = claims.gid ? await User.findById(claims.uid, { sessionVersion: 1 }).lean().exec() : guardian;
    if (!current || (claims.sv ?? 0) !== (current.sessionVersion ?? 0)) {
      return NextResponse.json({ ok: false, error: "다시 로그인해 주세요." }, { status: 401 });
    }

    if (claims.gid) {
      const password = typeof body.password === "string" ? body.password : "";
      if (!guardian.password || !password || !(await bcrypt.compare(password, guardian.password))) {
        return NextResponse.json(
          { ok: false, needsPassword: true, error: "보호자 비밀번호를 입력해 주세요." },
          { status: 401 },
        );
      }
    }

    if (profileId === String(guardian._id)) return issueProfileSession(req, guardian, null);

    const child = await User.findOne({ _id: profileId, parentId: guardian._id, independentAt: null, withdrawnAt: null }).exec();
    if (!child) return NextResponse.json({ ok: false, error: "이 계정의 자녀 프로필이 아닙니다." }, { status: 404 });
    return issueProfileSession(req, child, guardian);
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
