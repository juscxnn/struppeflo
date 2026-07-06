"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { useCanvas } from "./CanvasProvider";
import { useDivisionInteractions, type Corner } from "./hooks/useDivisionInteractions";
import { TrashIcon } from "@/components/ui/icons";
import { CARD_COLOR_TINT, MAX_NAME } from "@/lib/constants";
import type { ID } from "@/lib/types";

const CORNER_POS: Record<Corner, string> = {
  nw: "top-0 left-0 cursor-nwse-resize -translate-x-1/2 -translate-y-1/2",
  ne: "top-0 right-0 cursor-nesw-resize translate-x-1/2 -translate-y-1/2",
  sw: "bottom-0 left-0 cursor-nesw-resize -translate-x-1/2 translate-y-1/2",
  se: "bottom-0 right-0 cursor-nwse-resize translate-x-1/2 translate-y-1/2",
};

export const DivisionView = memo(function DivisionView({
  divisionId,
}: {
  divisionId: ID;
}) {
  const ctx = useCanvas();
  const division = useStore(
    ctx.store,
    (s) => s.boards[ctx.boardId]?.divisions[divisionId],
  );
  const memberCount = useStore(ctx.store, (s) => {
    const cards = s.boards[ctx.boardId]?.cards;
    if (!cards) return 0;
    let n = 0;
    for (const c of Object.values(cards)) if (c.divisionId === divisionId) n++;
    return n;
  });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { moveHandlers, resizeHandlers } = useDivisionInteractions(
    divisionId,
    rootRef,
  );
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    ctx.divisionElements.set(divisionId, el);
    return () => {
      ctx.divisionElements.delete(divisionId);
    };
  }, [divisionId, ctx]);

  if (!division) return null;

  const editable = ctx.policy.createDivisions;
  const tint = CARD_COLOR_TINT[division.color];

  return (
    // Root ignores pointer events so marquee/cards work over the zone body;
    // only the title bar and resize handles are interactive.
    <div
      ref={rootRef}
      className="absolute rounded-2xl pointer-events-none"
      style={{
        left: division.x,
        top: division.y,
        width: division.w,
        height: division.h,
        background: `linear-gradient(${tint}, ${tint}), var(--division-bg)`,
        border: "1px solid var(--division-border)",
      }}
    >
      <div
        {...(editable ? moveHandlers : {})}
        className={`pointer-events-auto group absolute top-0 left-0 right-0 h-11
          flex items-center gap-2 px-4 rounded-t-2xl select-none
          ${editable ? "cursor-grab" : ""}`}
      >
        {editingName ? (
          <input
            autoFocus
            defaultValue={division.name}
            maxLength={MAX_NAME}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" || e.key === "Escape") {
                e.currentTarget.blur();
              }
            }}
            onBlur={(e) => {
              ctx.store
                .getState()
                .updateDivision(ctx.boardId, divisionId, {
                  name: e.target.value.trim() || division.name,
                });
              setEditingName(false);
            }}
            className="bg-transparent outline-none text-[13px] font-semibold
              tracking-tight w-48"
          />
        ) : (
          <button
            type="button"
            onPointerDown={(e) => {
              // Single click on the name edits; drags start from the bar.
              if (editable) e.stopPropagation();
            }}
            onClick={() => editable && setEditingName(true)}
            className={`text-[13px] font-semibold tracking-tight truncate max-w-60
              ${editable ? "cursor-text" : "cursor-default"}`}
          >
            {division.name}
          </button>
        )}
        <span
          className="text-[11px] text-[var(--ink-faint)] font-medium rounded-md
            px-1.5 py-0.5 bg-[var(--glass)] border border-[var(--border)]"
        >
          {memberCount}
        </span>
        {editable && ctx.policy.delete && (
          <button
            type="button"
            aria-label="Delete zone (keeps cards)"
            title="Delete zone (keeps cards)"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() =>
              ctx.store.getState().deleteDivision(ctx.boardId, divisionId)
            }
            className="ml-auto w-6 h-6 inline-flex items-center justify-center
              rounded-md text-[var(--ink-faint)] opacity-0 group-hover:opacity-100
              hover:text-[var(--danger)] transition-opacity"
          >
            <TrashIcon size={12.5} />
          </button>
        )}
      </div>

      {editable &&
        (Object.keys(CORNER_POS) as Corner[]).map((corner) => (
          <div
            key={corner}
            {...resizeHandlers(corner)}
            className={`pointer-events-auto absolute w-3.5 h-3.5 rounded-full
              opacity-0 hover:opacity-100 bg-[var(--accent)] ${CORNER_POS[corner]}`}
          />
        ))}
    </div>
  );
});
