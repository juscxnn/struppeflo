"use client";

import { useStore } from "zustand";
import { useCanvas } from "./CanvasProvider";
import { useUIStore } from "@/lib/store/uiStore";
import { LINK_TYPE_META } from "@/lib/constants";
import { anchorsFor, bezierBetween } from "@/lib/geometry";
import type { LinkSuggestion } from "@/lib/types";

/**
 * AI link suggestions as ghost beziers with accept/dismiss chips, rendered in
 * world space. Suggestions referencing unknown cards (other boards) render
 * nothing, so this is inert on the landing demo.
 */
export function SuggestionLayer() {
  const ctx = useCanvas();
  const suggestions = useUIStore((s) => s.linkSuggestions);
  const board = useStore(ctx.store, (s) => s.boards[ctx.boardId]);
  if (!board || suggestions.length === 0) return null;

  const resolved = suggestions
    .map((sug, index) => {
      const from = board.cards[sug.from];
      const to = board.cards[sug.to];
      if (!from || !to) return null;
      const anchors = anchorsFor(from, to);
      return { sug, index, bez: bezierBetween(anchors.a, anchors.b) };
    })
    .filter(Boolean) as Array<{
    sug: LinkSuggestion;
    index: number;
    bez: ReturnType<typeof bezierBetween>;
  }>;

  if (resolved.length === 0) return null;

  const dismiss = (index: number) => {
    const ui = useUIStore.getState();
    ui.setLinkSuggestions(ui.linkSuggestions.filter((_, i) => i !== index));
  };

  const accept = (index: number) => {
    const ui = useUIStore.getState();
    const sug = ui.linkSuggestions[index];
    if (sug) {
      ctx.store.getState().addLink(ctx.boardId, sug.from, sug.to, sug.type, true);
    }
    dismiss(index);
  };

  return (
    <>
      <svg
        aria-hidden
        width={0}
        height={0}
        className="absolute top-0 left-0 overflow-visible"
        style={{ pointerEvents: "none" }}
      >
        {resolved.map(({ sug, index, bez }) => (
          <path
            key={index}
            d={bez.d}
            fill="none"
            stroke={LINK_TYPE_META[sug.type].color}
            strokeWidth={1.6}
            strokeDasharray="4 5"
            opacity={0.75}
          />
        ))}
      </svg>
      {resolved.map(({ sug, index, bez }) => (
        <div
          key={index}
          className="absolute glass-strong rounded-full flex items-center gap-0.5
            pl-2.5 pr-1 py-0.5 text-[11px] font-medium whitespace-nowrap z-[9998]"
          style={{
            left: bez.mid.x,
            top: bez.mid.y,
            transform: "translate(-50%, -50%)",
          }}
          title={sug.reason}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="text-[var(--ink-dim)]">
            {LINK_TYPE_META[sug.type].label}
          </span>
          <button
            type="button"
            aria-label="Accept suggestion"
            onClick={() => accept(index)}
            className="w-5 h-5 inline-flex items-center justify-center rounded-full
              text-[var(--accent)] hover:bg-[var(--accent-soft)] font-semibold"
          >
            ✓
          </button>
          <button
            type="button"
            aria-label="Dismiss suggestion"
            onClick={() => dismiss(index)}
            className="w-5 h-5 inline-flex items-center justify-center rounded-full
              text-[var(--ink-faint)] hover:text-[var(--ink)]"
          >
            ×
          </button>
        </div>
      ))}
    </>
  );
}
