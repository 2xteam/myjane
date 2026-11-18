"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * 관리 화면의 큰 다이얼로그 — 질문지 등록 · 공유 성과 · 질문지 상세처럼 내용이 긴 화면을 띄운다.
 * 확인 창(ConfirmDialog)과 같은 바탕 · 같은 Esc 닫기. 본문은 다이얼로그 안에서 스크롤한다.
 * 다이얼로그 안에서 확인 창을 또 띄울 수 있게 확인 창보다 한 층 아래(z-index 900)에 둔다.
 */
export function AdminModal({
  title,
  sub,
  wide = false,
  onClose,
  children,
}: {
  title: string;
  sub?: React.ReactNode;
  /** 카드 목록처럼 넓은 내용 */
  wide?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 안쪽 확인 창이 떠 있으면 그쪽이 먼저 닫힌다
      if (e.key === "Escape" && !document.querySelector(".adm-dialog-backdrop")) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="adm-modal-backdrop" onClick={onClose}>
      <div
        className="adm-modal"
        data-wide={wide ? "true" : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="adm-modal-head">
          <div>
            <p className="adm-modal-title">{title}</p>
            {sub ? <p className="adm-modal-sub">{sub}</p> : null}
          </div>
          <button type="button" className="adm-modal-x" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>
        <div className="adm-modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
