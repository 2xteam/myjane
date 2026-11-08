import Image from "next/image";
import Link from "next/link";

/**
 * `/ig-tidy/*` 상단 띠의 이름 — myjane 이 아니라 IG Tidy 로 보인다(2026-11-08 사용자 요청).
 * IG Tidy 는 myjane 공개 화면에 소개하지 않는 앱이라, 눌러도 myjane 첫 화면이 아니라 IG Tidy 소개로 간다.
 */
export function IgTidyBrand() {
  return (
    <Link href="/ig-tidy/about" className="auth-brand" aria-label="IG Tidy 소개">
      <Image src="/ig-tidy-icon.png" alt="" width={26} height={26} style={{ borderRadius: 7 }} />
      <span className="brand-word">
        IG <span>Tidy</span>
      </span>
    </Link>
  );
}
