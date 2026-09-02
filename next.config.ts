import type { NextConfig } from "next";

/**
 * 링크 전용 정적 사이트. 서버 로직이 없으므로 별도 설정이 필요 없다.
 * (Vercel에서 정적 페이지로 서빙되어 함수 호출이 발생하지 않는다)
 */
const nextConfig: NextConfig = {};

export default nextConfig;
