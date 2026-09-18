/**
 * 통합 로그인이 상대하는 앱 목록.
 *
 * `?from=<key>` 로 어느 앱에서 왔는지 받고, 인증이 끝나면 그 앱의 `next` 경로로 돌려보낸다.
 * 세션 쿠키는 `.myjane.co.kr` 도메인으로 저장되므로 서브도메인 전체에서 그대로 읽힌다.
 */

export type AppKey =
  | "snapword"
  | "snapnote"
  | "fitlog"
  | "2hbk"
  | "typelog"
  | "calmtouch"
  | "aikit";

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
  /**
   * 로컬 개발 포트 — **포털이 localhost 에서 돌 때만** 쓴다.
   *
   * 이게 없으면 로컬에서 로그인해도 `origin`(운영 도메인)으로 튕겨서
   * **세션이 공유되지 않는 것처럼 보인다.** 쿠키는 멀쩡히 localhost 에
   * host-only 로 심겼는데, 돌아간 곳이 로컬이 아닐 뿐이다.
   * (2026-09-18 AIKit 로컬 개발에서 겪었다)
   *
   * 포트 표의 원본은 볼트 `Home.md` 다.
   */
  devPort?: number;
};

export const APPS: Record<AppKey, AppInfo> = {
  snapword: {
    key: "snapword",
    devPort: 3001,
    name: "SnapWord",
    origin: "https://snapword.myjane.co.kr",
    icon: "/snapword-icon.png",
    requiresSessionToken: true,
  },
  snapnote: {
    key: "snapnote",
    devPort: 3002,
    name: "SnapNote",
    origin: "https://snapnote.myjane.co.kr",
    icon: "/snapnote-icon.png",
    requiresSessionToken: true,
  },
  fitlog: {
    key: "fitlog",
    devPort: 3003,
    name: "FitLog",
    origin: "https://fitlog.myjane.co.kr",
    icon: "/fitlog-icon.png",
    needsBodyProfile: true,
    requiresSessionToken: true,
  },
  "2hbk": {
    key: "2hbk",
    devPort: 3004,
    name: "2hbk",
    origin: "https://2hbk.myjane.co.kr",
    icon: "/2hbk-icon.png",
    needsNickname: true,
    requiresSessionToken: true,
    particle: "로",
  },
  typelog: {
    key: "typelog",
    devPort: 3005,
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
  calmtouch: {
    key: "calmtouch",
    devPort: 3007,
    name: "CalmTouch",
    origin: "https://calmtouch.myjane.co.kr",
    icon: "/calmtouch-icon.png",
    /*
      CalmTouch 는 회원 기능이 없다 — 로그인 없이 쓰고 API 도 없다. 그래서 서명 토큰을
      요구하지 않는다. 저장 기능이 생겨 `lib/auth.ts` 에 verifySessionToken 이 들어오면
      그때 requiresSessionToken 을 켠다 → my-obsidian-vault / 10-Projects/CalmTouch.md
    */
    // "캄터치"는 받침(ㅊ)으로 끝나 기본값 `으로`가 맞다
  },
  aikit: {
    key: "aikit",
    devPort: 3008,
    name: "AIKit",
    origin: "https://aikit.myjane.co.kr",
    icon: "/aikit-icon.png",
    /*
      AIKit 의 API 도 쿠키의 `id` 를 믿지 않고 **서명 토큰**을 검증한다
      (`aikit/lib/auth.ts`). 이 표시가 없으면 포털이 토큰 없는 세션을 그대로
      돌려보내고, 앱에서는 화면만 열린 채 API 가 401 로 떨어진다.
      묶음과 이미지가 사람별로 갈리는 앱이라 더더욱 켜 둔다
      → my-obsidian-vault / 30-Patterns/인증과 세션 공유.md
    */
    requiresSessionToken: true,
    // "에이아이킷"은 받침(ㅅ)으로 끝나 기본값 `으로`가 맞다
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
  return `${originFor(app)}${path}`;
}

/**
 * 돌아갈 오리진 — **포털이 로컬이면 그 앱의 로컬 포트로.**
 *
 * 쿠키는 포트를 가리지 않으므로 `localhost:3000` 이 심은 세션을 `localhost:3008`
 * 이 그대로 읽는다. 그런데 운영 오리진으로 돌려보내면 로컬에서 로그인해도
 * **아직 열리지 않은 주소**로 가서 "세션이 공유되지 않는다"로 보인다.
 *
 * ⚠️ 운영에서는 이 분기를 타지 않는다 — `location.hostname` 이 localhost 일 때만이다.
 */
function originFor(app: AppInfo): string {
  if (typeof window === "undefined") return app.origin;
  const host = window.location.hostname;
  const local = host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
  if (local && app.devPort) return `${window.location.protocol}//${host}:${app.devPort}`;
  return app.origin;
}
