import type { Metadata } from "next";
import { IgTidyShell } from "./IgTidyShell";
import { IgTidyStatus } from "./IgTidyStatus";

export const metadata: Metadata = {
  title: "IG Tidy",
  description: "허용된 myjane 회원이 쓰는 인스타그램 정리 도우미(윈도우 앱).",
  robots: { index: false },
};

/**
 * `/ig-tidy` — IG Tidy 윈도우 앱의 작은 안내 화면 (2026-11-06).
 *
 * 웹으로 서비스할 내용이 없어 서브도메인을 두지 않는다. 이 화면은 셋 중 하나만 보여 준다.
 *   로그인 전 → 로그인·가입(가입 출처 ig-tidy)
 *   허용 전   → 관리자 확인을 기다리는 중
 *   허용됨    → 설치 파일 내려받기
 * 랜딩·/link 에는 올리지 않는다(지인 배포). 검색 색인도 막는다.
 * → my-obsidian-vault / 10-Projects/IG Tidy.md
 */
export default function IgTidyPage() {
  return (
    <IgTidyShell>
      <IgTidyStatus />
    </IgTidyShell>
  );
}
