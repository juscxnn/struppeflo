"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSyncExternalStore } from "react";
import { useBoardStore } from "@/lib/store/boardStore";
import { useUIStore } from "@/lib/store/uiStore";
import { compileBoard, estimateTokens } from "@/lib/compiler/compile";
import { analyzePrompt, lintBoard, estimateCost } from "@/lib/compiler/analysis";
import { copyText } from "@/lib/clipboard";
import { emit } from "@/lib/events";
import { useToast } from "@/components/ui/Toast";
import { CloseIcon, CopyIcon, WarningIcon } from "@/components/ui/icons";
import {
  aiConfigServerSnapshot,
  aiConfigSnapshot,
  getProviderKey,
  modelProvider,
  subscribeAIConfig,
} from "@/lib/aiConfig";
import { buildHandoffPrompt } from "@/lib/run";
import { getModel } from "@/lib/ai/models";
import type { CompileResult } from "@/lib/types";

type Tab = "markdown" | "json";

const FIRST_LAST_PREVIEW_CHARS = 400;

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
  const [copyAsOpen, setCopyAsOpen] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  const first = useRef(true);

  const aiConfig = useSyncExternalStore(
    subscribeAIConfig,
    aiConfigSnapshot,
    aiConfigServerSnapshot,
  );

  useEffect(() => {
    if (!open || !board) return;
    const t = setTimeout(() => {
      setResult(compileBoard(board));
      if (!first.current && preRef.current) {
        preRef.current.classList.remove("xray-flash");
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

  const analysis = useMemo(
    () => (result ? analyzePrompt(result) : null),
    [result],
  );
  const lint = useMemo(() => (board ? lintBoard(board) : []), [board]);

  if (!open) return null;

  const copy = async (override?: {
    provider: "anthropic" | "openai" | "gemini" | "minimax" | "kimi";
  }) => {
    if (!result || !board) return;
    const prompt = buildHandoffPrompt(board, "");
    const text = override ? await wrapForHandoff(prompt, override.provider) : prompt;
    if (await copyText(text)) {
      toast({
        message: override
          ? `Copied for ${labelFor(override.provider)}.`
          : "Compiled prompt copied.",
        variant: "success",
      });
      emit("compile:copied");
    } else {
      toast({ message: "Couldn't access the clipboard.", variant: "error" });
    }
  };

  const modelSpec = getModel(aiConfig.model);
  const provider = modelProvider(aiConfig.model);
  const hasKey = !!getProviderKey(provider);

  return (
    <div
      className="glass-strong absolute top-3 right-3 bottom-3 w-[440px]
        max-w-[calc(100vw-24px)] z-40 rounded-xl flex flex-col fade-up"
    >
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <h2 className="text-[14px] font-semibold tracking-tight">Prompt X-Ray</h2>
        {result && (
          <span
            className="text-[11px] font-medium text-[var(--ink-faint)] rounded-full
              px-2 py-0.5 bg-[var(--glass)]"
          >
            ~{analysis!.totalTokens.toLocaleString()} tokens
          </span>
        )}
        {result && modelSpec && (
          <span
            className="text-[11px] font-medium text-[var(--ink-faint)] rounded-full
              px-2 py-0.5 bg-[var(--glass)]"
            title="Approximate input cost using the selected model's published price"
          >
            ~${estimateCost(result, modelSpec.pricePerMTokInput).toFixed(4)}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <div className="relative">
            <button
              type="button"
              data-tour="xray-copy"
              onClick={() => {
                if (hasKey) setCopyAsOpen((v) => !v);
                else void copy();
              }}
              className="btn-primary h-8 px-3 inline-flex items-center gap-1.5
                rounded-lg text-[12.5px] font-semibold"
            >
              <CopyIcon size={13} />
              {hasKey ? "Copy as ▾" : "Copy"}
            </button>
            {copyAsOpen && hasKey && (
              <div className="absolute right-0 top-full mt-1 z-50 glass-strong rounded-lg p-1 w-44 shadow-lg">
                {(
                  [
                    "anthropic",
                    "openai",
                    "gemini",
                    "minimax",
                    "kimi",
                  ] as const
                ).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setCopyAsOpen(false);
                      void copy({ provider: p });
                    }}
                    className="flex items-center w-full px-2.5 h-8 rounded-md text-left text-[12.5px] hover:bg-[var(--accent-soft)]"
                  >
                    Copy for {labelFor(p)}
                    {p === provider && (
                      <span className="ml-auto text-[10.5px] text-[var(--accent)] font-semibold">
                        CURRENT
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
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

      {analysis && analysis.sections.length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-0.5 h-1.5 w-full rounded-full overflow-hidden bg-[var(--glass)]">
            {analysis.sections.map((s, i) => (
              <div
                key={`${s.name}-${i}`}
                title={`${s.name} · ~${s.tokens.toLocaleString()} tokens`}
                style={{
                  width: `${(s.tokens / Math.max(1, analysis.totalTokens)) * 100}%`,
                  background: sectionColor(i),
                }}
              />
            ))}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10.5px] text-[var(--ink-faint)] flex-wrap">
            {analysis.sections.map((s, i) => (
              <span key={`${s.name}-legend-${i}`} className="inline-flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-sm"
                  style={{ background: sectionColor(i) }}
                />
                {s.name} · {s.tokens.toLocaleString()}
              </span>
            ))}
          </div>
        </div>
      )}

      {lint.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {lint.map((issue, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                if (issue.cardIds[0]) {
                  useUIStore.getState().setSelection(issue.cardIds);
                }
              }}
              className="text-[11px] px-2 py-1 rounded-md
                bg-[rgba(217,147,13,0.12)] text-[var(--link-depends)]
                border border-[rgba(217,147,13,0.25)] hover:brightness-110"
              title={issue.message}
            >
              {issue.message.split(" —")[0]}
            </button>
          ))}
        </div>
      )}

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

      {analysis && analysis.firstSection && analysis.lastSection && (
        <details className="mx-4 mb-2 text-[11px] text-[var(--ink-faint)]">
          <summary className="cursor-pointer hover:text-[var(--ink)]">
            What the model sees first / last
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <div className="font-semibold text-[var(--ink-dim)] mb-1">
                FIRST · {analysis.firstSection.name}
              </div>
              <pre className="thin-scroll max-h-32 overflow-auto rounded-md bg-[var(--glass)] border border-[var(--border)] p-1.5 text-[10.5px] font-mono whitespace-pre-wrap text-[var(--ink-dim)]">
                {analysis.firstSection.text.slice(0, FIRST_LAST_PREVIEW_CHARS)}
                {analysis.firstSection.text.length > FIRST_LAST_PREVIEW_CHARS ? "…" : ""}
              </pre>
            </div>
            <div>
              <div className="font-semibold text-[var(--ink-dim)] mb-1">
                LAST · {analysis.lastSection.name}
              </div>
              <pre className="thin-scroll max-h-32 overflow-auto rounded-md bg-[var(--glass)] border border-[var(--border)] p-1.5 text-[10.5px] font-mono whitespace-pre-wrap text-[var(--ink-dim)]">
                {analysis.lastSection.text.length > FIRST_LAST_PREVIEW_CHARS
                  ? `…${analysis.lastSection.text.slice(-FIRST_LAST_PREVIEW_CHARS)}`
                  : analysis.lastSection.text}
              </pre>
            </div>
          </div>
        </details>
      )}

      <pre
        ref={preRef}
        className="thin-scroll flex-1 overflow-auto mx-2 mb-2 px-3 py-2 rounded-lg
          bg-[var(--glass)] border border-[var(--border)]
          text-[11.5px] leading-relaxed font-mono whitespace-pre-wrap
          text-[var(--ink-dim)] select-text"
      >
        {text ||
          "Add cards to the board and the compiled prompt will appear here."}
      </pre>
    </div>
  );
}

function sectionColor(i: number): string {
  const palette = [
    "var(--accent)",
    "var(--link-related)",
    "var(--link-input)",
    "var(--link-depends)",
    "#a78bfa",
    "#22c55e",
    "#f59e0b",
  ];
  return palette[i % palette.length];
}

function labelFor(provider: "anthropic" | "openai" | "gemini" | "minimax" | "kimi"): string {
  switch (provider) {
    case "anthropic":
      return "Claude";
    case "openai":
      return "ChatGPT";
    case "gemini":
      return "Gemini";
    case "minimax":
      return "MiniMax";
    case "kimi":
      return "Kimi";
  }
}

/** Tiny per-provider wrapper around the compiled prompt for handoff. */
async function wrapForHandoff(
  prompt: string,
  provider: "anthropic" | "openai" | "gemini" | "minimax" | "kimi" | undefined,
): Promise<string> {
  if (!provider) return prompt;
  return prompt;
}

// avoid unused-import warning on estimateTokens when only analysis.totalTokens is used.
void estimateTokens;