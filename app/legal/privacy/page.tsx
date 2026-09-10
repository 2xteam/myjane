import type { Metadata } from "next";
import { LegalShell, LegalSection } from "@/components/LegalShell";
import { POLICY_VERSION } from "@/lib/legalVersion";

/**
 * 개인정보처리방침 — 여섯 앱 공용.
 *
 * ⚠️ 초안이다. 공개 전에 사람의 법률 검토가 필요하다.
 *
 * 수집 항목과 위탁업체는 **2026-09-07 코드에서 실측한 값**이다. 추측으로 쓰지 않는다.
 *   회원 공통  models/User.ts (user DB · users 컬렉션)
 *   앱 데이터  각 앱 models/ (vocab · math · fit · hamhibokka DB)
 *   위탁업체   각 앱 .env.local 의 환경 변수와 lib/ 의 사용처
 * 코드가 바뀌면 이 문서도 함께 고친다.
 *
 * 근거: my-obsidian-vault → 50-Plans/C 법적 페이지.md
 */

export const metadata: Metadata = {
  title: "개인정보처리방침 — myjane",
  description:
    "myjane 과 SnapWord · SnapNote · FitLog · 2hbk · TypeLog 이 수집하는 개인정보 항목, 이용 목적, 처리위탁 현황을 안내합니다.",
  alternates: { canonical: "https://www.myjane.co.kr/legal/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalShell
      current="/legal/privacy"
      eyebrow="PRIVACY · 개인정보처리방침"
      headline={
        <>
          어떤 정보를 <span>받고</span>, 어디에 쓰고,
          <br />
          누구에게 맡기는지 적었습니다
        </>
      }
      lead={
        <>
          myjane 은 하나의 계정으로 SnapWord · SnapNote · FitLog · 2hbk · TypeLog
          다섯 앱을 함께 씁니다. 계정은 한 곳에 있고 앱 기록은 각자 따로 있습니다.
          그래서 이 방침도 여섯 서비스에 함께 적용됩니다.
        </>
      }
      updated={POLICY_VERSION}
    >
      <LegalSection title="1. 수집하는 개인정보 항목">
        <h3>회원 정보 (여섯 서비스 공통)</h3>
        <p>
          회원 정보는 한 곳에 모여 있고 여섯 서비스가 함께 씁니다. 로그인 방식이
          서비스마다 달라서, 어떤 항목이 채워지는지는 가입한 경로에 따라 다릅니다.
        </p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th scope="col">구분</th>
                <th scope="col">항목</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">계정 — 필수</th>
                <td>
                  <strong>이름, 이메일 주소, 비밀번호</strong>
                </td>
              </tr>
              <tr>
                <th scope="row">계정 — 선택</th>
                <td>
                  전화번호 — <strong>넣지 않아도 가입됩니다.</strong> 문자로
                  알림을 받고 싶을 때만 받습니다
                </td>
              </tr>
              <tr>
                <th scope="row">인증</th>
                <td>
                  비밀번호, PIN{" "}
                  <strong>(둘 다 해시로 저장하며 원문은 보관하지 않습니다)</strong>
                  , 비밀번호·PIN 재설정 토큰과 그 만료 시각
                </td>
              </tr>
              <tr>
                <th scope="row">이메일 인증</th>
                <td>
                  인증 여부, 인증 토큰과 그 만료 시각, 인증 메일 발송 시각,
                  안내를 다시 띄울 시각, 그리고{" "}
                  <strong>인증 대기 중인 주소</strong>
                  <br />→ 아래 &ldquo;이메일 인증은 이렇게 다룹니다&rdquo; 참고
                </td>
              </tr>
              <tr>
                <th scope="row">동의 기록</th>
                <td>
                  약관·개인정보 수집·이용 동의 시각과 동의한 문서의 개정일,
                  그리고 <strong>따로 받는 동의</strong>(건강정보 · 국외 이전 ·
                  법정대리인)의 동의 시각
                </td>
              </tr>
              <tr>
                <th scope="row">상태</th>
                <td>
                  가입 일시, 마지막 로그인 일시, 가입한 서비스, 보유 토큰 수,
                  관리자 권한 여부
                </td>
              </tr>
              <tr>
                <th scope="row">FitLog 이용 시</th>
                <td>
                  키, 성별, 출생연도 — <strong>선택입니다.</strong> 넣지 않아도
                  가입되고, 결과지에서 값을 읽어 오는 기능을 쓰실 때 받습니다
                </td>
              </tr>
              <tr>
                <th scope="row">2hbk 이용 시</th>
                <td>
                  이용자 식별자, 닉네임(선택), 프로필 이미지, 팔로우 승인 필요
                  여부
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>이메일 인증은 이렇게 다룹니다</h3>
        <ul>
          <li>
            <strong>인증 대기 중인 주소</strong>는 인증을 마치기 전까지만 따로
            보관합니다. 인증이 끝나면 그 주소를 정식 이메일 항목으로{" "}
            <strong>옮기고</strong> 대기 항목은 비웁니다.
          </li>
          <li>
            <strong>인증 토큰은 발급 후 30분이 지나면 만료</strong>되고,{" "}
            <strong>한 번 쓰면 곧바로 폐기</strong>합니다.
          </li>
          <li>
            <strong>안내를 다시 띄울 시각</strong>은 아직 이메일을 등록하지
            않으신 분께 안내를 하루에 한 번만 보여드리기 위한 시각입니다.
            개인을 알아보는 데 쓰지 않습니다.
          </li>
        </ul>

        <div className="legal-callout">
          <p>
            <strong>
              이미 이메일을 등록해 두신 계정은 인증을 거치지 않고 인증됨으로
              표시했습니다.
            </strong>{" "}
            이메일 인증 기능을 넣기 전에 가입하신 분들께 안내가 한꺼번에 뜨는
            것을 막기 위해, 2026년 9월 7일에 이미 등록된 주소를 맞다고 보고
            일괄 처리한 것입니다. 그래서 그 계정의 &ldquo;인증 여부&rdquo;는
            실제로 확인 메일을 주고받은 결과가 아닙니다.
          </p>
        </div>

        <h3>서비스별 이용 기록</h3>
        <p>회원 정보와 달리, 아래 기록은 각 서비스에 따로 저장됩니다.</p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th scope="col">서비스</th>
                <th scope="col">저장되는 것</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">SnapWord</th>
                <td>
                  단어장과 단어, 학습 기록, 시험 기록과 결과, 이용자가 올린 사진과
                  거기에서 추출한 단어, AI 대화 내용
                </td>
              </tr>
              <tr>
                <th scope="row">SnapNote</th>
                <td>
                  오답노트와 오답 항목, 이용자가 올린 문제 사진, AI 대화 내용
                </td>
              </tr>
              <tr>
                <th scope="row">FitLog</th>
                <td>
                  인바디 측정 기록, 피검사 기록, 결과지 사진, AI 상담 대화 내용
                  <br />
                  <strong>→ 아래 2번 항목에서 따로 설명합니다</strong>
                </td>
              </tr>
              <tr>
                <th scope="row">2hbk</th>
                <td>
                  목표와 목표 이미지, 스티커를 주고받은 기록과 그 시각,
                  팔로우 관계, 목표 초대 내역
                </td>
              </tr>
              <tr>
                <th scope="row">TypeLog</th>
                <td>
                  질문지 응답과 결과 유형. 로그인하지 않고 참여한 경우, 같은
                  질문지를 여러 번 하는 것을 막기 위해 브라우저에 임의로 만든
                  식별자 하나가 저장되고 응답에 함께 기록됩니다
                </td>
              </tr>
              <tr>
                <th scope="row">문의</th>
                <td>이름, 전화번호, 문의 제목과 내용, 답변 내용</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>자동으로 남는 것</h3>
        <ul>
          <li>접속 로그와 페이지 요청 기록 (호스팅 사업자가 남깁니다)</li>
          <li>
            로그인 상태를 유지하기 위한 쿠키와, 화면 설정을 기억하기 위한 브라우저
            저장소 → <a href="/legal/cookies">쿠키·로컬 저장소 안내</a>
          </li>
          <li>
            AI 기능 이용 시 요청 기록 (사용한 모델, 처리 시간, 토큰 사용량,
            보낸 이미지의 용량과 형식, 성공 여부)
          </li>
        </ul>
      </LegalSection>

      <LegalSection tint title="2. 민감정보 — FitLog 의 건강정보">
        <div className="legal-callout">
          <p>
            <strong>
              FitLog 은 건강에 관한 정보를 저장합니다. 개인정보 보호법이 정한
              민감정보에 해당합니다.
            </strong>{" "}
            다른 항목과 구분해 따로 밝힙니다.
          </p>
        </div>

        <h3>저장하는 항목</h3>
        <ul>
          <li>
            <strong>인바디(체성분) 측정값</strong> — 체중, 체수분, 단백질, 무기질,
            체지방량, 골격근량, 부위별 근육·지방량 등 결과지에 인쇄된 값과 그
            표준범위, 측정 일시, 측정 장비와 장소
          </li>
          <li>
            <strong>피검사 결과</strong> — 검사 항목명, 결과값과 단위, 결과지에
            인쇄된 참고치, 높음·낮음 판정 표시, 검체 종류, 검사 일시
          </li>
          <li>
            <strong>검사기관 정보</strong> — 검사를 한 기관명, 의뢰한 병원명,
            접수번호
          </li>
          <li>
            <strong>결과지 사진 원본</strong> — 이용자가 올린 인바디·피검사 결과지
            사진을 파일 보관 서비스에 그대로 보관합니다
          </li>
          <li>
            <strong>AI 상담 대화</strong> — 상담 기능을 쓰면 위 수치가 대화의
            근거로 함께 다루어집니다
          </li>
        </ul>

        <h3>AI 기능을 쓸 때 결과지가 외부로 전달됩니다</h3>
        <div className="legal-callout">
          <p>
            <strong>
              결과지 사진을 올려 자동으로 값을 읽어 오는 기능과 AI 상담 기능은,
              해당 사진과 그 내용을 OpenAI 에 전달해 처리합니다.
            </strong>
          </p>
          <ul>
            <li>
              결과지에서 값을 읽어 올 때 — 이용자가 올린{" "}
              <strong>결과지 사진 원본</strong>이 전달됩니다
            </li>
            <li>
              AI 상담을 이용할 때 — 대화 내용과 함께{" "}
              <strong>저장된 인바디·피검사 기록</strong>이 답변의 근거로
              전달되며, 대화는 OpenAI 측에도 보관됩니다
            </li>
          </ul>
          <p>
            <strong>
              이 두 가지는 가입 동의와 분리해서 따로 동의를 받습니다.
            </strong>{" "}
            건강에 관한 정보는 법이 정한 민감정보이고, OpenAI 는 미국에 있어
            국외 이전에 해당합니다.
          </p>
          <ul>
            <li>
              <strong>건강정보 처리 동의</strong> — FitLog 의 기록 기능을 처음
              쓰실 때 받습니다
            </li>
            <li>
              <strong>국외 이전 동의</strong> — 사진에서 값을 읽어 오는 기능이나
              AI 대화를 처음 쓰실 때 받습니다
            </li>
          </ul>
          <p>
            <strong>동의하지 않으셔도 됩니다.</strong> 건강정보에 동의하지
            않으시면 FitLog 의 기록 기능만 이용하실 수 없고, 국외 이전에 동의하지
            않으시면 사진 자동 인식과 AI 대화만 이용하실 수 없습니다. 나머지
            서비스와 직접 입력하는 기록은 모두 그대로 쓰실 수 있습니다. 동의는{" "}
            <a href="/account/consent/health">언제든 철회</a>할 수 있습니다.
          </p>
        </div>

        <p>
          FitLog 의 AI 기능은 기록을 읽고 정리하는 것을 돕습니다.{" "}
          <strong>진단이나 치료를 대신하지 않습니다.</strong> 건강에 관한 판단은
          의료진과 상의하시기 바랍니다.
        </p>
      </LegalSection>

      <LegalSection title="3. 개인정보의 이용 목적">
        <ul>
          <li>회원 가입과 본인 확인, 로그인 상태 유지</li>
          <li>여섯 서비스가 하나의 계정을 함께 쓰도록 하는 것</li>
          <li>
            가입하신 이메일 주소가 실제로 쓰시는 주소인지 확인(인증 메일 발송)
          </li>
          <li>비밀번호·PIN 재설정과 계정 찾기 안내 메일 발송</li>
          <li>이용자가 남긴 기록의 저장·조회·수정·삭제</li>
          <li>
            사진에서 값을 읽어 오는 기능과 AI 대화·상담 기능의 제공
          </li>
          <li>문의에 대한 답변과 공지 안내</li>
          <li>서비스 운영과 오류 대응</li>
        </ul>
        <p>
          위 목적 외의 용도로는 이용하지 않습니다. 목적이 바뀌면 미리 알리고
          동의를 받습니다.
        </p>
      </LegalSection>

      <LegalSection tint title="4. 처리위탁 현황">
        <p>
          서비스를 운영하기 위해 아래 사업자에게 개인정보 처리를 맡기고 있습니다.
        </p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th scope="col">위탁받는 곳</th>
                <th scope="col">무엇이 전달되나</th>
                <th scope="col">무슨 일을 하나</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Vercel</th>
                <td>접속 로그, 페이지 요청 기록</td>
                <td>서비스 호스팅 (미국)</td>
              </tr>
              <tr>
                <th scope="row">MongoDB Atlas</th>
                <td>회원 정보와 서비스 이용 기록 전부</td>
                <td>데이터베이스 보관</td>
              </tr>
              <tr>
                <th scope="row">Cloudflare R2</th>
                <td>
                  FitLog 결과지 사진, SnapNote 문제 사진, 2hbk 프로필·목표 이미지
                </td>
                <td>이미지 파일 보관</td>
              </tr>
              <tr>
                <th scope="row">OpenAI</th>
                <td>
                  FitLog 결과지 사진과 거기서 읽어 온 값, SnapWord 단어장 사진,
                  SnapNote 문제 사진, 각 서비스의 AI 대화 내용
                </td>
                <td>사진에서 글자·값 읽기, AI 대화·상담</td>
              </tr>
              <tr>
                <th scope="row">Google (구글 로그인)</th>
                <td>구글 계정으로 로그인할 때 구글이 주는 이메일 · 이름 · 계정 고유값</td>
                <td>
                  소셜 로그인 (미국). 이용자가 구글 계정으로 로그인을 선택한 경우에만. 구글의 접근
                  토큰은 저장하지 않고 신원을 확인하는 데만 씁니다
                </td>
              </tr>
              <tr>
                <th scope="row">Kakao (카카오 로그인)</th>
                <td>카카오 계정으로 로그인할 때 카카오가 주는 닉네임 · 이메일(동의한 경우) · 계정 고유값</td>
                <td>
                  소셜 로그인 (한국). 이용자가 카카오 계정으로 로그인을 선택한 경우에만. 카카오의 접근
                  토큰은 저장하지 않습니다
                </td>
              </tr>
              <tr>
                <th scope="row">Google (Gmail SMTP)</th>
                <td>이메일 주소</td>
                <td>인증·비밀번호 재설정 메일 발송</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          위탁받은 곳이 위탁 목적 외로 개인정보를 처리하지 않도록 계약과 안내에
          반영하고 있으며, 위탁 내용이 바뀌면 이 방침을 통해 알립니다.
        </p>
        <h3>국외 이전</h3>
        <p>
          위 사업자 중 아래는 국외에 있습니다. <strong>OpenAI 로의 이전은
          가입 동의와 분리해 따로 동의를 받습니다.</strong>
        </p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th scope="col">이전받는 자</th>
                <th scope="col">국가</th>
                <th scope="col">이전 항목</th>
                <th scope="col">동의</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">OpenAI, L.L.C.</th>
                <td>미국</td>
                <td>
                  올리신 사진(결과지·단어장·문제)과 AI 대화 내용. FitLog 상담
                  이용 시 저장된 인바디·피검사 수치
                </td>
                <td>
                  <a href="/account/consent/overseas">별도 동의</a>
                </td>
              </tr>
              <tr>
                <th scope="row">Vercel Inc.</th>
                <td>미국</td>
                <td>접속 로그, 페이지 요청 기록</td>
                <td>서비스 제공에 필요</td>
              </tr>
              <tr>
                <th scope="row">Cloudflare, Inc.</th>
                <td>아시아 태평양 (APAC)</td>
                <td>이미지 파일</td>
                <td>서비스 제공에 필요</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          이전 시기와 방법 — 해당 기능을 이용하시는 그때 인터넷을 통해
          전송됩니다. 보유 기간은 위 5항과 같습니다.
        </p>
        <p>
          법령에 따른 경우를 제외하고, 개인정보를 제3자에게 제공하지 않습니다.
        </p>
      </LegalSection>

      <LegalSection title="5. 보유 기간과 파기">
        <p>
          개인정보는 이용 목적을 이룬 뒤 파기하는 것을 원칙으로 합니다. 탈퇴는{" "}
          <strong>여섯 서비스에 공통</strong>으로 적용되며, 탈퇴하시면 회원
          정보와 이용 기록을 <strong>6개월 동안 보관한 뒤 폐기</strong>합니다.
        </p>
        <p>
          실수로 탈퇴하셨거나 다시 이용하고 싶으시면{" "}
          <strong>그 6개월 안에는 계정을 되살릴 수 있습니다.</strong> 6개월이
          지나면 되살릴 수 없습니다.
        </p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead>
              <tr>
                <th scope="col">항목</th>
                <th scope="col">보관 기간</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">회원 정보와 이용 기록</th>
                <td>탈퇴 후 6개월, 그 뒤 폐기</td>
              </tr>
              <tr>
                <th scope="row">결과지·프로필 등 이미지 파일</th>
                <td>탈퇴 후 6개월, 그 뒤 폐기</td>
              </tr>
              <tr>
                <th scope="row">이메일 인증 토큰</th>
                <td>발급 후 30분에 만료, 사용 즉시 폐기</td>
              </tr>
              <tr>
                <th scope="row">법령에 따라 보존하는 항목</th>
                <td>
                  관계 법령이 보존을 요구하는 항목이 있는 경우, 그 법령이 정한
                  기간 동안 보관한 뒤 파기합니다
                </td>
              </tr>
              <tr>
                <th scope="row">AI 요청 기록</th>
                <td>
                  <strong>90일</strong> 뒤 자동 삭제. 사용한 모델·처리 시간·용량 같은
                  값만 담기며, 회원을 알아볼 수 있는 항목은 담지 않습니다
                </td>
              </tr>
              <tr>
                <th scope="row">이벤트 참여 기록 · 답변이 끝난 문의</th>
                <td><strong>1년</strong> 뒤 자동 삭제 (답변 대기 중인 문의는 답변할 때까지 보관)</td>
              </tr>
              <tr>
                <th scope="row">로그인 시도 기록</th>
                <td>
                  <strong>15분</strong> 뒤 자동 삭제 — 짧은 시간에 반복되는 로그인
                  시도를 막는 데만 씁니다
                </td>
              </tr>
              <tr>
                <th scope="row">접속 로그</th>
                <td>
                  호스팅 사업자(Vercel)가 남기며 그 사업자의 보존 기간을 따릅니다.
                  우리가 따로 옮겨 두지 않습니다
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection tint title="6. 이용자와 법정대리인의 권리">
        <p>
          이용자는 언제든지 자신의 개인정보를 조회하거나 수정할 수 있고, 수집·이용
          동의를 철회하거나 삭제를 요청할 수 있습니다. 서비스 화면에서 직접 하거나,
          아래 연락처로 요청하시면 지체 없이 조치합니다.
        </p>

        <h3>만 14세 미만 아동 — 보호자 계정의 자녀 프로필</h3>
        <div className="legal-callout">
          <p>
            <strong>
              2hbk 는 어린이가 이용하는 서비스이고, SnapWord · SnapNote 도
              학습용이라 미성년 이용자가 있을 수 있습니다.
            </strong>
          </p>
          <p>
            만 14세 미만 아동은 <strong>직접 가입하지 않습니다.</strong> 보호자가
            가입해 로그인한 뒤 <strong>자녀 관리</strong>에서 자녀를 프로필로 추가합니다.
            자녀 프로필에는 이름(별칭)과 출생연도(선택)만 두고,{" "}
            <strong>이메일·전화번호·비밀번호는 받지 않습니다.</strong> 아동에게서
            연락처를 직접 수집하지 않는 방식입니다.
          </p>
          <ul>
            <li>
              자녀를 추가할 때 <strong>법정대리인 동의</strong>를 받고 그 시각을 기록합니다.
              FitLog 의 건강정보, 사진 인식·AI 대화의 국외 이전 동의도 보호자가 자녀별로
              선택하며, 동의하지 않으면 그 기능만 막힙니다
            </li>
            <li>
              로그인은 보호자가 하고, 들어갈 때 본인 또는 자녀 프로필을 고릅니다. 자녀 프로필에서는
              계정 설정(탈퇴·동의 변경·이메일·비밀번호·자녀 관리)을 할 수 없습니다
            </li>
            <li>
              자녀의 기록은 자녀 프로필에 따로 쌓입니다. 보호자가 프로필을 삭제하면 여섯 서비스의
              기록을 <strong>즉시 삭제</strong>합니다 (탈퇴의 6개월 보관은 적용되지 않습니다).
              보호자가 탈퇴해 폐기될 때 자녀 프로필도 함께 폐기됩니다
            </li>
            <li>
              자녀가 만 14세가 되면 보호자가 자녀의 이메일과 비밀번호를 등록해 <strong>독립</strong>시킬 수
              있습니다. 인증 메일의 링크를 누르면 보호자 계정에서 분리되어 자기 이메일로 로그인하는
              일반 계정이 되고, 기록은 그대로 유지됩니다
            </li>
          </ul>
        </div>
      </LegalSection>

      <LegalSection title="7. 안전조치">
        <ul>
          <li>
            비밀번호와 PIN 은 해시로 저장하며 원문을 보관하지 않습니다
          </li>
          <li>
            로그인 상태를 확인하는 값에 서명을 붙여, 기록을 읽고 쓰는 모든 요청에서
            다른 사람의 기록에 접근하지 못하도록 서버에서 검증합니다. 화면이 보내는
            회원 번호나 전화번호는 신원 확인에 쓰지 않습니다
          </li>
          <li>
            서명 값은 브라우저의 스크립트가 읽을 수 없는 쿠키(HttpOnly)에만 두고,
            비밀번호를 바꾸거나 탈퇴하면 그 전에 발급된 로그인 상태를 모두 무효로
            합니다
          </li>
          <li>
            로그인 시도는 계정마다 15분에 5회, 접속 위치마다 15분에 30회로 제한합니다
          </li>
          <li>
            사진 인식과 AI 대화처럼 정보가 외부(OpenAI)로 나가는 기능은 해당 동의가
            있는지 요청마다 서버에서 확인합니다
          </li>
          <li>
            데이터베이스와 파일 보관소는 접근 권한을 가진 운영자만 다룹니다
          </li>
          <li>
            서비스는 모두 HTTPS 로 오가며, 회원 정보와 파일은 접근 권한을 받은
            사업자의 관리형 저장소에 둡니다
          </li>
        </ul>
      </LegalSection>

      <LegalSection tint title="8. 개인정보 보호책임자와 연락처">
        <p>
          개인정보 처리에 관한 문의·불만·피해 구제는 아래로 연락해 주시기
          바랍니다. myjane 은 사업자 등록 없이 개인이 만들어 운영하는
          서비스라 상호·사업자등록번호를 표기하지 않습니다.
        </p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <tbody>
              <tr>
                <th scope="row">개인정보 보호책임자</th>
                <td>
                  장민
                </td>
              </tr>
              <tr>
                <th scope="row">이메일</th>
                <td>
                  <a href="mailto:myjane0602@gmail.com">myjane0602@gmail.com</a>
                </td>
              </tr>
              <tr>
                <th scope="row">전화</th>
                <td>010-4922-0202</td>
              </tr>

            </tbody>
          </table>
        </div>
        <p>
          그 밖에 개인정보 침해에 대한 신고나 상담이 필요하시면 개인정보
          침해신고센터(privacy.kisa.or.kr, 국번없이 118), 개인정보 분쟁조정위원회
          (kopico.go.kr, 1833-6972) 에 문의하실 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="9. 방침의 변경">
        <p>
          이 방침의 내용이 바뀌면 시행일과 바뀐 내용을 서비스 화면에 미리
          알립니다. 이용자에게 불리한 변경은 시행일로부터 30일 전에 알립니다.
        </p>
        <p className="legal-updated">
          최종 개정일 {POLICY_VERSION} · 시행일 {POLICY_VERSION}
        </p>
      </LegalSection>
    </LegalShell>
  );
}
