"use client";

import { memo, useMemo } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useCanvas } from "./CanvasProvider";
import { useUIStore } from "@/lib/store/uiStore";
import { orderBoard, type OrderResult } from "@/lib/compiler/order";
import type { ID, Rect } from "@/lib/types";

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

  // Re-rank sections to 1..N based on the actual execution order. The compiler
  // may break cycles and reorder sections out of their original positions;
  // numbering should reflect where they end up, not the compiler's internal
  // pre-break index.
  const divisionDisplayNumber = new Map<ID, number>();
  order.sections.forEach((section, idx) => {
    if (section.divisionId) {
      divisionDisplayNumber.set(section.divisionId, idx + 1);
    }
  });

  // Render order: sort divisions by their compiler order, fall back to
  // spatial top-to-bottom for any unranked ones.
  const ranked = divisionIds
    .map((id) => {
      const div = board.divisions[id];
      if (!div) return null;
      const orderIdx = divisionDisplayNumber.has(id)
        ? divisionDisplayNumber.get(id)! - 1
        : undefined;
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
            const { start, end } = flowAnchors(curr.div, next.div);
            return (
              <FlowArrow
                key={`${curr.id}-${next.id}`}
                from={start}
                to={end}
              />
            );
          })}
        </g>
      )}
      {ranked.map(({ id, div, orderIdx }, idx) => {
        const display = orderIdx !== undefined ? orderIdx + 1 : idx + 1;
        return (
          <FlowBadge
            key={id}
            number={display}
            x={div.x + div.w - 14}
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
  // Quadratic bezier with a slight bias perpendicular to the line so the
  // curve reads clearly even on short hops.
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const bias = Math.min(28, Math.max(10, len * 0.18));
  const nx = -dy / (len || 1);
  const ny = dx / (len || 1);
  const midX = mx + nx * bias;
  const midY = my + ny * bias;
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

/**
 * Pick the edge pair between two zones based on their spatial relationship.
 * The dominant axis of the center-to-center vector decides whether the arrow
 * runs horizontally or vertically, so the curve naturally follows the layout.
 */
function flowAnchors(
  curr: Rect,
  next: Rect,
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const cx = curr.x + curr.w / 2;
  const cy = curr.y + curr.h / 2;
  const nx = next.x + next.w / 2;
  const ny = next.y + next.h / 2;
  const dx = nx - cx;
  const dy = ny - cy;
  if (Math.abs(dy) > Math.abs(dx)) {
    // Vertical layout — arrow from bottom of curr to top of next (or top→bottom
    // when next is above).
    return {
      start: anchorPoint(curr, dy > 0 ? "bottom" : "top"),
      end: anchorPoint(next, dy > 0 ? "top" : "bottom"),
    };
  }
  return {
    start: anchorPoint(curr, dx > 0 ? "right" : "left"),
    end: anchorPoint(next, dx > 0 ? "left" : "right"),
  };
}

function anchorPoint(
  rect: Rect,
  side: "right" | "left" | "top" | "bottom",
): { x: number; y: number } {
  if (side === "right") return { x: rect.x + rect.w, y: rect.y + rect.h / 2 };
  if (side === "left") return { x: rect.x, y: rect.y + rect.h / 2 };
  if (side === "bottom") return { x: rect.x + rect.w / 2, y: rect.y + rect.h };
  return { x: rect.x + rect.w / 2, y: rect.y };
}
