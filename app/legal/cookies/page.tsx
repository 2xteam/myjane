import type { Metadata } from "next";
import { LegalShell, LegalSection, Todo } from "@/components/LegalShell";
import { POLICY_VERSION } from "@/lib/legalVersion";

/**
 * 쿠키·로컬 저장소 안내.
 *
 * ⚠️ **토글을 두지 않는다.** 지금 쓰는 쿠키는 로그인 유지용 `snap_user` 하나뿐이고
 * 분석·광고 쿠키가 없다. 껐다 켤 것이 없는데 스위치를 두면 거짓이 된다.
 * 그래서 "설정" 화면이 아니라 **무엇을 쓰고 무엇을 안 쓰는지 밝히는 안내**다.
 *
 * 실측 (2026-09-07):
 *   쿠키          lib/session.ts 의 SESSION_KEY = "snap_user" — 여섯 앱 공통.
 *                 max-age 30일, SameSite=Lax, 도메인은 NEXT_PUBLIC_COOKIE_DOMAIN
 *   분석·광고     여섯 앱 어디에도 없다 (gtag · GA · Vercel Analytics · 픽셀류 0건)
 *   localStorage  fitlog_theme · 2hbk_theme (테마), typelog_guest (비로그인 식별자),
 *                 snap_user (앱 사이 로그인 전달 과정에서 잠깐 — 읽고 바로 지운다)
 *
 * 쿠키가 늘거나 분석 도구를 붙이면 이 문서를 먼저 고친다.
 * 근거: my-obsidian-vault → 50-Plans/C 법적 페이지.md
 */

export const metadata: Metadata = {
  title: "쿠키·로컬 저장소 안내 — myjane",
  description:
    "myjane 이 사용하는 쿠키는 로그인 유지용 하나뿐입니다. 분석·광고 쿠키를 쓰지 않습니다. 브라우저에 저장되는 값과 그 이유를 안내합니다.",
  alternates: { canonical: "https://www.myjane.co.kr/legal/cookies" },
};

export default function CookiesPage() {
  return (
    <LegalShell
      current="/legal/cookies"
      eyebrow="COOKIES · 쿠키와 로컬 저장소"
      headline={
        <>
          쓰는 것은 <span>로그인 유지</span> 하나입니다
        </>
      }
      lead={
        <>
          분석 쿠키도, 광고 쿠키도 쓰지 않습니다. 끄고 켤 스위치를 두는 대신
          무엇이 저장되고 왜 필요한지를 그대로 적었습니다.
        </>
      }
      updated={POLICY_VERSION}
    >
      <LegalSection title="지금 사용하는 쿠키">
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th scope="col">이름</th>
                <th scope="col">하는 일</th>
                <th scope="col">유효기간</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">snap_user</th>
                <td>
                  로그인 상태를 유지합니다. 여섯 서비스가 한 계정을 함께 쓰기
                  때문에, 한 번 로그인하면 다른 서비스로 넘어갈 때 다시 로그인하지
                  않아도 되도록 <code>.myjane.co.kr</code> 아래에서 공유됩니다.
                </td>
                <td>30일</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>이 쿠키에 담기는 값</h3>
        <ul>
          <li>회원 식별자, 이름, 전화번호</li>
          <li>
            이메일 주소, 닉네임, 이용자 식별자 (해당 항목이 있는 계정만)
          </li>
          <li>
            서버가 확인하는 서명 값과 만료 시각 — 다른 사람의 기록에 접근하지
            못하도록 검증하는 데 씁니다
          </li>
        </ul>

        <div className="legal-callout">
          <p>
            <strong>이 쿠키는 서비스가 동작하는 데 반드시 필요합니다.</strong>{" "}
            브라우저에서 차단하면 로그인이 유지되지 않아 기록을 보거나 저장할 수
            없습니다. 그래서 켜고 끄는 선택지를 두지 않았습니다.
          </p>
        </div>
      </LegalSection>

      <LegalSection tint title="사용하지 않는 것">
        <p>다음은 <strong>쓰지 않습니다.</strong></p>
        <ul>
          <li>
            <strong>분석·통계 쿠키</strong> — Google Analytics 를 비롯한 방문
            분석 도구를 붙이지 않았습니다
          </li>
          <li>
            <strong>광고·맞춤형 광고 쿠키</strong> — 광고를 싣지 않고, 광고
            사업자의 추적 코드를 넣지 않았습니다
          </li>
          <li>
            <strong>다른 사이트로 따라다니는 추적</strong> — 제3자 추적 픽셀이나
            소셜 로그인 추적 코드를 쓰지 않습니다
          </li>
        </ul>
        <p>
          나중에 이런 도구를 쓰게 되면, 붙이기 전에 이 안내를 먼저 고치고 필요한
          동의 절차를 마련하겠습니다.
        </p>
      </LegalSection>

      <LegalSection title="브라우저에 저장되는 값 (쿠키가 아닌 것)">
        <p>
          쿠키 말고도 브라우저 자체에 남는 값이 있습니다. 서버로 전송되지 않고
          그 브라우저 안에만 있지만, 무엇이 남는지 함께 밝힙니다.
        </p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th scope="col">이름</th>
                <th scope="col">어디서</th>
                <th scope="col">하는 일</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">fitlog_theme</th>
                <td>FitLog</td>
                <td>
                  고른 화면 테마(밝게·어둡게·직접 고른 색)를 기억합니다
                </td>
              </tr>
              <tr>
                <th scope="row">2hbk_theme</th>
                <td>2hbk</td>
                <td>고른 화면 테마를 기억합니다</td>
              </tr>
              <tr>
                <th scope="row">typelog_guest</th>
                <td>TypeLog</td>
                <td>
                  로그인하지 않고 참여할 때, 같은 질문지를 여러 번 하는 것을
                  막기 위해 브라우저마다 임의로 만든 값 하나를 둡니다. 이름이나
                  연락처와 연결되지 않습니다
                </td>
              </tr>
              <tr>
                <th scope="row">snap_user</th>
                <td>공통</td>
                <td>
                  서비스 사이를 오갈 때 로그인 정보를 넘기는 과정에서 잠시
                  사용하고, 넘긴 뒤 바로 지웁니다
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection tint title="지우고 싶다면">
        <ul>
          <li>
            <strong>로그아웃</strong> 하면 로그인 쿠키와 위 저장값이 함께
            지워집니다
          </li>
          <li>
            브라우저 설정에서 이 사이트의 쿠키와 사이트 데이터를 직접 삭제할 수
            있습니다. 삭제하면 다시 로그인해야 하고, 고른 테마와 TypeLog 의
            참여 이력 표시가 초기화됩니다
          </li>
        </ul>
        <p>
          쿠키에 관한 문의는{" "}
          <a href="mailto:myjane0602@gmail.com">myjane0602@gmail.com</a> 로 주시기 바랍니다.
        </p>
        <p>
          함께 보기 — <a href="/legal/privacy">개인정보처리방침</a> ·{" "}
          <a href="/legal/terms">이용약관</a>
        </p>
      </LegalSection>
    </LegalShell>
  );
}
