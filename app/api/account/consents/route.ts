import { NextResponse } from "next/server";
import { CONSENT_KINDS, consentField, hasConsent, isConsentKind } from "@/lib/consents";
import { POLICY_VERSION } from "@/lib/legalVersion";
import { requireSessionUser } from "@/lib/serverSession";

export const runtime = "nodejs";

/**
 * 분리 동의의 상태를 묻고(GET), 동의를 기록한다(POST).
 *
 * 동의 여부는 여섯 앱이 공유하는 `users` 에 있으므로 **각 앱은 자기 User 모델로
 * 직접 읽는다.** 이 라우트는 포털의 동의 화면이 쓰는 자리다.
 *
 * ⚠️ **철회도 받는다(DELETE).** 동의는 언제든 거둘 수 있어야 한다. 거두면
 * 그 기능만 막히고 나머지는 그대로다 → lib/consents.ts
 */
export async function GET(req: Request) {
  try {
    const auth = await requireSessionUser(req);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    return NextResponse.json({
      ok: true,
      policyVersion: POLICY_VERSION,
      consents: Object.fromEntries(
        CONSENT_KINDS.map((k) => [
          k,
          {
            agreed: hasConsent(user, k),
            at: (user[consentField(k)] as Date | null)?.toISOString() ?? null,
          },
        ]),
      ),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** 동의한다. `{ kind: "health" | "overseas" | "guardian" }` */
export async function POST(req: Request) {
  try {
    const auth = await requireSessionUser(req);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    let body: { kind?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "JSON 본문이 필요합니다." }, { status: 400 });
    }

    if (!isConsentKind(body.kind)) {
      return NextResponse.json(
        { ok: false, error: "동의 종류가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const now = new Date();
    /* 이미 동의한 것을 다시 눌러도 시각을 덮어쓰지 않는다 — 처음 받은 때가 기록이다 */
    if (!hasConsent(user, body.kind)) {
      user.set(consentField(body.kind), now);
      await user.save();
    }

    return NextResponse.json({ ok: true, kind: body.kind, agreed: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * 동의를 철회한다. `{ kind }`
 *
 * ⚠️ **이미 저장된 기록을 지우지는 않는다.** 철회는 "앞으로 처리하지 말라"는
 * 뜻이고, 지우는 것은 삭제 요청이다. 둘을 한 버튼에 묶으면 철회를 누른 사람이
 * 기록이 사라진 것을 나중에 알게 된다. 화면에서 그렇게 안내한다.
 */
export async function DELETE(req: Request) {
  try {
    const auth = await requireSessionUser(req);
    if ("error" in auth) return auth.error;
    const { user } = auth;

    const kind = new URL(req.url).searchParams.get("kind");
    if (!isConsentKind(kind)) {
      return NextResponse.json(
        { ok: false, error: "동의 종류가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    user.set(consentField(kind), null);
    await user.save();

    return NextResponse.json({ ok: true, kind, agreed: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
