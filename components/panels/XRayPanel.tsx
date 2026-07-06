"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useBoardStore } from "@/lib/store/boardStore";
import { useUIStore } from "@/lib/store/uiStore";
import { compileBoard, estimateTokens } from "@/lib/compiler/compile";
import { copyText } from "@/lib/clipboard";
import { emit } from "@/lib/events";
import { useToast } from "@/components/ui/Toast";
import { CloseIcon, CopyIcon, WarningIcon } from "@/components/ui/icons";
import type { CompileResult } from "@/lib/types";

type Tab = "markdown" | "json";

/**
 * Live compiled prompt. Recompiles 150ms after the board settles; flashes on
 * change. This panel is the product thesis made visible.
 */
export function XRayPanel() {
  const open = useUIStore((s) => s.xrayOpen);
  const board = useBoardStore((s) => s.boards[s.activeBoardId]);
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("markdown");
  const [result, setResult] = useState<CompileResult | null>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (!open || !board) return;
    const t = setTimeout(() => {
      setResult(compileBoard(board));
      if (!first.current && preRef.current) {
        preRef.current.classList.remove("xray-flash");
        // Restart the animation.
        void preRef.current.offsetWidth;
        preRef.current.classList.add("xray-flash");
      }
      first.current = false;
    }, 150);
    return () => clearTimeout(t);
  }, [open, board]);

  useEffect(() => {
    if (!open) first.current = true;
  }, [open]);

  const text = useMemo(() => {
    if (!result) return "";
    return tab === "markdown"
      ? result.markdown
      : JSON.stringify(result.json, null, 2);
  }, [result, tab]);

  if (!open) return null;

  const copy = async () => {
    if (await copyText(text)) {
      toast({ message: "Compiled prompt copied — paste it into Claude.", variant: "success" });
      emit("compile:copied");
    } else {
      toast({ message: "Couldn't access the clipboard.", variant: "error" });
    }
  };

  return (
    <div
      className="absolute top-3 right-3 bottom-3 w-[400px] max-w-[calc(100vw-24px)]
        z-40 glass-strong glass-blur rounded-[20px] flex flex-col fade-up"
    >
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <h2 className="text-[14px] font-semibold tracking-tight">Prompt X-Ray</h2>
        {result && (
          <span
            className="text-[11px] font-medium text-[var(--ink-faint)] rounded-full
              px-2 py-0.5 bg-[var(--glass)]"
          >
            ~{estimateTokens(text).toLocaleString()} tokens
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            data-tour="xray-copy"
            onClick={copy}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded-full
              text-[12.5px] font-semibold text-white
              bg-gradient-to-b from-[var(--accent)] to-[var(--accent-2)]
              hover:brightness-110"
          >
            <CopyIcon size={13} />
            Copy
          </button>
          <button
            type="button"
            aria-label="Close X-Ray"
            onClick={() => useUIStore.getState().setXrayOpen(false)}
            className="w-8 h-8 inline-flex items-center justify-center rounded-full
              text-[var(--ink-faint)] hover:text-[var(--ink)]
              hover:bg-[var(--accent-soft)]"
          >
            <CloseIcon size={13} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 px-4 pb-2">
        {(["markdown", "json"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`h-7 px-3 rounded-full text-[12px] font-medium capitalize
              ${tab === t ? "bg-[var(--accent-soft)] text-[var(--ink)]" : "text-[var(--ink-dim)] hover:bg-[var(--accent-soft)]"}`}
          >
            {t}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-[var(--ink-faint)]">
          updates live
        </span>
      </div>

      {result && result.warnings.length > 0 && (
        <div
          className="mx-4 mb-2 rounded-xl px-3 py-2 text-[12px] leading-snug
            flex items-start gap-2"
          style={{
            background: "rgba(217,147,13,0.12)",
            color: "var(--link-depends)",
          }}
        >
          <WarningIcon size={14} className="mt-0.5 shrink-0" />
          <div>
            {result.warnings.map((w, i) => (
              <div key={i}>{w.message}</div>
            ))}
          </div>
        </div>
      )}

      <pre
        ref={preRef}
        className="thin-scroll flex-1 overflow-auto mx-2 mb-2 px-3 py-2 rounded-xl
          text-[11.5px] leading-relaxed font-mono whitespace-pre-wrap
          text-[var(--ink-dim)] select-text"
      >
        {text ||
          "Add cards to the board and the compiled prompt will appear here."}
      </pre>
    </div>
  );
}
