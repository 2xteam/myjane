import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { verifyPickToken } from "@/lib/family";
import { issueProfileSession } from "@/lib/profileSession";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

/**
 * 로그인 직후 **어느 프로필로 들어갈지** 고른다 (보호자 본인 / 자녀).
 *
 * `/api/auth/login` 이 자녀가 있는 계정에는 세션을 바로 내주지 않고 5분짜리 `pickToken` 을 준다.
 * 여기서 그 토큰과 `profileId` 를 받아 세션을 발급한다. 자녀면 토큰에 `gid`(보호자)가 실린다.
 * → lib/family.ts · my-obsidian-vault / 50-Plans/F 보호자·자녀 계정.md
 */
export async function POST(req: Request) {
  try {
    let body: { pickToken?: unknown; profileId?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }
    const uid = verifyPickToken(body.pickToken);
    if (!uid) {
      return NextResponse.json({ ok: false, error: "선택 시간이 지났어요. 다시 로그인해 주세요." }, { status: 401 });
    }
    const profileId = typeof body.profileId === "string" ? body.profileId : "";
    if (!mongoose.isValidObjectId(profileId)) {
      return NextResponse.json({ ok: false, error: "프로필을 골라 주세요." }, { status: 400 });
    }

    await connectDB();
    const User = getUserModel();
    const guardian = await User.findById(uid).exec();
    if (!guardian || guardian.withdrawnAt) {
      return NextResponse.json({ ok: false, error: "계정을 찾을 수 없습니다." }, { status: 404 });
    }

    if (profileId === uid) {
      guardian.lastLoginAt = new Date();
      await guardian.save();
      return issueProfileSession(req, guardian, null);
    }

    const child = await User.findOne({ _id: profileId, parentId: guardian._id, independentAt: null, withdrawnAt: null }).exec();
    if (!child) {
      return NextResponse.json({ ok: false, error: "이 계정의 자녀 프로필이 아닙니다." }, { status: 404 });
    }
    child.lastLoginAt = new Date();
    await child.save();
    return issueProfileSession(req, child, guardian);
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** 소셜 콜백처럼 302 로 온 경우 — 로그인 응답 없이 `?pick=` 토큰만 있다. 프로필 목록을 돌려준다 */
export async function GET(req: Request) {
  try {
    const uid = verifyPickToken(new URL(req.url).searchParams.get("pickToken"));
    if (!uid) return NextResponse.json({ ok: false, error: "선택 시간이 지났어요. 다시 로그인해 주세요." }, { status: 401 });
    await connectDB();
    const User = getUserModel();
    const guardian = await User.findById(uid, { name: 1, nickname: 1 }).lean().exec();
    if (!guardian) return NextResponse.json({ ok: false, error: "계정을 찾을 수 없습니다." }, { status: 404 });
    const children = await User.find({ parentId: guardian._id, independentAt: null, withdrawnAt: null }, { name: 1, nickname: 1 })
      .sort({ createdAt: 1 }).lean().exec();
    return NextResponse.json({
      ok: true,
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
