"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "struppeflo.snapHintDismissed";
const SHOW_AFTER_DRAGS = 1;

interface SnapHintState {
  /** Number of non-trivial drags the user has done on this device. */
  drags: number;
  /** When the toast was dismissed. */
  dismissedAt: number | null;
}

function readState(): SnapHintState {
  if (typeof window === "undefined") return { drags: 0, dismissedAt: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { drags: 0, dismissedAt: null };
    const parsed = JSON.parse(raw) as Partial<SnapHintState>;
    return {
      drags: typeof parsed.drags === "number" ? parsed.drags : 0,
      dismissedAt:
        typeof parsed.dismissedAt === "number" ? parsed.dismissedAt : null,
    };
  } catch {
    return { drags: 0, dismissedAt: null };
  }
}

function writeState(s: SnapHintState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // localStorage can be disabled / over quota; the toast just re-appears.
  }
}

/**
 * One-time hint about card snapping. Appears after the first non-trivial drag,
 * disappears on dismiss, never reappears once dismissed. The counter is
 * driven by `useCardDrag` writing drags to localStorage on commit.
 */
export function SnapHintToast() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // The drag hook bumps a "drags" counter; we mount once and just react to
    // its current value, then re-read whenever the document regains focus
    // (the drag might have been initiated from another tab/component).
    const update = () => {
      const s = readState();
      if (s.dismissedAt) {
        setShow(false);
        return;
      }
      setShow(s.drags >= SHOW_AFTER_DRAGS);
    };
    update();
    const onFocus = () => update();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    const s = readState();
    writeState({ ...s, dismissedAt: Date.now() });
    setShow(false);
  };

  return (
    <div
      role="status"
      className="absolute left-1/2 -translate-x-1/2 bottom-6 z-[120]
        pointer-events-auto"
      style={{ animation: "toast-in 0.2s cubic-bezier(0.22, 1, 0.36, 1) both" }}
    >
      <div
        className="glass-strong rounded-lg pl-4 pr-2 py-2 flex items-center gap-2.5
          text-[13px] text-[var(--ink)] shadow-[var(--shadow-panel)]"
      >
        <span aria-hidden className="text-[var(--accent)] text-[14px] leading-none">
          ✦
        </span>
        <span>
          Cards snap to align. Hold <kbd className="font-semibold px-1 py-0.5 rounded bg-[var(--surface-2)] text-[11.5px]">Shift</kbd> to drag freely.
        </span>
        <button
          type="button"
          aria-label="Dismiss hint"
          onClick={dismiss}
          className="shrink-0 w-6 h-6 inline-flex items-center justify-center
            rounded-md text-[var(--ink-faint)] hover:text-[var(--ink)]"
        >
          ×
        </button>
      </div>
    </div>
  );
}

/** Called by useCardDrag after every successful drag commit. */
export function noteDragForSnapHint() {
  if (typeof window === "undefined") return;
  const s = readState();
  if (s.dismissedAt) return;
  writeState({ ...s, drags: s.drags + 1 });
}
