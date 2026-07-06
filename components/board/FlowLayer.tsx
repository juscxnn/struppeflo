"use client";

import { memo, useMemo } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useCanvas } from "./CanvasProvider";
import { useUIStore } from "@/lib/store/uiStore";
import { orderBoard, type OrderResult } from "@/lib/compiler/order";
import type { ID } from "@/lib/types";

/**
 * Show-flow overlay: numbered badges on each zone + curved arrows between
 * them in execution order. Toggled by the toolbar.
 *
 * Order is derived by the existing compiler — same logic the prompt uses.
 * The overlay is a passive visual: never mutates state, never blocks pointer
 * events on cards (pointer-events: none on the SVG).
 */
export const FlowLayer = memo(function FlowLayer() {
  const ctx = useCanvas();
  const showFlow = useUIStore((s) => s.showFlow);
  const divisionIds = useStore(
    ctx.store,
    useShallow((s) => Object.keys(s.boards[ctx.boardId]?.divisions ?? {})),
  );
  const board = useStore(ctx.store, (s) => s.boards[ctx.boardId]);

  const order = useMemo<OrderResult | null>(() => {
    if (!board) return null;
    return orderBoard(board);
  }, [board]);

  if (!showFlow || !board || !order) return null;
  if (order.sections.length === 0) return null;

  // Map each section → its index in execution order. Divisions in compiler
  // sections appear in execution order because orderBoard.topWithCycleBreaking
  // returns a deterministic ordering with cycle breaking.
  const divisionOrderIndex = new Map<ID, number>();
  order.sections.forEach((section, idx) => {
    if (section.divisionId) {
      divisionOrderIndex.set(section.divisionId, idx);
    }
  });

  // Render order: sort divisions by their compiler order, fall back to
  // spatial top-to-bottom for any unranked ones.
  const ranked = divisionIds
    .map((id) => {
      const div = board.divisions[id];
      if (!div) return null;
      const orderIdx = divisionOrderIndex.get(id);
      return { id, div, orderIdx };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => {
      const ai = a.orderIdx ?? Number.POSITIVE_INFINITY;
      const bi = b.orderIdx ?? Number.POSITIVE_INFINITY;
      if (ai !== bi) return ai - bi;
      return a.div.y - b.div.y;
    });

  return (
    <svg
      aria-hidden
      width={0}
      height={0}
      className="absolute top-0 left-0 overflow-visible flow-layer"
      style={{ pointerEvents: "none" }}
    >
      {ranked.length > 1 && (
        <g>
          {ranked.slice(0, -1).map((curr, i) => {
            const next = ranked[i + 1];
            const from = anchorPoint(curr.div, "right");
            const to = anchorPoint(next.div, "left");
            return (
              <FlowArrow
                key={`${curr.id}-${next.id}`}
                from={from}
                to={to}
              />
            );
          })}
        </g>
      )}
      {ranked.map(({ id, div, orderIdx }, idx) => {
        const display = (orderIdx ?? idx) + 1;
        return (
          <FlowBadge
            key={id}
            number={display}
            x={div.x + 14}
            y={div.y + 14}
          />
        );
      })}
    </svg>
  );
});

function FlowBadge({ number, x, y }: { number: number; x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle
        r={11}
        fill="var(--accent)"
        stroke="var(--surface)"
        strokeWidth={1.5}
        opacity={0.95}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={600}
        fill="var(--surface)"
        style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }}
      >
        {number}
      </text>
    </g>
  );
}

function FlowArrow({
  from,
  to,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
}) {
  // Quadratic bezier with a slight downward bias so the curve reads clearly.
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2 + Math.max(20, Math.abs(to.x - from.x) * 0.15);
  const d = `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`;
  const angle = Math.atan2(to.y - midY, to.x - midX);
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.4}
        strokeDasharray="4 4"
        opacity={0.6}
      />
      <ArrowHead x={to.x} y={to.y} angle={angle} />
    </g>
  );
}

function ArrowHead({ x, y, angle }: { x: number; y: number; angle: number }) {
  return (
    <path
      d="M 0 0 L -8 4 L -8 -4 Z"
      fill="var(--accent)"
      opacity={0.85}
      transform={`translate(${x}, ${y}) rotate(${(angle * 180) / Math.PI})`}
    />
  );
}

function anchorPoint(
  rect: { x: number; y: number; w: number; h: number },
  side: "right" | "left" | "bottom",
): { x: number; y: number } {
  if (side === "right") return { x: rect.x + rect.w, y: rect.y + rect.h / 2 };
  if (side === "left") return { x: rect.x, y: rect.y + rect.h / 2 };
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h };
}