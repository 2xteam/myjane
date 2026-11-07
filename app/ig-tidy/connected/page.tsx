import type { Metadata } from "next";
import { IgTidyShell } from "../IgTidyShell";

export const metadata: Metadata = { title: "IG Tidy 로그인 완료", robots: { index: false } };

/**
 * IG Tidy 앱이 띄운 로그인 창이 마지막에 도착하는 곳.
 *
 * 앱은 로그인 창의 주소가 이 경로가 되는 순간 창을 닫고 세션 쿠키를 가져간다.
 * 그래서 사람은 이 화면을 거의 보지 못한다 — 창이 안 닫힐 때를 위한 안내만 둔다.
 */
export default function IgTidyConnected() {
  return (
    <IgTidyShell>
      <h1 className="headline" style={{ fontSize: "clamp(1.6rem, 4.5vw, 2.2rem)" }}>로그인했어요</h1>
      <p className="lead">IG Tidy 앱으로 돌아가요. 이 창이 저절로 닫히지 않으면 닫아 주세요.</p>
    </IgTidyShell>
  );
}
