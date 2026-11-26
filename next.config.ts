import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * 빌드 산출물 폴더. 기본은 `.next`.
   *
   * 개발 서버 두 개가 같은 `.next`를 쓰면 서로의 청크를 지워 둘 다 망가진다.
   * 그래서 검증용 서버는 `npm run dev:verify`로 `.next-verify`에 따로 쌓는다.
   *
   * ⚠️ `.next`를 분리하는 것만으로는 부족하다. Next는 `tsconfig.json`의 `include`에
   * 자기 distDir의 타입 경로가 없으면 **그 파일을 고쳐 쓴다.** 그 쓰기 한 번이
   * 돌고 있는 다른 개발 서버를 재시작시키고, 반복되면 응답이 멈춘다
   * (LISTENING인데 000). 실제로 3000번을 그렇게 먹통으로 만들었다.
   *
   * 그래서 `.next-verify`와 `.next-build`의 타입 경로를 **tsconfig에 미리 넣어
   * 커밋해 뒀다.** 이미 있으면 Next가 다시 쓰지 않는다. 그 줄을 지우면 함정이 돌아온다.
   *
   * 개발 서버가 떠 있을 때 타입만 보려면 `npx tsc --noEmit`을 쓴다 —
   * 아무 파일도 건드리지 않는다.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /**
   * `npm run dev:local` 로 https://local.myjane.co.kr:3000 에서 띄울 때
   * 운영 로그인 쿠키(.myjane.co.kr)를 그대로 받는다. 그 주소에서 여는
   * 개발 리소스(HMR 등)를 막지 않도록 허용해 둔다 → 볼트 30-Patterns/개발 서버와 검증 환경.md
   */
  allowedDevOrigins: ["local.myjane.co.kr"],
  /**
   * 프로모션 짧은 주소(사용자 2026-11-21) — 인스타 프로필 링크 등에 쓰는 www.myjane.co.kr/typelog/… 를
   * TypeLog 의 홍보 시작 화면(/start/[slug] — 인트로 → 바로 설문)으로 보낸다. 임시(307)라 목적지를 바꿔도 캐시에 안 묶인다
   */
  async redirects() {
    return [
      { source: "/typelog/running_note", destination: "https://typelog.myjane.co.kr/start/runner-16type", permanent: false },
      { source: "/typelog/running-note", destination: "https://typelog.myjane.co.kr/start/runner-16type", permanent: false },
      { source: "/typelog/running_license", destination: "https://typelog.myjane.co.kr/start/running-record", permanent: false },
      { source: "/typelog/running-license", destination: "https://typelog.myjane.co.kr/start/running-record", permanent: false },
      { source: "/typelog/mbti_note", destination: "https://typelog.myjane.co.kr/start/kids-16type", permanent: false },
    ];
  },
};

export default nextConfig;
