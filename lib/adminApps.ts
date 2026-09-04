/**
 * 통합 admin 이 상대하는 앱과 **그 앱이 지원하는 기능**.
 *
 * 읽기·쓰기 모두 **각 앱의 `/api/admin/*` 를 호출한다.** myjane 이 남의 DB 스키마를
 * 직접 알지 않아도 되고, 검증이 스키마를 가진 쪽에 남는다.
 * 예외는 회원(`user` DB)뿐이다 — 그건 포털 자신의 데이터다.
 *
 * 기능이 앱마다 다르다. 없는 탭을 그리면 404 를 부르게 되므로 여기서 선언한다.
 */

export type AdminFeature = "stats" | "notices" | "inquiries" | "events" | "quizzes";

export type AdminApp = {
  key: string;
  name: string;
  /** 서버끼리 부르는 주소 */
  origin: string;
  /** 무엇을 다룰 수 있는지 */
  features: AdminFeature[];
};

export const ADMIN_APPS: AdminApp[] = [
  {
    key: "snapword",
    name: "SnapWord",
    origin: "https://snapword.myjane.co.kr",
    features: ["stats", "notices", "inquiries", "events"],
  },
  {
    key: "snapnote",
    name: "SnapNote",
    origin: "https://snapnote.myjane.co.kr",
    features: ["stats", "notices", "inquiries", "events"],
  },
  {
    key: "fitlog",
    name: "FitLog",
    origin: "https://fitlog.myjane.co.kr",
    // 이벤트 기능이 없다 (Event 모델이 없다)
    features: ["stats", "notices", "inquiries"],
  },
  {
    key: "2hbk",
    name: "2hbk",
    origin: "https://2hbk.myjane.co.kr",
    // 공지·문의 기능이 아직 없다. 통계만 본다
    features: ["stats"],
  },
  {
    key: "typelog",
    name: "TypeLog",
    origin: "https://typelog.myjane.co.kr",
    // 질문지 등록·공개가 이 앱의 관리 기능이다. 공지·문의는 아직 없다
    features: ["stats", "quizzes"],
  },
];

export function getAdminApp(key: string | null | undefined): AdminApp | null {
  if (!key) return null;
  return ADMIN_APPS.find((a) => a.key === key) ?? null;
}

/**
 * 로컬 개발에서는 각 앱이 `localhost:<포트>` 에 뜬다.
 * 운영 도메인을 부르면 로컬에서 고친 것을 확인할 수 없으므로 포트로 바꿔 준다.
 *
 * ⚠️ **포트를 옮기면 이 표도 함께 고쳐야 한다.** 2026-09-04 에 포털을 3000 으로
 * 옮기면서 여기를 빠뜨렸다 — 숫자만 있어 `localhost:3000` 같은 문자열 검색에
 * 걸리지 않는다. 전체 표는 볼트 `Home.md`.
 */
const LOCAL_PORTS: Record<string, number> = {
  snapword: 3001,
  snapnote: 3002,
  fitlog: 3003,
  "2hbk": 3004,
  typelog: 3005,
};

/**
 * 로컬에서 앱을 어떤 스킴으로 부를지.
 *
 * ⚠️ `npm run dev:https` 로 띄운 앱은 **HTTPS 만 받는다.** `http://` 로 부르면
 * 연결이 그냥 닫히고 `fetch failed` 만 남아서, 앱이 죽은 것처럼 보인다.
 * (2026-09-04 실제로 겪었다 — 관리 화면의 모든 앱 조회가 502 였다)
 *
 * `.env.local` 에 `ADMIN_LOCAL_HTTPS=1` 을 두면 https 로 부른다.
 */
const localScheme = () => (process.env.ADMIN_LOCAL_HTTPS === "1" ? "https" : "http");

export function resolveOrigin(app: AdminApp): string {
  const override = process.env[`ADMIN_ORIGIN_${app.key.toUpperCase()}`];
  if (override) return override.replace(/\/+$/, "");

  if (process.env.NODE_ENV !== "production") {
    const port = LOCAL_PORTS[app.key];
    if (port) return `${localScheme()}://localhost:${port}`;
  }
  return app.origin;
}
