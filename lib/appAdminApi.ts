import { resolveOrigin, type AdminApp } from "@/lib/adminApps";

/**
 * 앱의 `/api/admin/*` 를 서버끼리 호출한다.
 *
 * 인증은 **공유 비밀 하나**다. 다섯 배포가 `ADMIN_API_SECRET` 을 같은 값으로 갖는다.
 * 브라우저에는 절대 내려가지 않는다 — 이 함수는 서버에서만 부른다.
 *
 * 예전 방식(`?pin=1956` 쿼리스트링)은 버렸다. 값이 공개 저장소에 있었고
 * URL 이라 접근 로그에 그대로 남았다.
 */

/**
 * 로컬 개발에서 앱들이 **mkcert 자기서명 인증서**로 https 를 쓴다.
 * Node 는 자체 CA 목록만 믿으므로 서버끼리 부르면 인증서 검증에서 막힌다.
 *
 * 더 엄격한 방법은 `NODE_EXTRA_CA_CERTS` 로 mkcert 루트 CA 를 가리키는 것이다
 * (셸에서 `npm run dev` 전에 설정해야 한다 — Node 가 시작할 때 읽는다).
 * 그게 번거로우면 이 완화를 쓴다. **운영에서는 절대 켜지지 않는다.**
 */
if (process.env.NODE_ENV !== "production" && process.env.ADMIN_LOCAL_HTTPS === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

export class AppAdminError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getSecret(): string {
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret || secret.length < 16) {
    throw new AppAdminError(
      "ADMIN_API_SECRET 환경 변수가 없거나 너무 짧습니다. 다섯 배포가 같은 값을 가져야 합니다.",
      500,
    );
  }
  return secret;
}

export async function callAppAdmin<T>(
  app: AdminApp,
  path: string,
  options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const { method = "GET", body } = options;
  const url = `${resolveOrigin(app)}/api/admin/${path.replace(/^\/+/, "")}`;

  const headers: Record<string, string> = {
    authorization: `Bearer ${getSecret()}`,
  };
  if (body !== undefined) headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      // 관리 화면은 늘 최신을 봐야 한다
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    // 앱이 재배포 중이거나 내려가 있으면 여기로 온다. 어느 앱인지 알려야 한다
    const reason = e instanceof Error ? e.message : String(e);
    const hint =
      process.env.NODE_ENV !== "production" && process.env.ADMIN_LOCAL_HTTPS !== "1"
        ? " — 앱을 dev:https 로 띄웠다면 .env.local 에 ADMIN_LOCAL_HTTPS=1 을 넣고 다시 시작해 주세요"
        : "";
    throw new AppAdminError(`${app.name}에 연결할 수 없습니다 (${reason})${hint}`, 502);
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* 본문이 없을 수 있다 */
  }

  const payload = (data ?? {}) as { ok?: boolean; error?: string };
  if (!res.ok || payload.ok === false) {
    throw new AppAdminError(
      payload.error ?? `${app.name} 요청이 실패했습니다 (HTTP ${res.status})`,
      res.status === 403 ? 500 : res.status, // 앱이 비밀을 거부하면 설정 문제다
    );
  }
  return payload as T;
}
