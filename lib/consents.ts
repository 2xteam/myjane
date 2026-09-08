import type { UserDocument } from "@/models/User";

/**
 * 분리해서 받는 동의 — **정의의 원본은 이 파일 하나다.**
 *
 * 가입 동의(약관·개인정보 수집·이용)와 따로 받는다. 법이 분리를 요구하는
 * 것들이고, 그 기능을 쓰는 **순간에만** 묻는다.
 *
 * ## 왜 가입 화면에 몰아넣지 않는가
 *
 * SnapWord 만 쓸 사람에게 건강정보 동의를 받는 것은 필요 없는 수집이다.
 * 필수 동의로 묶으면 "동의하지 않으면 가입 불가"가 되어 거부할 자유가 없어진다.
 * 그래서 **쓰려는 순간에 묻고, 동의하지 않으면 그 기능만 막는다.**
 *
 * ## 무엇을 막고 무엇을 막지 않는가
 *
 * | 동의 | 없으면 막히는 것 | 그대로 되는 것 |
 * |---|---|---|
 * | 건강정보 | FitLog 의 기록 저장·조회 | SnapWord · SnapNote · 2hbk · TypeLog |
 * | 국외 이전 | 사진 자동 인식 · AI 대화 | 손으로 입력하는 기록은 전부 |
 * | 법정대리인 | 자녀 추가 | 보호자 본인의 이용 |
 *
 * ⚠️ **로그인을 막지 않는다.** 계정은 여섯 앱 공용이라 한 동의로 전체를
 * 잠그면 관계없는 앱까지 함께 멈춘다.
 *
 * → my-obsidian-vault / 50-Plans/C 법적 페이지.md
 */

export const CONSENT_KINDS = ["health", "overseas", "guardian"] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

export function isConsentKind(v: unknown): v is ConsentKind {
  return typeof v === "string" && (CONSENT_KINDS as readonly string[]).includes(v);
}

/** 문서의 어느 필드에 시각을 남기나 */
const FIELD: Record<ConsentKind, keyof UserDocument> = {
  health: "healthDataAgreedAt",
  overseas: "overseasTransferAgreedAt",
  guardian: "guardianAgreedAt",
};

export function consentField(kind: ConsentKind): keyof UserDocument {
  return FIELD[kind];
}

export function hasConsent(
  user: Pick<
    UserDocument,
    "healthDataAgreedAt" | "overseasTransferAgreedAt" | "guardianAgreedAt"
  >,
  kind: ConsentKind,
): boolean {
  const v = user[FIELD[kind] as keyof typeof user];
  return Boolean(v);
}

/**
 * 화면에 쓰는 문구. **방침 본문과 같은 말이어야 한다** —
 * 여기서만 부드럽게 쓰고 방침에서는 다르게 쓰면 어느 쪽이 진짜인지 알 수 없다.
 */
export type ConsentCopy = {
  /** 동의 화면의 라벨 */
  title: string;
  /** 무엇에 동의하는지 — 항목·목적·보관 */
  items: string[];
  /** 동의하지 않으면 무엇이 막히나 (반드시 알려야 한다) */
  refuse: string;
  /** 체크박스 옆 한 줄 */
  checkbox: string;
};

export const CONSENT_COPY: Record<ConsentKind, ConsentCopy> = {
  health: {
    title: "건강정보 처리 동의",
    items: [
      "받는 것 — 인바디 측정값, 피검사 결과와 참고치, 검사기관·의뢰 병원·접수번호, 검사 일시, 그리고 결과지 사진 원본",
      "쓰는 곳 — 회원님의 기록을 저장하고 보여드리는 것, 변화를 그래프로 정리하는 것",
      "보관 — 탈퇴하시면 6개월 뒤 폐기합니다. 기록은 언제든 직접 지울 수 있어요",
      "건강에 관한 정보는 법이 정한 민감정보라, 다른 항목과 분리해 동의를 받습니다",
    ],
    refuse:
      "동의하지 않으셔도 됩니다. 그 경우 FitLog 의 기록 기능만 이용하실 수 없고, SnapWord · SnapNote · 2hbk · TypeLog 는 그대로 쓰실 수 있습니다.",
    checkbox: "건강정보(인바디·피검사) 처리에 동의합니다",
  },
  overseas: {
    title: "개인정보 국외 이전 동의",
    items: [
      "이전받는 곳 — OpenAI, L.L.C. (미국)",
      "이전되는 것 — 회원님이 올린 사진(FitLog 결과지, SnapWord 단어장, SnapNote 문제)과 AI 대화 내용. FitLog 상담을 쓰시면 저장된 인바디·피검사 수치도 함께 전달됩니다",
      "이전 목적 — 사진에서 글자와 값을 읽어 오는 것, AI 대화·상담",
      "이전 방법·시기 — 기능을 쓰시는 그때 인터넷을 통해 전송됩니다",
      "보관 — 대화는 OpenAI 측에도 남습니다",
    ],
    refuse:
      "동의하지 않으셔도 됩니다. 그 경우 사진에서 값을 자동으로 읽어 오는 기능과 AI 대화를 이용하실 수 없고, 직접 입력해 기록하는 기능은 모두 그대로 쓰실 수 있습니다.",
    checkbox: "개인정보가 국외(미국)로 이전되는 것에 동의합니다",
  },
  guardian: {
    title: "법정대리인 동의",
    items: [
      "만 14세 미만 아동은 본인 명의로 가입하지 않고, 보호자 계정에 자녀로 추가해 이용합니다",
      "받는 것 — 보호자가 입력하신 자녀의 이름과, 그 자녀의 앱 이용 기록",
      "아동에게서 이메일이나 전화번호를 직접 받지 않습니다",
      "자녀의 기록에 대한 조회·수정·삭제는 보호자가 하실 수 있습니다",
    ],
    refuse:
      "동의하지 않으시면 자녀를 추가할 수 없습니다. 보호자 본인의 이용에는 영향이 없습니다.",
    checkbox: "법정대리인으로서 자녀의 개인정보 처리에 동의합니다",
  },
};
