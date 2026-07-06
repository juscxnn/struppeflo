"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSyncExternalStore } from "react";
import { useBoardStore } from "@/lib/store/boardStore";
import { useUIStore } from "@/lib/store/uiStore";
import {
  aiConfigServerSnapshot,
  aiConfigSnapshot,
  getProviderKey,
  modelProvider,
  subscribeAIConfig,
} from "@/lib/aiConfig";
import {
  buildHandoffPrompt,
  buildRunPrompt,
  DEFAULT_RUN_INSTRUCTION,
  openInModel,
  streamRun,
} from "@/lib/run";
import { track } from "@/lib/analytics";
import { copyText } from "@/lib/clipboard";
import { getCanvas } from "@/lib/canvasBridge";
import { CARD_W, MAX_BODY } from "@/lib/constants";
import { useToast } from "@/components/ui/Toast";
import {
  CloseIcon,
  CopyIcon,
  DownloadIcon,
  KeyIcon,
  PlayIcon,
} from "@/components/ui/icons";
import { getModel, PROVIDER_LABELS } from "@/lib/ai/models";
import { parseOutputAsCards } from "@/lib/outputParser";
import {
  buildRunOutcomePayload,
  computeBoardStructure,
  sendTelemetry,
  structureFingerprint,
} from "@/lib/telemetry";
import {
  rememberRunPrompt,
  reportRunQuality,
  reportRunStarted,
} from "@/lib/sessionTracker";
import { StructuredOutput } from "@/components/panels/StructuredOutput";
import { deliverableToMarkdown, getTemplate } from "@/lib/templates";
import type { BoardRun } from "@/lib/types";

type RunState = "idle" | "running" | "done" | "error";

const STARTER_INSTRUCTIONS = [
  "Produce the deliverable this board describes, worked through to a finished, usable state.",
  "Critique this plan and propose 3 concrete improvements.",
  "Convert this into a step-by-step checklist with owners.",
  "Generate the artifact, then self-review it against the brief.",
];

export function RunPanel() {
  const open = useUIStore((s) => s.runOpen);
  const board = useBoardStore((s) => s.boards[s.activeBoardId]);
  const boardTemplates = useUIStore((s) => s.boardTemplates);
  const aiConfig = useSyncExternalStore(
    subscribeAIConfig,
    aiConfigSnapshot,
    aiConfigServerSnapshot,
  );
  const { toast } = useToast();

  const [instruction, setInstruction] = useState(DEFAULT_RUN_INSTRUCTION);
  const [state, setState] = useState<RunState>("idle");
  const [textOutput, setTextOutput] = useState("");
  const [thinkingOutput, setThinkingOutput] = useState("");
  const [showThinking, setShowThinking] = useState(false);
  const [error, setError] = useState("");
  const [rated, setRated] = useState<null | 1 | -1>(null);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const outRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      setRated(null);
    }
  }, [open]);

  useEffect(() => {
    if (state === "running" && outRef.current) {
      outRef.current.scrollTop = outRef.current.scrollHeight;
    }
  }, [textOutput, state]);

  // Resolve the template for this board, if any.
  const template = useMemo(() => {
    if (!board) return null;
    const tplId = boardTemplates[board.id];
    return tplId ? getTemplate(tplId as never) ?? null : null;
  }, [board, boardTemplates]);

  if (!open || !board) return null;

  const cardCount = Object.keys(board.cards).length;
  const modelSpec = getModel(aiConfig.model);
  const provider = modelProvider(aiConfig.model);
  const hasKey = !!getProviderKey(provider);
  const modelLabel = modelSpec?.label ?? aiConfig.model;

  const run = async () => {
    const prompt = buildRunPrompt(board, instruction);
    const controller = new AbortController();
    abortRef.current = controller;
    setState("running");
    setTextOutput("");
    setThinkingOutput("");
    setShowThinking(false);
    setError("");
    setRated(null);
    track("run_started", {
      cards: cardCount,
      provider,
      model: aiConfig.model,
    });
    reportRunStarted();
    const fp = await structureFingerprint(board);
    const structure = computeBoardStructure(board, fp);
    sendTelemetry({ kind: "structure", structure });
    rememberRunPrompt(fp);

    const t0 = Date.now();
    const collected: string[] = [];
    try {
      for await (const evt of streamRun(prompt, controller.signal)) {
        if (evt.kind === "text") {
          collected.push(evt.delta);
          setTextOutput((prev) => prev + evt.delta);
        } else if (evt.kind === "thinking") {
          setThinkingOutput((prev) => prev + evt.delta);
        }
      }
      const fullText = collected.join("");
      const durationMs = Date.now() - t0;
      setState("done");
      track("run_completed", {
        cards: cardCount,
        provider,
        model: aiConfig.model,
        duration_ms: durationMs,
      });
      const outcome = await buildRunOutcomePayload({
        board,
        provider,
        model: aiConfig.model,
        prompt,
        outputTokens: Math.ceil(fullText.length / 4),
        durationMs,
        status: "ok",
      });
      sendTelemetry({ kind: "run", run: outcome });

      const runId = crypto.randomUUID();
      const boardRun: BoardRun = {
        id: runId,
        at: Date.now(),
        provider,
        model: aiConfig.model,
        promptFingerprint: fp,
        inputTokens: outcome.inputTokens,
        outputTokens: outcome.outputTokens,
        durationMs,
        status: "ok",
        cards: cardCount,
        output: fullText,
      };
      useBoardStore.getState().recordRun(board.id, boardRun);
      setLastRunId(runId);
    } catch (e) {
      if (controller.signal.aborted) {
        setState(textOutput ? "done" : "idle");
      } else {
        setError(
          e instanceof Error ? e.message : "The run failed — try again.",
        );
        setState("error");
      }
    } finally {
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  const handOff = async () => {
    const prompt = buildHandoffPrompt(board, instruction);
    track("open_in_claude", {
      cards: cardCount,
      provider,
      model: aiConfig.model,
    });
    const how = await openInModel(provider, prompt);
    const targetLabel =
      provider === "anthropic"
        ? "Claude"
        : provider === "openai"
          ? "ChatGPT"
          : provider === "gemini"
            ? "Gemini"
            : provider === "minimax"
              ? "MiniMax"
              : "Kimi";
    toast({
      message:
        how === "opened"
          ? `Opened ${targetLabel} with your board pre-filled.`
          : `Prompt copied — paste it into the ${targetLabel} tab that just opened.`,
      variant: "success",
    });
  };

  const addToBoard = () => {
    const state = useBoardStore.getState();
    const center = getCanvas()?.viewportCenterWorld() ?? { x: 0, y: 0 };
    const id = state.addCard(state.activeBoardId, {
      type: "resource",
      title: `Run result — ${board.name}`,
      body: textOutput.slice(0, MAX_BODY),
      x: Math.round(center.x - CARD_W / 2),
      y: Math.round(center.y - 60),
    });
    if (id) {
      useUIStore.getState().setSelection([id]);
      track("result_added_to_board", { cards: cardCount });
      reportRunQuality({ addedToBoard: true });
      toast({
        message:
          textOutput.length > MAX_BODY
            ? "Result added as a card (trimmed to fit — copy for the full text)."
            : "Result added to the board.",
        variant: "success",
      });
    }
  };

  const splitIntoCards = () => {
    const parsed = parseOutputAsCards(textOutput);
    if (parsed.length === 0) {
      toast({ message: "Nothing to split.", variant: "warn" });
      return;
    }
    const store = useBoardStore.getState();
    const center = getCanvas()?.viewportCenterWorld() ?? { x: 0, y: 0 };
    const divisionId = store.addDivision(store.activeBoardId, {
      x: Math.round(center.x - 360),
      y: Math.round(center.y - 240),
      w: 720,
      h: 480,
    }, "Run output");
    if (!divisionId) return;
    const ids: string[] = [];
    let i = 0;
    for (const section of parsed) {
      for (const item of section.items) {
        const row = Math.floor(i / 4);
        const col = i % 4;
        const id = store.addCard(store.activeBoardId, {
          type: "insight",
          title: section.items.length === 1 ? section.name : `${section.name}: ${item.text.slice(0, 60)}`,
          body: item.text,
          x: Math.round(center.x - 340 + col * 180),
          y: Math.round(center.y - 220 + row * 160),
          divisionId,
        });
        if (id) ids.push(id);
        i++;
      }
    }
    if (ids.length > 0) {
      useUIStore.getState().setSelection(ids);
      track("result_split_into_cards", {
        cards: cardCount,
        sections: parsed.length,
        new_cards: ids.length,
      });
      reportRunQuality({ splitIntoCards: true });
      toast({
        message: `${ids.length} cards across ${parsed.length} sections added under "Run output".`,
        variant: "success",
      });
    }
  };

  const rate = (rating: 1 | -1) => {
    setRated(rating);
    track(rating === 1 ? "run_helpful_yes" : "run_helpful_no", {
      cards: cardCount,
      provider,
      model: aiConfig.model,
    });
    reportRunQuality({ rating });
    if (lastRunId) {
      useBoardStore
        .getState()
        .rateRun(board.id, lastRunId, rating);
    }
  };

  const exportDeliverable = async () => {
    const baseText = template
      ? deliverableToMarkdown(template.renderOutput(textOutput))
      : textOutput;
    const header = `# ${board.name}\nGenerated ${new Date().toLocaleString()}\n\n`;
    const full = header + baseText;
    if (await copyText(full)) {
      toast({
        message: "Deliverable copied to clipboard. Paste into Notion or anywhere.",
        variant: "success",
      });
    } else {
      toast({ message: "Couldn't access the clipboard.", variant: "error" });
    }
  };

  return (
    <div
      className="glass-strong absolute top-3 right-3 bottom-3 w-[460px]
        max-w-[calc(100vw-24px)] z-40 rounded-xl flex flex-col fade-up"
    >
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <h2 className="text-[14px] font-semibold tracking-tight">
          {template ? template.name : "Run board"}
        </h2>
        <span
          className="text-[11px] font-medium text-[var(--ink-faint)] rounded-md
            px-1.5 py-0.5 bg-[var(--glass)] border border-[var(--border)]"
        >
          {cardCount} cards
        </span>
        <button
          type="button"
          aria-label="Close Run panel"
          onClick={() => useUIStore.getState().setRunOpen(false)}
          className="ml-auto w-8 h-8 inline-flex items-center justify-center
            rounded-lg text-[var(--ink-faint)] hover:text-[var(--ink)]
            hover:bg-[var(--accent-soft)]"
        >
          <CloseIcon size={13} />
        </button>
      </div>

      <div className="px-4 pb-2 flex items-center gap-2 text-[11px]">
        <span className="text-[var(--ink-faint)]">{PROVIDER_LABELS[provider]}</span>
        <span className="font-medium">{modelLabel}</span>
        <button
          type="button"
          onClick={() => useUIStore.getState().setConnectAIOpen(true)}
          className="ml-auto text-[11px] font-medium text-[var(--ink-dim)]
            hover:text-[var(--ink)] hover:underline"
        >
          Change
        </button>
      </div>

      {!hasKey ? (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <p className="text-[12.5px] leading-relaxed text-[var(--ink-dim)]">
            The compiled board becomes the prompt. Two ways to run it:
          </p>
          <button
            type="button"
            onClick={handOff}
            className="btn-primary h-10 rounded-lg inline-flex items-center
              justify-center gap-2 text-[13.5px] font-semibold"
          >
            <PlayIcon size={14} />
            Open in {provider === "anthropic" ? "Claude" : provider === "openai" ? "ChatGPT" : provider === "gemini" ? "Gemini" : provider === "minimax" ? "MiniMax" : "Kimi"}
          </button>
          <button
            type="button"
            onClick={() => useUIStore.getState().setConnectAIOpen(true)}
            className="glass h-10 rounded-lg inline-flex items-center
              justify-center gap-2 text-[13px] font-medium
              text-[var(--ink-dim)] hover:text-[var(--ink)]
              hover:border-[var(--border-strong)]"
          >
            <KeyIcon size={14} />
            Connect your {PROVIDER_LABELS[provider]} key — run in-app
          </button>
        </div>
      ) : (
        <>
          <div className="px-4 pb-2">
            <label
              className="text-[11px] font-semibold tracking-wide
                text-[var(--ink-faint)]"
            >
              WHAT SHOULD THE MODEL DO WITH THIS BOARD?
            </label>
            <textarea
              value={instruction}
              rows={3}
              disabled={state === "running"}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="mt-1 w-full rounded-lg bg-[var(--glass)] border
                border-[var(--glass-border)] px-2.5 py-2 text-[12.5px]
                leading-relaxed outline-none resize-none disabled:opacity-60"
            />
            <div className="mt-1 flex flex-wrap gap-1">
              {STARTER_INSTRUCTIONS.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={state === "running"}
                  onClick={() => setInstruction(s)}
                  className="text-[10.5px] px-2 py-1 rounded-full border
                    border-[var(--border)] text-[var(--ink-faint)]
                    hover:text-[var(--ink)] hover:border-[var(--border-strong)]
                    disabled:opacity-40"
                >
                  Starter {i + 1}
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              {state === "running" ? (
                <button
                  type="button"
                  onClick={stop}
                  className="glass h-9 px-4 rounded-lg text-[13px] font-semibold
                    text-[var(--danger)]"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={run}
                  className="btn-primary h-9 px-4 rounded-lg inline-flex
                    items-center gap-1.5 text-[13px] font-semibold"
                >
                  <PlayIcon size={13} />
                  {state === "done" || state === "error" ? "Re-run" : "Run"}
                </button>
              )}
              <button
                type="button"
                onClick={handOff}
                disabled={state === "running"}
                className="h-9 px-2.5 rounded-lg text-[12px] font-medium
                  text-[var(--ink-faint)] hover:text-[var(--ink)]
                  disabled:opacity-50"
              >
                Open in browser instead
              </button>
            </div>
          </div>

          {error && (
            <div
              className="mx-4 mb-2 rounded-lg px-3 py-2 text-[12px] leading-snug
                text-[var(--danger)] bg-[rgba(229,72,77,0.08)] border
                border-[rgba(229,72,77,0.25)]"
            >
              {error}
            </div>
          )}

          {thinkingOutput && (
            <div className="px-4 pb-2">
              <button
                type="button"
                onClick={() => setShowThinking((v) => !v)}
                className="text-[11px] text-[var(--ink-faint)] hover:text-[var(--ink)]"
              >
                {showThinking ? "Hide reasoning" : "Show reasoning"} ·{" "}
                {thinkingOutput.length.toLocaleString()} chars
              </button>
              {showThinking && (
                <pre className="mt-1 thin-scroll max-h-32 overflow-auto rounded-lg
                  bg-[var(--glass)] border border-[var(--border)] p-2
                  text-[11px] font-mono whitespace-pre-wrap text-[var(--ink-dim)]">
                  {thinkingOutput}
                </pre>
              )}
            </div>
          )}

          <div
            ref={outRef}
            className="thin-scroll flex-1 overflow-auto mx-2 mb-2 px-3 py-3
              rounded-lg bg-[var(--glass)] border border-[var(--border)]
              select-text"
          >
            {textOutput ? (
              <StructuredOutput
                text={textOutput}
                zones={template?.zones ?? []}
                streaming={state === "running"}
              />
            ) : (
              <div className="text-[12.5px] text-[var(--ink-faint)] italic">
                {state === "running"
                  ? "Thinking…"
                  : template
                    ? `Run to generate a structured ${template.name.toLowerCase()}.`
                    : "The result streams here. Open the X-Ray (⌘.) to see exactly what gets sent."}
              </div>
            )}
          </div>

          {state === "done" && (
            <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={exportDeliverable}
                className="btn-primary h-9 px-3.5 rounded-lg text-[12.5px]
                  font-semibold inline-flex items-center gap-1.5"
              >
                <DownloadIcon size={13} />
                Copy deliverable
              </button>
              <button
                type="button"
                onClick={splitIntoCards}
                className="glass h-9 px-3 rounded-lg text-[12.5px]
                  font-medium text-[var(--ink-dim)] hover:text-[var(--ink)]"
              >
                Split into cards
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (await copyText(textOutput)) {
                    toast({ message: "Markdown copied.", variant: "success" });
                  }
                }}
                className="glass h-9 px-3 rounded-lg inline-flex items-center
                  gap-1.5 text-[12.5px] font-medium text-[var(--ink-dim)]
                  hover:text-[var(--ink)]"
              >
                <CopyIcon size={12} />
                Copy raw
              </button>
              <div className="ml-auto flex items-center gap-1">
                <span className="text-[11px] text-[var(--ink-faint)] mr-1">
                  Helpful?
                </span>
                <button
                  type="button"
                  aria-label="Thumbs up"
                  onClick={() => rate(1)}
                  className={`h-7 w-7 rounded-md border text-[12px] ${
                    rated === 1
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  👍
                </button>
                <button
                  type="button"
                  aria-label="Thumbs down"
                  onClick={() => rate(-1)}
                  className={`h-7 w-7 rounded-md border text-[12px] ${
                    rated === -1
                      ? "border-[var(--danger)] bg-[rgba(229,72,77,0.08)]"
                      : "border-[var(--border)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  👎
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

void useToastEnsure;
function useToastEnsure() { /* typecheck helper */ }