/**
 * 통합 로그인이 상대하는 앱 목록.
 *
 * `?from=<key>` 로 어느 앱에서 왔는지 받고, 인증이 끝나면 그 앱의 `next` 경로로 돌려보낸다.
 * 세션 쿠키는 `.myjane.co.kr` 도메인으로 저장되므로 서브도메인 전체에서 그대로 읽힌다.
 */

export type AppKey = "snapword" | "snapnote" | "fitlog" | "2hbk";

export type AppInfo = {
  key: AppKey;
  name: string;
  origin: string;
  icon: string;
  /** 회원가입 시 신체 프로필(키·성별·출생연도)을 함께 받는다 */
  needsBodyProfile?: boolean;
  /**
   * 세션 쿠키의 **서명 토큰**이 있어야 동작하는 앱.
   *
   * 2hbk는 남의 목표에 스티커를 붙이는 동작이 있어 쿠키의 `id`를 믿지 않고
   * 서명 토큰만 검증한다. 토큰 없는 세션을 들고 가면 앱이 되돌려보내므로,
   * 로그인 화면이 세션을 보고 그냥 넘겨주면 무한히 왕복한다.
   * → my-obsidian-vault / 30-Patterns/인증과 세션 공유.md
   */
  requiresSessionToken?: boolean;
  /**
   * 이름 뒤에 붙는 조사. 기본은 `으로`.
   * `2hbk`는 "…케이"로 끝나 `으로`가 어색해서 `로`를 쓴다.
   */
  particle?: "으로" | "로";
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
  "2hbk": {
    key: "2hbk",
    name: "2hbk",
    origin: "https://2hbk.myjane.co.kr",
    icon: "/2hbk-icon.png",
    requiresSessionToken: true,
    particle: "로",
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
