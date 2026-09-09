import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { SESSION_KEY } from "@/lib/session";
import { verifySessionToken, type TokenClaims } from "@/lib/sessionToken";
import { readSessionTokenFromRequest } from "@/lib/sessionCookie";
import { getUserModel, type UserDocument } from "@/models/User";

/**
 * 라우트에서 "지금 요청을 보낸 사람"을 확인한다.
 *
 * `snap_user` 쿠키의 본문은 **클라이언트가 마음대로 쓸 수 있는 평문 JSON**이다.
 * 그래서 그 안의 `id`나 요청 본문의 `phone`·`userId` 를 그대로 믿으면 아무나
 * 남의 계정을 건드릴 수 있다. 같은 쿠키의 HMAC 서명 토큰만 신뢰한다.
 *
 * `lib/adminAuth.ts` 가 admin 용으로 먼저 쓰던 방식을 그대로 꺼냈다.
 * admin 이 아닌 일반 회원 동작(이메일 등록·인증 재발송)도 같은 확인이 필요하다.
 *
 * → my-obsidian-vault / 30-Patterns/인증과 세션 공유.md 의 "쿠키의 id를 믿지 않는다"
 */

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  const prefix = name + "=";
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(prefix)) continue;
    try {
      return decodeURIComponent(trimmed.slice(prefix.length));
    } catch {
      return null;
    }
  }
  return null;
}

/** `Authorization: Bearer …` 를 먼저 보고, 없으면 세션 쿠키의 `token` 을 꺼낸다 */
export function readSessionToken(req: Request): string | null {
  return readSessionTokenFromRequest(req);
}

/** 서명이 유효하면 토큰의 내용. `gid` 가 있으면 자녀 프로필 세션이다 → lib/family.ts */
export function getSessionClaims(req: Request): TokenClaims | null {
  return verifySessionToken(readSessionTokenFromRequest(req));
}

/** 서명이 유효한 세션이 가리키는 회원 문서. 없으면 `null` */
export async function getSessionUser(req: Request): Promise<UserDocument | null> {
  const claims = verifySessionToken(readSessionTokenFromRequest(req));
  if (!claims) return null;

  await connectDB();
  const doc = await getUserModel().findOne({ userId: claims.u }).exec();
  if (!doc) return null;
  /*
    세션 버전이 다르면 폐기된 토큰이다 (비밀번호 변경·탈퇴·모든 기기 로그아웃).
    `sv` 가 없는 옛 토큰은 아직 한 번도 올리지 않은 계정(0)에서만 통한다.
  */
  if ((claims.sv ?? 0) !== (doc.sessionVersion ?? 0)) return null;
  return doc;
}

/**
 * 로그인이 필요한 라우트에서 쓴다. 확인되지 않으면 401 응답을 돌려준다.
 *
 * ⚠️ 전화번호+PIN 으로 만든 옛 세션에는 토큰이 없을 수 있다. 그때는 여기서
 * 401 이 나가고 화면이 다시 로그인하도록 안내해야 한다 — 조용히 통과시키면
 * 처음에 이 토큰을 도입한 이유가 사라진다.
 */
export async function requireSessionUser(
  req: Request,
  options: {
    /**
     * 탈퇴한 계정도 통과시킨다.
     *
     * **탈퇴·되살리기 라우트에서만 쓴다.** 되살리려면 그 계정으로 들어와야
     * 하는데 기본값으로 막으면 스스로 되돌릴 길이 없어진다.
     */
    allowWithdrawn?: boolean;
    /**
     * 자녀 프로필 세션도 통과시킨다.
     *
     * 기본은 **막는다(403).** 계정 설정(탈퇴·동의·이메일·비밀번호·자녀 관리)은 보호자만 한다.
     * 자녀 세션에서 부르면 부모 계정을 바꾸는 사고가 난다 → lib/family.ts
     */
    allowChild?: boolean;
  } = {},
): Promise<{ user: UserDocument } | { error: NextResponse }> {
  const claims = getSessionClaims(req);
  if (claims?.gid && !options.allowChild) {
    return {
      error: NextResponse.json(
        { ok: false, child: true, error: "자녀 프로필에서는 할 수 없어요. 보호자 프로필로 전환해 주세요." },
        { status: 403 },
      ),
    };
  }

  const user = await getSessionUser(req);
  if (!user) {
    return {
      error: NextResponse.json(
        { ok: false, error: "로그인이 필요합니다. 다시 로그인해 주세요." },
        { status: 401 },
      ),
    };
  }

  /*
    탈퇴한 계정은 **기본적으로 막는다.** 여기 한 곳에서 막아야 여섯 앱의
    모든 라우트가 함께 닫힌다. 라우트마다 검사하게 두면 반드시 빠뜨린다.
    → lib/accountLifecycle.ts
  */
  if (user.withdrawnAt && !options.allowWithdrawn) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          error: "탈퇴한 계정입니다. 되살리시려면 myjane 에서 계정을 복구해 주세요.",
          withdrawn: true,
        },
        { status: 403 },
      ),
    };
  }

  return { user };
}
