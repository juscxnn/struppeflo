"use client";

import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { useCanvas } from "./CanvasProvider";
import { Popover } from "@/components/ui/Popover";
import { FlipIcon, TrashIcon } from "@/components/ui/icons";
import type { ID } from "@/lib/types";

/**
 * One link concept. The user just connects two cards. Direction is inferred
 * from spatial position (the compiler reads top-to-bottom, left-to-right).
 * `related_to` is the default; `depends_on` and `input_to` still exist in the
 * data model for templates and AI-suggested links, but the UI never exposes
 * them as a choice.
 *
 * The popover offers two actions: flip which endpoint is "first" in space,
 * and delete. That's it.
 */
export function LinkPopover({
  linkId,
  screen,
  onClose,
}: {
  linkId: ID;
  screen: { x: number; y: number; normal?: { x: number; y: number } };
  onClose: () => void;
}) {
  const ctx = useCanvas();
  const link = useStore(ctx.store, (s) => s.boards[ctx.boardId]?.links[linkId]);
  const [hover, setHover] = useState<"flip" | "delete" | null>(null);

  useEffect(() => {
    if (!link) onClose();
  }, [link, onClose]);

  if (!link) return null;
  const canEdit = ctx.policy.createLinks;

  // Push the popover off the link so it doesn't occlude the line. The normal
  // comes from the bezier midpoint; if it's missing (very short links), fall
  // back to a default upward push.
  const n = screen.normal ?? { x: 0, y: -1 };
  const offset = 20;
  const ax = screen.x + n.x * offset;
  const ay = screen.y + n.y * offset;

  return (
    <Popover anchor={{ x: ax, y: ay, w: 0, h: 0 }} onClose={onClose}>
      <div className="p-1.5 flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
        {canEdit && (
          <>
            <button
              type="button"
              title="Swap which end is first"
              onMouseEnter={() => setHover("flip")}
              onMouseLeave={() => setHover(null)}
              onClick={() =>
                ctx.store.getState().updateLink(ctx.boardId, linkId, {
                  from: link.to,
                  to: link.from,
                })
              }
              className={`inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[12.5px]
                font-medium transition-colors whitespace-nowrap
                ${hover === "flip" ? "bg-[var(--accent-soft)] text-[var(--ink)]" : "text-[var(--ink-dim)] hover:bg-[var(--accent-soft)]"}`}
            >
              <FlipIcon size={13} />
              {hover === "flip" ? "Swap ends" : "Flip"}
            </button>
            <div className="w-px h-5 mx-0.5 bg-[var(--glass-border)]" />
          </>
        )}
        {canEdit && (
          <button
            type="button"
            title="Delete link"
            onMouseEnter={() => setHover("delete")}
            onMouseLeave={() => setHover(null)}
            onClick={() => {
              ctx.store.getState().deleteLink(ctx.boardId, linkId);
              onClose();
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[12.5px]
              font-medium transition-colors whitespace-nowrap
              ${hover === "delete" ? "text-[var(--danger)] bg-[rgba(229,72,77,0.1)]" : "text-[var(--ink-dim)] hover:bg-[var(--accent-soft)]"}`}
          >
            <TrashIcon size={13} />
            Delete
          </button>
        )}
      </div>
    </Popover>
  );
}
