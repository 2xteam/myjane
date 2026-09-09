import type { Metadata } from "next";
import { LegalShell, LegalSection } from "@/components/LegalShell";
import { POLICY_VERSION } from "@/lib/legalVersion";

/**
 * 이용약관 — 여섯 앱 공용.
 *
 * ⚠️ 초안이다. 공개 전에 사람의 법률 검토가 필요하다.
 *
 * 사실 확인 (2026-09-07 코드 기준):
 *   · 결제 연동이 없다 — toss · portone · stripe 등 0건. 지금은 무료다
 *   · 토큰(`users.tokens`)을 깎는 코드는 있으나 `IS_TOKEN_SYSTEM_ENABLED = false`
 *     로 꺼져 있다. 유료화 정책은 정해지지 않았으므로 (확인 필요)로 남긴다
 *   · 계정은 여섯 서비스가 공유한다 — 한 계정을 지우면 여섯 곳에 영향이 간다
 *
 * 근거: my-obsidian-vault → 50-Plans/C 법적 페이지.md
 */

export const metadata: Metadata = {
  title: "이용약관 — myjane",
  description:
    "myjane 과 SnapWord · SnapNote · FitLog · 2hbk · TypeLog 이용에 관한 약관입니다.",
  alternates: { canonical: "https://www.myjane.co.kr/legal/terms" },
};

export default function TermsPage() {
  return (
    <LegalShell
      current="/legal/terms"
      eyebrow="TERMS · 이용약관"
      headline={
        <>
          하나의 계정으로 <span>여섯 서비스</span>를
          <br />
          쓰는 조건입니다
        </>
      }
      lead={
        <>
          myjane 과 SnapWord · SnapNote · FitLog · 2hbk · TypeLog 에 함께
          적용됩니다. 계정이 하나이기 때문에 약관도 하나로 둡니다.
        </>
      }
      updated={POLICY_VERSION}
    >
      <LegalSection title="제1조 (목적과 적용 범위)">
        <p>
          이 약관은 myjane(이하 &ldquo;서비스&rdquo;)이 제공하는 아래 서비스의
          이용 조건과 절차, 이용자와 서비스의 권리·의무를 정합니다.
        </p>
        <ul>
          <li>
            <strong>myjane</strong> — 통합 계정과 서비스 안내
          </li>
          <li>
            <strong>SnapWord</strong> — 단어장과 학습 기록
          </li>
          <li>
            <strong>SnapNote</strong> — 오답노트 기록
          </li>
          <li>
            <strong>FitLog</strong> — 인바디·피검사 기록
          </li>
          <li>
            <strong>2hbk</strong> — 목표와 스티커 기록
          </li>
          <li>
            <strong>TypeLog</strong> — 성향 질문지와 결과
          </li>
        </ul>
      </LegalSection>

      <LegalSection tint title="제2조 (계정)">
        <ol>
          <li>
            계정은 여섯 서비스가 함께 씁니다. 한 곳에서 가입하면 다른 곳에서도
            같은 계정으로 로그인할 수 있습니다.
          </li>
          <li>
            서비스에 따라 로그인 수단이 다릅니다. 전화번호와 PIN 을 쓰는 곳도
            있고 이메일과 비밀번호를 쓰는 곳도 있습니다.
          </li>
          <li>
            이용자는 가입 시 사실에 맞는 정보를 입력해야 하며, 바뀐 정보는
            수정해야 합니다.
          </li>
          <li>
            비밀번호와 PIN 은 이용자가 관리합니다. 다른 사람에게 알려주거나
            빌려주어 생긴 일에 대해 서비스는 책임지지 않습니다.
          </li>
          <li>
            <strong>현재 만 14세 미만 아동의 가입은 받지 않습니다.</strong>{" "}
            법정대리인 동의를 확인하는 절차가 아직 준비되지 않았기 때문입니다.
            보호자 계정에 자녀를 추가하는 방식을 준비하고 있으며, 준비되면
            자녀 계정의 이용에 대한 책임은 보호자에게 있습니다. 자세한 내용은{" "}
            <a href="/legal/privacy">개인정보처리방침</a> 6항에 있습니다.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="제3조 (이용자가 올린 기록)">
        <ol>
          <li>
            이용자가 서비스에 저장한 기록(단어장, 오답노트, 검사 결과, 목표,
            응답, 사진 등)의 <strong>권리는 이용자에게 있습니다.</strong>
          </li>
          <li>
            서비스는 그 기록을 이용자에게 보여주고, 저장하고, 이용자가 요청한
            기능(사진에서 값 읽기, AI 대화 등)을 처리하는 데에만 사용합니다.
          </li>
          <li>
            이용자는 다른 사람의 권리를 침해하는 자료를 올려서는 안 됩니다.
          </li>
          <li>
            2hbk 처럼 다른 이용자와 기록을 나누는 기능에서는, 공개 범위를
            이용자가 정한 대로 다른 이용자에게 보일 수 있습니다.
          </li>
        </ol>
      </LegalSection>

      <LegalSection tint title="제4조 (AI 기능)">
        <ol>
          <li>
            서비스는 사진에서 값을 읽어 오거나 대화로 안내하는 기능을 제공합니다.
            이 기능은 외부 사업자의 인공지능 서비스를 통해 처리됩니다. 전달되는
            내용은 <a href="/legal/privacy">개인정보처리방침</a>에 적었습니다.
          </li>
          <li>
            <strong>
              AI 가 만든 결과는 틀릴 수 있습니다.
            </strong>{" "}
            사진에서 읽어 온 값은 이용자가 원본과 대조해 확인해야 합니다.
          </li>
          <li>
            <strong>
              FitLog 의 건강 관련 안내는 의료 행위가 아닙니다.
            </strong>{" "}
            진단·처방·치료를 대신하지 않으며, 건강에 관한 판단은 의료진과
            상의해야 합니다.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="제5조 (이용요금)">
        <ol>
          <li>
            현재 서비스는 <strong>무료로 제공됩니다.</strong>
          </li>
          <li>
            앞으로 유료 기능을 두게 되면 요금과 결제·환불 조건을 미리 알리고
            동의를 받은 뒤에 적용합니다.
          </li>
        </ol>
      </LegalSection>

      <LegalSection tint title="제6조 (금지 행위)">
        <p>이용자는 다음 행위를 해서는 안 됩니다.</p>
        <ul>
          <li>다른 사람의 계정으로 로그인하거나 정보를 도용하는 행위</li>
          <li>
            서비스의 정상적인 운영을 방해하는 행위 (비정상적인 대량 요청,
            취약점을 악용하는 접근 등)
          </li>
          <li>
            다른 이용자를 괴롭히거나 명예를 훼손하는 내용을 올리는 행위
          </li>
          <li>법령을 위반하거나 다른 사람의 권리를 침해하는 행위</li>
        </ul>
      </LegalSection>

      <LegalSection title="제7조 (서비스의 변경과 중단)">
        <ol>
          <li>
            서비스는 기능을 추가하거나 바꾸거나 중단할 수 있습니다. 이용자에게
            영향이 큰 변경은 미리 알립니다.
          </li>
          <li>
            점검, 장애, 통신 사업자나 위탁 사업자의 사정 등으로 서비스가 일시
            중단될 수 있습니다.
          </li>
          <li>
            서비스 전체를 종료하는 경우, <strong>종료일로부터 30일 전</strong>에
            서비스 화면과 이메일로 알립니다. 그 기간 안에 이용자가 자신의 기록을
            확인하고 내려받을 수 있도록 안내합니다.
          </li>
        </ol>
      </LegalSection>

      <LegalSection tint title="제8조 (이용 계약의 해지)">
        <ol>
          <li>
            이용자는 언제든지 탈퇴할 수 있습니다. 탈퇴는{" "}
            <strong>여섯 서비스에 공통</strong>으로 적용됩니다.{" "}
            <strong>
              계정이 여섯 서비스에 공통이므로, 계정을 지우면 여섯 곳의 이용에
              모두 영향이 갑니다.
            </strong>
          </li>
          <li>
            탈퇴하시면 회원 정보와 이용 기록을{" "}
            <strong>6개월 동안 보관한 뒤 폐기</strong>합니다. 그 6개월 안에는
            계정을 되살릴 수 있고, 6개월이 지나면 되살릴 수 없습니다. 자세한
            내용은 <a href="/legal/privacy">개인정보처리방침</a> 5항에
            적었습니다.
          </li>
          <li>
            이용자가 제6조를 위반한 경우, 서비스는 이용을 제한하거나 계약을
            해지할 수 있습니다. 이 경우 사유를 알립니다.
          </li>
        </ol>
      </LegalSection>

      <LegalSection title="제9조 (책임의 한계)">
        <ol>
          <li>
            천재지변, 통신 장애 등 서비스가 통제할 수 없는 사유로 생긴 손해에
            대해서는 책임지지 않습니다.
          </li>
          <li>
            이용자가 서비스에 올린 자료의 정확성과 적법성에 대한 책임은 이용자에게
            있습니다.
          </li>
          <li>
            AI 기능이 만든 결과를 그대로 믿고 이용자가 한 판단의 결과에 대해서는
            책임지지 않습니다. 특히 건강에 관한 사항은 제4조 제3항에 따릅니다.
          </li>
          <li>
            이 조항은 서비스의 고의나 중대한 과실로 생긴 손해에는 적용되지
            않습니다.
          </li>
        </ol>
      </LegalSection>

      <LegalSection tint title="제10조 (약관의 변경과 분쟁)">
        <ol>
          <li>
            약관이 바뀌면 시행일과 바뀐 내용을 서비스 화면에 미리 알립니다.
            이용자에게 불리한 변경은 시행일로부터 30일 전에 알립니다.
          </li>
          <li>
            이 약관에 관한 분쟁은 대한민국 법을 따릅니다. 관할 법원은 법령이
            정하는 바에 따릅니다.
          </li>
        </ol>

        <h3>서비스 제공자</h3>
        <p>
          myjane 은 사업자 등록 없이 개인이 만들어 운영하는 서비스입니다. 그래서
          상호·사업자등록번호를 표기하지 않습니다. 문의는 아래 연락처로 주시기
          바랍니다.
        </p>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <tbody>
              <tr>
                <th scope="row">운영자</th>
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

        <p className="legal-updated">
          최종 개정일 {POLICY_VERSION} · 시행일 {POLICY_VERSION}
        </p>
      </LegalSection>
    </LegalShell>
  );
}
