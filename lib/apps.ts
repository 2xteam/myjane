/**
 * 통합 로그인이 상대하는 앱 목록.
 *
 * `?from=<key>` 로 어느 앱에서 왔는지 받고, 인증이 끝나면 그 앱의 `next` 경로로 돌려보낸다.
 * 세션 쿠키는 `.myjane.co.kr` 도메인으로 저장되므로 서브도메인 전체에서 그대로 읽힌다.
 */

export type AppKey = "snapword" | "snapnote" | "fitlog";

export type AppInfo = {
  key: AppKey;
  name: string;
  origin: string;
  icon: string;
  /** 회원가입 시 신체 프로필(키·성별·출생연도)을 함께 받는다 */
  needsBodyProfile?: boolean;
};

export const APPS: Record<AppKey, AppInfo> = {
  snapword: {
    key: "snapword",
    name: "SnapWord",
    origin: "https://snapword.myjane.co.kr",
    icon: "/snapword-icon.png",
  },
  snapnote: {
    key: "snapnote",
    name: "SnapNote",
    origin: "https://snapnote.myjane.co.kr",
    icon: "/snapnote-icon.png",
  },
  fitlog: {
    key: "fitlog",
    name: "FitLog",
    origin: "https://fitlog.myjane.co.kr",
    icon: "/fitlog-icon.png",
    needsBodyProfile: true,
  },
};

export function getApp(from: string | null | undefined): AppInfo | null {
  if (!from) return null;
  return APPS[from as AppKey] ?? null;
}

/**
 * 인증 후 돌아갈 주소를 만든다.
 * `next`는 **경로만** 허용한다. 다른 사이트로 튕기는 오픈 리다이렉트를 막기 위해서다.
 */
export function buildReturnUrl(
  app: AppInfo | null,
  next: string | null | undefined,
): string {
  const path = next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
  if (!app) return "/";
  return `${app.origin}${path}`;
}
