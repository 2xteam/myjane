"use client";

/**
 * admin 화면이 포털 자신의 `/api/admin/*` 을 부를 때 쓰는 한 겹.
 *
 * 인증은 세션 쿠키(같은 오리진이라 자동으로 실린다)에 담긴 서명 토큰이다.
 * 앱들과 공유하는 비밀은 **서버에만** 있고 여기로 내려오지 않는다.
 */

export class AdminError extends Error {
  readonly status: number;
  /**
   * 응답 본문 전체.
   *
   * 실패에도 쓸 정보가 실려 오는 경우가 있다 — 질문지 검증은 오류 목록과
   * 분포를 **400 과 함께** 돌려준다. 메시지만 남기면 그걸 버리게 된다.
   */
  readonly payload: Record<string, unknown> | null;
  constructor(message: string, status: number, payload: Record<string, unknown> | null = null) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

type Options = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

export async function adminApi<T>(path: string, options: Options = {}): Promise<T> {
  const { method = "GET", body } = options;

  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* 본문이 없을 수 있다 */
  }

  const payload = (data ?? {}) as { ok?: boolean; error?: string };
  if (!res.ok || payload.ok === false) {
    throw new AdminError(
      payload.error ?? "요청을 처리하지 못했습니다.",
      res.status,
      payload as Record<string, unknown>,
    );
  }
  return payload as T;
}

export function adminErrorMessage(err: unknown): string {
  if (err instanceof AdminError) return err.message;
  if (err instanceof Error) return err.message;
  return "알 수 없는 오류가 발생했습니다.";
}

/** 날짜를 한 줄로 — 목록에서 자리를 많이 쓰지 않도록 */
export function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${String(d.getFullYear()).slice(2)}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
