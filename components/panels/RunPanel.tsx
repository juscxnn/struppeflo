"use client";

import { useEffect, useRef, useState } from "react";
import { useSyncExternalStore } from "react";
import { useBoardStore } from "@/lib/store/boardStore";
import { useUIStore } from "@/lib/store/uiStore";
import {
  aiConfigServerSnapshot,
  aiConfigSnapshot,
  AI_MODELS,
  subscribeAIConfig,
} from "@/lib/aiConfig";
import {
  buildRunPrompt,
  DEFAULT_RUN_INSTRUCTION,
  openInClaude,
  streamRun,
} from "@/lib/run";
import { copyText } from "@/lib/clipboard";
import { getCanvas } from "@/lib/canvasBridge";
import { CARD_W, MAX_BODY } from "@/lib/constants";
import { useToast } from "@/components/ui/Toast";
import {
  CloseIcon,
  CopyIcon,
  KeyIcon,
  PlayIcon,
} from "@/components/ui/icons";

type RunState = "idle" | "running" | "done" | "error";

/**
 * The Run panel closes the loop: board → compiled prompt → Claude → result
 * back on the board. With a connected key it streams in-app; without one it
 * hands off to claude.ai with the prompt pre-filled.
 */
export function RunPanel() {
  const open = useUIStore((s) => s.runOpen);
  const board = useBoardStore((s) => s.boards[s.activeBoardId]);
  const aiConfig = useSyncExternalStore(
    subscribeAIConfig,
    aiConfigSnapshot,
    aiConfigServerSnapshot,
  );
  const { toast } = useToast();

  const [instruction, setInstruction] = useState(DEFAULT_RUN_INSTRUCTION);
  const [state, setState] = useState<RunState>("idle");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const outRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    // Leaving the panel mid-run cancels the request.
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    // Follow the stream.
    if (state === "running" && outRef.current) {
      outRef.current.scrollTop = outRef.current.scrollHeight;
    }
  }, [output, state]);

  if (!open || !board) return null;

  const cardCount = Object.keys(board.cards).length;
  const modelLabel =
    AI_MODELS.find((m) => m.id === aiConfig.model)?.label ?? aiConfig.model;

  const run = async () => {
    const prompt = buildRunPrompt(board, instruction);
    const controller = new AbortController();
    abortRef.current = controller;
    setState("running");
    setOutput("");
    setError("");
    try {
      for await (const delta of streamRun(prompt, controller.signal)) {
        setOutput((prev) => prev + delta);
      }
      setState("done");
    } catch (e) {
      if (controller.signal.aborted) {
        setState(output ? "done" : "idle");
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
    const prompt = buildRunPrompt(board, instruction);
    const how = await openInClaude(prompt);
    toast({
      message:
        how === "opened"
          ? "Opened in Claude with your board pre-filled."
          : "Prompt copied — paste it into the Claude tab that just opened.",
      variant: "success",
    });
  };

  const addToBoard = () => {
    const state = useBoardStore.getState();
    const center = getCanvas()?.viewportCenterWorld() ?? { x: 0, y: 0 };
    const id = state.addCard(state.activeBoardId, {
      type: "resource",
      title: `Run result — ${board.name}`,
      body: output.slice(0, MAX_BODY),
      x: Math.round(center.x - CARD_W / 2),
      y: Math.round(center.y - 60),
    });
    if (id) {
      useUIStore.getState().setSelection([id]);
      toast({
        message:
          output.length > MAX_BODY
            ? "Result added as a card (trimmed to fit — copy for the full text)."
            : "Result added to the board.",
        variant: "success",
      });
    }
  };

  return (
    <div
      className="glass-strong absolute top-3 right-3 bottom-3 w-[400px]
        max-w-[calc(100vw-24px)] z-40 rounded-xl flex flex-col fade-up"
    >
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <h2 className="text-[14px] font-semibold tracking-tight">Run board</h2>
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

      {!aiConfig.apiKey ? (
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
            Open in Claude
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
            Connect your Anthropic key — run in-app
          </button>
          <p className="text-[11.5px] leading-snug text-[var(--ink-faint)]">
            With a key, runs stream right here and results land back on the
            board. The key stays in this browser and talks only to Anthropic.
          </p>
        </div>
      ) : (
        <>
          <div className="px-4 pb-2">
            <label
              className="text-[11px] font-semibold tracking-wide
                text-[var(--ink-faint)]"
            >
              WHAT SHOULD CLAUDE DO WITH THIS BOARD?
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
                  {state === "done" || state === "error" ? "Run again" : "Run"}
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
                Open in Claude instead
              </button>
              <span className="ml-auto text-[11px] text-[var(--ink-faint)]">
                {modelLabel}
              </span>
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

          <pre
            ref={outRef}
            className="thin-scroll flex-1 overflow-auto mx-2 mb-2 px-3 py-2
              rounded-lg bg-[var(--glass)] border border-[var(--border)]
              text-[12px] leading-relaxed font-sans whitespace-pre-wrap
              text-[var(--ink)] select-text"
          >
            {output ||
              (state === "running"
                ? "Thinking…"
                : "The result streams here. Your board compiles into the prompt automatically — open the X-Ray (⌘.) to see exactly what gets sent.")}
          </pre>

          {(state === "done" || (state === "error" && output)) && (
            <div className="px-4 pb-3 flex items-center gap-2">
              <button
                type="button"
                onClick={addToBoard}
                className="btn-primary h-9 px-3.5 rounded-lg text-[12.5px]
                  font-semibold"
              >
                Add result to board
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (await copyText(output)) {
                    toast({ message: "Result copied.", variant: "success" });
                  }
                }}
                className="glass h-9 px-3 rounded-lg inline-flex items-center
                  gap-1.5 text-[12.5px] font-medium text-[var(--ink-dim)]
                  hover:text-[var(--ink)]"
              >
                <CopyIcon size={12} />
                Copy
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
