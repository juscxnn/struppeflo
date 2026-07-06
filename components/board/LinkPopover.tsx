"use client";

import { useEffect } from "react";
import { useStore } from "zustand";
import { useCanvas } from "./CanvasProvider";
import { Popover } from "@/components/ui/Popover";
import { FlipIcon, TrashIcon } from "@/components/ui/icons";
import { LINK_TYPE_META } from "@/lib/constants";
import { LINK_TYPES, type ID } from "@/lib/types";

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

  useEffect(() => {
    if (!link) onClose();
  }, [link, onClose]);

  if (!link) return null;
  const canEdit = ctx.policy.createLinks;

  return (
    <Popover anchor={{ x: screen.x, y: screen.y, w: 0, h: 0 }} onClose={onClose}>
      <div
        className="p-1.5 flex items-center gap-1"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {LINK_TYPES.map((t) => {
          const meta = LINK_TYPE_META[t];
          const active = link.type === t;
          return (
            <button
              key={t}
              type="button"
              disabled={!canEdit}
              onClick={() =>
                ctx.store.getState().updateLink(ctx.boardId, linkId, { type: t })
              }
              className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[12.5px]
                font-medium transition-colors whitespace-nowrap
                ${active ? "bg-[var(--accent-soft)] text-[var(--ink)]" : "text-[var(--ink-dim)] hover:bg-[var(--accent-soft)]"}`}
            >
              <span
                aria-hidden
                className="w-2 h-2 rounded-full"
                style={{ background: meta.color }}
              />
              {meta.label}
            </button>
          );
        })}
        {canEdit && (
          <>
            <div className="w-px h-5 mx-0.5 bg-[var(--glass-border)]" />
            <button
              type="button"
              aria-label="Flip direction"
              title="Flip direction"
              onClick={() =>
                ctx.store.getState().updateLink(ctx.boardId, linkId, {
                  from: link.to,
                  to: link.from,
                })
              }
              className="w-8 h-8 inline-flex items-center justify-center rounded-lg
                text-[var(--ink-dim)] hover:bg-[var(--accent-soft)]"
            >
              <FlipIcon size={14} />
            </button>
            <button
              type="button"
              aria-label="Delete link"
              title="Delete link"
              onClick={() => {
                ctx.store.getState().deleteLink(ctx.boardId, linkId);
                onClose();
              }}
              className="w-8 h-8 inline-flex items-center justify-center rounded-lg
                text-[var(--ink-dim)] hover:text-[var(--danger)]
                hover:bg-[rgba(229,72,77,0.1)]"
            >
              <TrashIcon size={14} />
            </button>
          </>
        )}
      </div>
    </Popover>
  );
}
