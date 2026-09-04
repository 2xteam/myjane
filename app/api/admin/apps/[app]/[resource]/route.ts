import { NextResponse } from "next/server";
import { adminError, requireAdmin } from "@/lib/adminAuth";
import { getAdminApp, type AdminFeature } from "@/lib/adminApps";
import { AppAdminError, callAppAdmin } from "@/lib/appAdminApi";

export const runtime = "nodejs";

type Params = { params: Promise<{ app: string; resource: string }> };

/**
 * 각 앱의 `/api/admin/*` 로 넘겨 주는 한 자리.
 *
 * 포털은 **남의 DB를 직접 읽지 않는다.** 스키마와 검증이 그 앱에 남아 있고,
 * 포털은 관리자인지만 확인해 그대로 전달한다. 리소스마다 라우트를 따로 두면
 * 앱 × 기능만큼 파일이 늘어나므로 `[app]/[resource]` 하나로 받는다.
 *
 * 공유 비밀(`ADMIN_API_SECRET`)은 **여기서만** 쓰인다. 브라우저로 내려가지 않는다.
 */

const ALLOWED: AdminFeature[] = ["stats", "notices", "inquiries", "events", "quizzes"];

/**
 * 리소스 이름과 기능 이름이 다른 경우.
 *
 * 질문지의 공개·해제는 `quiz-status` 로 부르는데, 그건 `quizzes` 기능에 딸린
 * 동작이다. 프록시가 한 겹(`[app]/[resource]`)만 넘기므로 앱 쪽에서도 경로를
 * 한 겹으로 두었다 → TypeLog `/api/admin/quiz-status`
 */
const RESOURCE_FEATURE: Record<string, AdminFeature> = {
  "quiz-status": "quizzes",
};

async function resolve(params: Params["params"]) {
  const { app: appKey, resource } = await params;

  const app = getAdminApp(appKey);
  if (!app) {
    return { error: NextResponse.json({ ok: false, error: "알 수 없는 앱입니다." }, { status: 404 }) };
  }

  const feature = RESOURCE_FEATURE[resource] ?? (resource as AdminFeature);

  if (!ALLOWED.includes(feature)) {
    return { error: NextResponse.json({ ok: false, error: "알 수 없는 항목입니다." }, { status: 404 }) };
  }

  // 그 앱이 지원하지 않는 기능이면 앱을 부르지 않는다.
  // 부르면 404가 오는데, 앱이 죽은 것과 구분이 안 된다
  if (!app.features.includes(feature)) {
    return {
      error: NextResponse.json(
        { ok: false, error: `${app.name}에는 아직 없는 기능입니다.` },
        { status: 404 },
      ),
    };
  }

  return { app, resource };
}

function toResponse(err: unknown) {
  if (err instanceof AppAdminError) {
    return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
  }
  return adminError(err);
}

export async function GET(req: Request, { params }: Params) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const target = await resolve(params);
  if ("error" in target) return target.error;

  try {
    // 목록 필터(`?status=`) 같은 것을 그대로 넘긴다
    const search = new URL(req.url).search;
    const data = await callAppAdmin<Record<string, unknown>>(
      target.app,
      target.resource + search,
    );
    return NextResponse.json(data);
  } catch (err) {
    return toResponse(err);
  }
}

async function forward(
  req: Request,
  params: Params["params"],
  method: "POST" | "PATCH" | "DELETE",
) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  const target = await resolve(params);
  if ("error" in target) return target.error;

  try {
    const search = method === "DELETE" ? new URL(req.url).search : "";
    let body: unknown;
    if (method !== "DELETE") {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const data = await callAppAdmin<Record<string, unknown>>(
      target.app,
      target.resource + search,
      { method, body },
    );
    return NextResponse.json(data);
  } catch (err) {
    return toResponse(err);
  }
}

export async function POST(req: Request, { params }: Params) {
  return forward(req, params, "POST");
}

export async function PATCH(req: Request, { params }: Params) {
  return forward(req, params, "PATCH");
}

export async function DELETE(req: Request, { params }: Params) {
  return forward(req, params, "DELETE");
}
