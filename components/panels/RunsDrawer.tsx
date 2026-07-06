"use client";

import { useMemo } from "react";
import { useStore } from "zustand";
import { useBoardStore } from "@/lib/store/boardStore";
import { useUIStore } from "@/lib/store/uiStore";
import { deliverableToMarkdown, getTemplate } from "@/lib/templates";
import { copyText } from "@/lib/clipboard";
import { useToast } from "@/components/ui/Toast";
import { CloseIcon, CopyIcon, PlayIcon } from "@/components/ui/icons";
import type { BoardRun } from "@/lib/types";

/**
 * Right-rail drawer that shows past runs for the current board. Each entry
 * has model, duration, status, thumbs feedback, and a "Use this prompt" button
 * to repopulate the Run panel with the saved output.
 */
export function RunsDrawer() {
  const open = useUIStore((s) => s.runsDrawerOpen);
  const board = useStore(useBoardStore, (s) => s.boards[s.activeBoardId]);
  const boardTemplates = useUIStore((s) => s.boardTemplates);
  const { toast } = useToast();

  const runs = useMemo<BoardRun[]>(
    () => (board && Array.isArray(board.runs) ? board.runs : []),
    [board],
  );

  if (!open) return null;

  const close = () => useUIStore.getState().setRunsDrawerOpen(false);

  return (
    <aside
      className="glass-strong absolute top-3 right-3 bottom-3 w-[360px]
        max-w-[calc(100vw-24px)] z-40 rounded-xl flex flex-col fade-up"
      aria-label="Past runs"
    >
      <header className="flex items-center gap-2 px-4 pt-3.5 pb-2 border-b border-[var(--border)]">
        <h2 className="text-[14px] font-semibold tracking-tight">Runs</h2>
        <span className="text-[11px] text-[var(--ink-faint)]">
          {runs.length} {runs.length === 1 ? "run" : "runs"}
        </span>
        <button
          type="button"
          aria-label="Close runs drawer"
          onClick={close}
          className="ml-auto w-8 h-8 inline-flex items-center justify-center
            rounded-lg text-[var(--ink-faint)] hover:text-[var(--ink)]
            hover:bg-[var(--accent-soft)]"
        >
          <CloseIcon size={13} />
        </button>
      </header>

      <div className="thin-scroll flex-1 overflow-auto p-3">
        {runs.length === 0 ? (
          <div className="px-3 py-8 text-center text-[12.5px] text-[var(--ink-faint)]">
            No runs yet. Click <span className="font-medium text-[var(--ink-dim)]">Run</span> to start.
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {runs.map((run, idx) => (
              <RunRow
                key={run.id}
                run={run}
                isFirst={idx === 0}
                templateId={board && boardTemplates[board.id]}
                onReuse={() => {
                  if (!board || !run.output) return;
                  useUIStore.getState().setRunsDrawerOpen(false);
                  useUIStore.getState().setRunOpen(true);
                  toast({
                    message: "Run panel re-opened with this run's output.",
                    variant: "info",
                  });
                }}
                onCopy={async () => {
                  if (!board || !run.output) return;
                  const tpl = boardTemplates[board.id]
                    ? getTemplate(boardTemplates[board.id] as never)
                    : null;
                  const text = tpl
                    ? deliverableToMarkdown(tpl.renderOutput(run.output))
                    : run.output;
                  if (await copyText(text)) {
                    toast({
                      message: "Deliverable copied.",
                      variant: "success",
                    });
                  }
                }}
              />
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}

function RunRow({
  run,
  isFirst,
  onReuse,
  onCopy,
}: {
  run: BoardRun;
  isFirst: boolean;
  templateId?: string;
  onReuse: () => void;
  onCopy: () => Promise<void>;
}) {
  const date = new Date(run.at);
  const rating = run.rating;
  return (
    <li
      className={`rounded-lg border p-3 ${
        isFirst
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--border)] bg-[var(--glass)]"
      }`}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[12px] font-semibold tabular-nums">
          {date.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span className="text-[10.5px] uppercase tracking-wider text-[var(--ink-faint)]">
          {run.status === "ok" ? "OK" : run.status}
        </span>
        {isFirst && (
          <span className="ml-auto text-[10px] font-semibold tracking-wider uppercase text-[var(--accent)]">
            latest
          </span>
        )}
      </div>
      <div className="mt-1 text-[11.5px] text-[var(--ink-dim)] leading-snug">
        {run.model} · {(run.durationMs / 1000).toFixed(1)}s · {run.cards} cards
      </div>
      {typeof rating === "number" && (
        <div className="mt-1 text-[12px]">{rating === 1 ? "👍" : "👎"}</div>
      )}
      <div className="mt-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onReuse}
          className="flex-1 h-8 inline-flex items-center justify-center gap-1
            rounded-md text-[12px] font-medium text-[var(--ink-dim)]
            hover:text-[var(--ink)] hover:bg-[var(--accent-soft)] border
            border-[var(--border)]"
        >
          <PlayIcon size={11} />
          Use output
        </button>
        <button
          type="button"
          onClick={onCopy}
          disabled={!run.output}
          className="flex-1 h-8 inline-flex items-center justify-center gap-1
            rounded-md text-[12px] font-medium text-[var(--ink-dim)]
            hover:text-[var(--ink)] hover:bg-[var(--accent-soft)] border
            border-[var(--border)] disabled:opacity-40"
        >
          <CopyIcon size={11} />
          Copy
        </button>
      </div>
    </li>
  );
}