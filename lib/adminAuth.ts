import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { SESSION_KEY } from "@/lib/session";
import { verifySessionToken } from "@/lib/sessionToken";
import { getUserModel, type UserDocument } from "@/models/User";

/**
 * 통합 admin 접근 권한 확인.
 *
 * `snap_user` 쿠키의 본문은 클라이언트가 마음대로 쓸 수 있으므로 **믿지 않는다.**
 * 같은 쿠키의 HMAC 서명 토큰만 신뢰하고, 그 토큰이 가리키는 회원의 `adminRole`을 본다.
 *
 * 예전 각 앱의 admin은 **소스에 박힌 PIN을 쿼리스트링으로** 검사했다
 * (`?pin=1956`). 공개 저장소에 값이 있고 URL이라 로그에도 남았다. 그 방식은 버렸다.
 * → my-obsidian-vault / 30-Patterns/인증과 세션 공유.md
 */

export type AdminRole = "master" | "operator";

export type Admin = {
  doc: UserDocument;
  role: AdminRole;
};

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

function readToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();

  const raw = readCookie(req, SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { token?: unknown };
    return typeof parsed.token === "string" ? parsed.token : null;
  } catch {
    return null;
  }
}

export async function getAdmin(req: Request): Promise<Admin | null> {
  const claims = verifySessionToken(readToken(req));
  if (!claims) return null;

  await connectDB();
  const doc = await getUserModel().findOne({ userId: claims.u }).exec();
  if (!doc) return null;

  const role = doc.adminRole;
  if (role !== "master" && role !== "operator") return null;

  return { doc, role };
}

/**
 * admin 라우트에서 쓴다. 권한이 없으면 응답을 돌려준다.
 * `master: true` 를 주면 마스터만 통과한다(권한 관리처럼 되돌리기 어려운 동작).
 */
export async function requireAdmin(
  req: Request,
  options: { master?: boolean } = {},
): Promise<{ admin: Admin } | { error: NextResponse }> {
  const admin = await getAdmin(req);

  if (!admin) {
    return {
      error: NextResponse.json(
        { ok: false, error: "관리자 권한이 필요합니다." },
        { status: 403 },
      ),
    };
  }

  if (options.master && admin.role !== "master") {
    return {
      error: NextResponse.json(
        { ok: false, error: "마스터만 할 수 있는 작업입니다." },
        { status: 403 },
      ),
    };
  }

  return { admin };
}

export function adminError(err: unknown) {
  const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}
