"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface AnchorRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Minimal popover: fixed-position portal placed below (or above when
 * cramped) a screen-space anchor rect, clamped to the viewport.
 * Closes on outside pointer-down or Escape.
 */
export function Popover({
  anchor,
  onClose,
  children,
  offset = 8,
}: {
  anchor: AnchorRect;
  onClose: () => void;
  children: React.ReactNode;
  offset?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    let left = anchor.x + anchor.w / 2 - width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    let top = anchor.y + anchor.h + offset;
    if (top + height > window.innerHeight - 8) {
      top = anchor.y - height - offset;
    }
    top = Math.max(8, top);
    setPos({ left, top });
  }, [anchor, offset]);

  useLayoutEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Defer registration so the opening click doesn't immediately close it.
    const id = setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      className="fixed z-[150] glass-strong glass-blur rounded-xl toast-in"
      style={pos ? { left: pos.left, top: pos.top } : { visibility: "hidden" }}
    >
      {children}
    </div>,
    document.body,
  );
}
