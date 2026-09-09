import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { canRestore, restoreDaysLeft } from "@/lib/accountLifecycle";
import { connectDB } from "@/lib/db";
import { parseIdentifier } from "@/lib/identifier";
import { checkThrottle, clearThrottle, hitThrottle, throttleKeys } from "@/lib/loginThrottle";
import { listChildren, signPickToken } from "@/lib/family";
import { issueProfileSession } from "@/lib/profileSession";
import { getUserModel, type UserDocument } from "@/models/User";

export const runtime = "nodejs";

/** 2hbk 도메인 식별자 — 목표·팔로우·초대가 이 값을 참조한다 */
function newUserId(): string {
  return `user_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * 통합 로그인.
 *
 * **이메일이든 전화번호든, 비밀번호든 PIN이든** 맞으면 들어온다.
 * 원래는 전화번호+PIN만 받았고 2hbk용으로 이메일+비밀번호 라우트를 따로 뒀는데,
 * 사람에게 "당신은 어느 쪽 회원이냐"를 묻는 것이 이상해서 하나로 합쳤다.
 *
 * 예전 본문 형식(`{phone, pin}` · `{email, password}`)도 그대로 받는다.
 * 각 앱의 로컬 개발용 로그인 화면이 그 형식으로 부른다.
 */
export async function POST(req: Request) {
  try {
    let body: {
      identifier?: string;
      secret?: string;
      phone?: string;
      pin?: string;
      email?: string;
      password?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }

    const identifierRaw = body.identifier ?? body.email ?? body.phone ?? "";
    const secret = body.secret ?? body.password ?? body.pin ?? "";

    if (!identifierRaw || !secret) {
      return NextResponse.json(
        { ok: false, error: "이메일 또는 전화번호와 비밀번호를 입력해 주세요." },
        { status: 400 },
      );
    }

    const id = parseIdentifier(identifierRaw);
    if (id.kind === "unknown") {
      return NextResponse.json(
        { ok: false, error: "이메일 형식이 아닙니다." },
        { status: 400 },
      );
    }
    /*
      2026-09-09 부터 로그인은 **이메일로만** 된다(사용자 결정). 전화번호+PIN 계정은
      /migrate 에서 이메일 계정으로 전환한 뒤 들어온다. 서버에서 막지 않으면 화면 문구만 바뀐 셈이다.
    */
    if (id.kind === "phone") {
      return NextResponse.json(
        {
          ok: false,
          migrate: true,
          error: "이제 이메일로만 로그인할 수 있어요. 전화번호·PIN으로 쓰셨다면 이메일 계정으로 전환해 주세요.",
        },
        { status: 400 },
      );
    }

    await connectDB();
    const User = getUserModel();

    /*
      시도 제한 — 비교 **전에** 본다. 식별자당 5회 · IP 당 30회 / 15분.
      없는 계정도 똑같이 센다. 응답 문장도 아래 401 과 같은 자리에서 나가므로
      계정이 있는지 없는지 이 라우트로는 알 수 없다 → lib/loginThrottle.ts
    */
    const keys = throttleKeys(req, id.email);
    const throttled = await checkThrottle(keys);
    if (throttled) return throttled;

    const candidates = await User.find({ email: id.email }).exec();

    // 계정마다 비밀번호와 PIN 중 있는 것으로 맞춰 본다.
    // 한 사람이 둘 다 가진 경우(이메일이 겹쳐 병합한 계정)는 어느 쪽이든 통과한다
    const matches: UserDocument[] = [];
    for (const u of candidates) {
      const hashes = [u.password, u.pin].filter((h): h is string => Boolean(h));
      for (const hash of hashes) {
        if (await bcrypt.compare(secret, hash)) {
          matches.push(u);
          break;
        }
      }
    }

    if (matches.length === 0) {
      await hitThrottle(keys);
      return NextResponse.json(
        { ok: false, error: "아이디 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 },
      );
    }

    if (matches.length > 1) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "같은 전화번호로 여러 계정이 있습니다. 계정마다 다른 비밀번호를 쓰거나 이메일로 로그인해 주세요.",
        },
        { status: 409 },
      );
    }

    const user = matches[0];

    /*
      탈퇴한 계정이다.

      비밀번호는 맞았으므로 **본인이다.** 그래서 "틀렸다" 가 아니라 탈퇴 상태임을
      알리고 되살릴 길을 안내한다. 세션은 내주지 않는다 — 되살리기 화면만
      쓸 수 있어야 한다.

      보관 기간이 지났으면 되살릴 수 없다. 정리 작업이 아직 돌지 않아 문서가
      남아 있을 뿐이라 남아 있느냐가 아니라 **기간**으로 가른다.
      → lib/accountLifecycle.ts · app/api/cron/purge
    */
    if (user.withdrawnAt) {
      const left = restoreDaysLeft(user);
      return NextResponse.json(
        {
          ok: false,
          withdrawn: true,
          canRestore: canRestore(user),
          restoreDaysLeft: left,
          error: canRestore(user)
            ? `탈퇴한 계정입니다. ${left}일 안에는 계정을 되살릴 수 있어요.`
            : "탈퇴한 계정입니다. 되살릴 수 있는 기간이 지났습니다.",
        },
        { status: 403 },
      );
    }

    /*
      `userId`가 없으면 지금 만들어 준다.

      2hbk의 목표·팔로우·초대가 이 값을 참조하고, 세션 서명 토큰도 이 값을 담는다.
      옛 계정(전화번호+PIN으로만 가입)에는 없어서, 없으면 2hbk를 쓸 수 없었다.
      로그인 한 번으로 조용히 채워 준다.
    */
    if (!user.userId) user.userId = newUserId();
    user.lastLoginAt = new Date();
    await user.save();
    await clearThrottle(keys);

    /*
      자녀 프로필이 있으면 세션을 바로 내주지 않고 **누구로 들어갈지** 고르게 한다.
      5분짜리 pickToken 을 주고 /api/auth/pick-profile 이 세션을 발급한다 → lib/family.ts
    */
    const children = await listChildren(user._id);
    if (children.length > 0) {
      return NextResponse.json({
        ok: true,
        choose: true,
        pickToken: signPickToken(String(user._id)),
        profiles: [
          { id: String(user._id), name: user.nickname ?? user.name ?? "본인", kind: "self" },
          ...children.map((c) => ({ id: String(c._id), name: c.nickname ?? c.name ?? "", kind: "child" })),
        ],
      });
    }

    /* 토큰은 HttpOnly 쿠키로만 내린다 — 응답 본문에 넣지 않는다 → lib/profileSession.ts */
    return issueProfileSession(req, user, null);
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
