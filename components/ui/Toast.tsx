"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckIcon, WarningIcon } from "./icons";

export type ToastVariant = "info" | "success" | "warn" | "error";

export interface ToastInput {
  message: string;
  variant?: ToastVariant;
  /** Sticky toasts stay until dismissed (quota warnings etc.). */
  sticky?: boolean;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<{ toast: (t: ToastInput) => void } | null>(
  null,
);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const VARIANT_ICON: Record<ToastVariant, React.ReactNode> = {
  info: null,
  success: <CheckIcon size={15} className="text-[var(--accent)] shrink-0" />,
  warn: <WarningIcon size={15} className="text-[var(--link-depends)] shrink-0" />,
  error: <WarningIcon size={15} className="text-[var(--danger)] shrink-0" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      setToasts((ts) => [...ts.slice(-3), { ...input, id }]);
      if (!input.sticky) {
        setTimeout(() => dismiss(id), 4000);
      }
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col
          items-center gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast-in pointer-events-auto glass-strong
              rounded-lg pl-4 pr-2 py-2 flex items-center gap-2.5
              text-[13.5px] text-[var(--ink)] max-w-[calc(100vw-32px)] sm:max-w-md"
          >
            {VARIANT_ICON[t.variant ?? "info"]}
            <span className="leading-snug">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="shrink-0 font-semibold text-[var(--accent)] px-2 py-1
                  rounded-lg hover:bg-[var(--accent-soft)]"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="shrink-0 w-6 h-6 inline-flex items-center justify-center
                rounded-md text-[var(--ink-faint)] hover:text-[var(--ink)]"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
