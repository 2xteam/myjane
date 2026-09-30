"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 관리 화면의 확인 창 — 브라우저 기본 `confirm()` 대신 **화면 안에** 띄운다.
 *
 * 기본 대화상자를 막는 브라우저가 있다(인앱 브라우저·자동화 창 등). 거기서는 `confirm()` 이
 * 창을 띄우지 않고 곧바로 false 를 돌려줘서 **버튼을 눌러도 아무 일도 없었다**(2026-10-01,
 * 대리 로그인 · 운영자 세우기). 관리 화면의 확인은 모두 이것을 쓴다.
 *
 *   const { ask, dialog } = useConfirm();
 *   if (!(await ask({ title: "…", confirmLabel: "지우기", danger: true }))) return;
 *   …
 *   return <>{…}{dialog}</>;
 */

export type ConfirmOptions = {
  title: string;
  /** 제목 아래 설명 줄들 */
  lines?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  /** 되돌리기 어려운 동작이면 확인 버튼을 위험 색으로 */
  danger?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);

  const ask = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...opts, resolve });
      }),
    [],
  );

  const close = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending],
  );

  const dialog = pending ? <ConfirmDialog {...pending} onClose={close} /> : null;
  return { ask, dialog };
}

function ConfirmDialog({
  title,
  lines,
  confirmLabel = "확인",
  cancelLabel = "취소",
  danger,
  onClose,
}: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="adm-dialog-backdrop" onClick={() => onClose(false)}>
      <div
        className="adm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="adm-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="adm-dialog-title" className="adm-dialog-title">
          {title}
        </p>
        {lines?.length ? (
          <ul className="adm-dialog-lines">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        ) : null}
        <div className="adm-dialog-actions">
          <button type="button" className="adm-btn adm-btn--ghost" onClick={() => onClose(false)}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={danger ? "adm-btn adm-btn--solid-danger" : "adm-btn"}
            onClick={() => onClose(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
