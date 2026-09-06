import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * 빌드 산출물 폴더. 기본은 `.next`.
   *
   * 개발 서버 두 개가 같은 `.next`를 쓰면 서로의 청크를 지워 둘 다 망가진다.
   * 그래서 검증용 서버는 `npm run dev:verify`로 `.next-verify`에 따로 쌓는다.
   *
   * ⚠️ 이 환경변수를 주고 `next build`를 돌리면 Next가 `tsconfig.json`과
   * `next-env.d.ts`의 타입 경로도 그 폴더로 고쳐 쓴다. 빌드가 끝나면 두 파일을
   * 되돌려야 한다 (`git checkout tsconfig.json next-env.d.ts`).
   * 커밋에 섞이면 평소 개발이 깨진다.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
