"use client";

import { useEffect, useRef } from "react";

/**
 * Glass modal on top of the native <dialog> element — focus trapping, Esc
 * handling, and top-layer rendering for free (no portal or focus library).
 */
export function Dialog({
  open,
  onClose,
  children,
  className = "",
  ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={ariaLabel}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself) closes.
        if (e.target === ref.current) onClose();
      }}
      className={`glass-strong glass-blur rounded-[20px] p-0 m-auto
        text-[var(--ink)] outline-none ${className}`}
    >
      {open ? children : null}
    </dialog>
  );
}
