"use client";

import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { useCanvas } from "./CanvasProvider";
import { Popover } from "@/components/ui/Popover";
import { FlipIcon, TrashIcon } from "@/components/ui/icons";
import { anchorsFor, bezierBetween } from "@/lib/geometry";
import type { ID } from "@/lib/types";

const ORDERED_DESC =
  "The connected card runs first. Drag a card into this one to flip.";
const CONNECTED_DESC = "Just related. No order. The compiler figures it out.";

/**
 * Two states, not three:
 *   - depends_on (ordered) — the connected card runs first; arrow on the line.
 *   - related_to (connected) — just related, no order; dashed line, no arrow.
 *
 * The legacy `input_to` type still exists in the data model and templates use
 * it, but the UI never offers it as a choice — it's a refinement the model
 * makes on its own.
 */
export function LinkPopover({
  linkId,
  screen,
  onClose,
}: {
  linkId: ID;
  screen: { x: number; y: number };
  onClose: () => void;
}) {
  const ctx = useCanvas();
  const link = useStore(ctx.store, (s) => s.boards[ctx.boardId]?.links[linkId]);
  const [hover, setHover] = useState<"ordered" | "connected" | null>(null);

  useEffect(() => {
    if (!link) onClose();
  }, [link, onClose]);

  if (!link) return null;
  const canEdit = ctx.policy.createLinks;
  const isOrdered = link.type === "depends_on" || link.type === "input_to";

  const setType = (type: "depends_on" | "related_to") => {
    ctx.store.getState().updateLink(ctx.boardId, linkId, { type });
  };

  const board = ctx.store.getState().boards[ctx.boardId];
  const a = board?.cards[link.from];
  const b = board?.cards[link.to];

  return (
    <Popover anchor={{ x: screen.x, y: screen.y, w: 0, h: 0 }} onClose={onClose}>
      <div
        className="p-2 w-64"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--ink-faint)] mb-1.5">
          Link
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setType("depends_on")}
            onMouseEnter={() => setHover("ordered")}
            onMouseLeave={() => setHover(null)}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left
              ${isOrdered ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--accent-soft)]"}
              disabled:opacity-50`}
          >
            <span className="shrink-0 inline-flex items-center" style={{ width: 22 }}>
              <svg width="22" height="14" viewBox="0 0 22 14" fill="none">
                <line x1="1" y1="7" x2="14" y2="7" stroke="var(--link-depends)" strokeWidth="1.6" />
                <path d="M14 7 L9 3 M14 7 L9 11" stroke="var(--link-depends)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              </svg>
            </span>
            <span className="min-w-0">
              <div className="text-[13px] font-medium">Ordered</div>
              <div className="text-[11.5px] text-[var(--ink-faint)] leading-snug">
                {hover === "ordered" ? ORDERED_DESC : "This card runs first"}
              </div>
            </span>
          </button>

          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setType("related_to")}
            onMouseEnter={() => setHover("connected")}
            onMouseLeave={() => setHover(null)}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left
              ${!isOrdered ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--accent-soft)]"}
              disabled:opacity-50`}
          >
            <span className="shrink-0 inline-flex items-center" style={{ width: 22 }}>
              <svg width="22" height="14" viewBox="0 0 22 14" fill="none">
                <line x1="2" y1="7" x2="20" y2="7" stroke="var(--link-related)" strokeWidth="1.6" strokeDasharray="4 3" />
              </svg>
            </span>
            <span className="min-w-0">
              <div className="text-[13px] font-medium">Connected</div>
              <div className="text-[11.5px] text-[var(--ink-faint)] leading-snug">
                {hover === "connected" ? CONNECTED_DESC : "Just related. No order."}
              </div>
            </span>
          </button>
        </div>

        {canEdit && a && b && (
          <div className="mt-2 pt-2 border-t border-[var(--glass-border)] flex items-center gap-1">
            <button
              type="button"
              title="Flip direction"
              onClick={() =>
                ctx.store
                  .getState()
                  .updateLink(ctx.boardId, linkId, { from: link.to, to: link.from })
              }
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg
                text-[12px] font-medium text-[var(--ink-dim)] hover:bg-[var(--accent-soft)]
                hover:text-[var(--ink)]"
            >
              <FlipIcon size={13} />
              Flip
            </button>
            <button
              type="button"
              title="Delete link"
              onClick={() => {
                ctx.store.getState().deleteLink(ctx.boardId, linkId);
                onClose();
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-lg
                text-[12px] font-medium text-[var(--ink-dim)]
                hover:text-[var(--danger)] hover:bg-[rgba(229,72,77,0.1)]"
            >
              <TrashIcon size={13} />
              Delete
            </button>
          </div>
        )}
      </div>
    </Popover>
  );
}

// Avoid unused import warning when anchorsFor/bezierBetween aren't referenced.
void anchorsFor;
void bezierBetween;