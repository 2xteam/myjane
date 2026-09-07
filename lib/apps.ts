/**
 * 통합 로그인이 상대하는 앱 목록.
 *
 * `?from=<key>` 로 어느 앱에서 왔는지 받고, 인증이 끝나면 그 앱의 `next` 경로로 돌려보낸다.
 * 세션 쿠키는 `.myjane.co.kr` 도메인으로 저장되므로 서브도메인 전체에서 그대로 읽힌다.
 */

export type AppKey = "snapword" | "snapnote" | "fitlog" | "2hbk" | "typelog";

export type AppInfo = {
  key: AppKey;
  name: string;
  origin: string;
  icon: string;
  /**
   * 가입 직후 이 앱에 필요한 값을 **선택으로** 함께 받는다.
   *
   * ⚠️ 필수가 아니다. 넣지 않아도 가입은 끝나고, 그 앱에서 쓰려는 순간에
   * 다시 받는다. FitLog 는 프로필이 없으면 추출을 거부하는 게이트가 따로 있고,
   * 여기서 미리 받아 두면 그 순간을 안 만나게 하는 것이 목적이다.
   */
  needsBodyProfile?: boolean;
  /** 2hbk 의 표시 이름. 없으면 `userId` 로 대신 보인다 */
  needsNickname?: boolean;
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
    needsNickname: true,
    requiresSessionToken: true,
    particle: "로",
  },
  typelog: {
    key: "typelog",
    name: "TypeLog",
    origin: "https://typelog.myjane.co.kr",
    icon: "/typelog-icon.png",
    /*
      TypeLog 의 API 도 쿠키의 `id` 를 믿지 않고 **서명 토큰**을 검증한다
      (`typelog/lib/auth.ts`). 그래서 토큰 없는 세션으로는 아무것도 못 한다 —
      2hbk 와 같다. 이 표시가 없으면 포털이 토큰 없는 세션을 그대로 돌려보내고,
      앱에서는 화면만 열린 채 API 가 401 로 떨어진다
      → my-obsidian-vault / 30-Patterns/인증과 세션 공유.md
    */
    requiresSessionToken: true,
    // "타입로그"는 받침 없이 끝나 `으로`가 어색하다
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
