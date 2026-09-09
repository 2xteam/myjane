import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { issueEmailToken, normalizeEmail, remainingCooldownMs } from "@/lib/emailVerification";
import { INDEPENDENCE_AGE, minAge } from "@/lib/family";
import { passwordProblem } from "@/lib/password";
import { requireSessionUser } from "@/lib/serverSession";
import { getUserModel } from "@/models/User";

export const runtime = "nodejs";

/**
 * 자녀 **독립** — 만 14세부터. 보호자가 자녀의 이메일·비밀번호를 등록하면 인증 메일이 가고,
 * 링크를 누르면(`/api/auth/verify-email`) `parentId` 가 풀려 자기 이메일로 로그인하는 일반 계정이 된다.
 * 기록은 그대로다 — 문서가 같으니 소유자 키가 바뀌지 않는다.
 *
 * 나이는 출생연도로만 안다. 올해 생일이 지났는지 모르므로 `올해 - 출생연도 - 1 ≥ 14` 로 보수적으로 본다.
 * → lib/family.ts · my-obsidian-vault / 50-Plans/F 보호자·자녀 계정.md
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSessionUser(req);
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ ok: false, error: "자녀 프로필을 찾을 수 없습니다." }, { status: 404 });

    let body: { email?: unknown; password?: unknown; passwordConfirm?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }
    const email = normalizeEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    const passwordConfirm = typeof body.passwordConfirm === "string" ? body.passwordConfirm : password;
    if (!email) return NextResponse.json({ ok: false, error: "이메일 형식이 올바르지 않습니다." }, { status: 400 });
    const problem = passwordProblem(password);
    if (problem) return NextResponse.json({ ok: false, error: problem }, { status: 400 });
    if (password !== passwordConfirm) return NextResponse.json({ ok: false, error: "입력한 두 비밀번호가 일치하지 않습니다." }, { status: 400 });

    await connectDB();
    const User = getUserModel();
    const child = await User.findOne({ _id: id, parentId: auth.user._id, independentAt: null, withdrawnAt: null }).exec();
    if (!child) return NextResponse.json({ ok: false, error: "자녀 프로필을 찾을 수 없습니다." }, { status: 404 });

    const age = minAge(child.birthYear);
    if (age === null) {
      return NextResponse.json({ ok: false, error: "출생연도를 먼저 입력해 주세요. 나이를 확인해야 독립할 수 있어요." }, { status: 400 });
    }
    if (age < INDEPENDENCE_AGE) {
      return NextResponse.json({ ok: false, error: `만 ${INDEPENDENCE_AGE}세부터 독립할 수 있어요.` }, { status: 400 });
    }

    const taken = await User.findOne({ _id: { $ne: child._id }, $or: [{ email }, { pendingEmail: email }] }).exec();
    if (taken) return NextResponse.json({ ok: false, error: "이미 다른 계정이 사용하는 이메일입니다." }, { status: 409 });

    if (remainingCooldownMs(child) > 0) {
      return NextResponse.json({ ok: false, error: "인증 메일을 방금 보냈어요. 잠시 후 다시 시도해 주세요." }, { status: 429 });
    }

    try {
      await issueEmailToken(child, email);
    } catch (e) {
      console.error("[independence] 인증 메일 발송 실패", e);
      return NextResponse.json({ ok: false, error: "인증 메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 502 });
    }

    child.pendingEmail = email;
    child.password = await bcrypt.hash(password, 10);
    child.passwordChangedAt = new Date();
    child.independenceOnVerify = true;
    await child.save();

    return NextResponse.json({ ok: true, pendingEmail: email });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
