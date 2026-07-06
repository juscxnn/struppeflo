"use client";

import { memo, useMemo } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useCanvas } from "./CanvasProvider";
import { useUIStore } from "@/lib/store/uiStore";
import { orderBoard, type OrderResult } from "@/lib/compiler/order";
import type { ID, Rect } from "@/lib/types";

/**
 * Show-flow overlay: numbered badges on zones + curved arrows between them
 * in execution order. Toggled by the toolbar (or auto-enabled when the user
 * creates their second zone).
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

  if (!showFlow || !board) return null;

  const divisionCount = divisionIds.length;

  // Empty-state explainer: Flow needs at least 2 zones to show anything
  // meaningful. Tell the user how to get there.
  if (divisionCount < 2) {
    return (
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
        <div className="glass-strong rounded-lg px-3 py-1.5 text-[12.5px] text-[var(--ink-dim)]">
          Flow order needs at least 2 zones. Press <kbd className="font-mono px-1 py-0.5 rounded bg-[var(--glass)] border border-[var(--border)] text-[11px]">D</kbd> to draw one.
        </div>
      </div>
    );
  }

  if (!order || order.sections.length === 0) return null;

  // Re-rank sections to 1..N based on the actual execution order. The compiler
  // may break cycles and reorder sections out of their original positions;
  // numbering should reflect where they end up.
  const divisionDisplayNumber = new Map<ID, number>();
  order.sections.forEach((section, idx) => {
    if (section.divisionId) {
      divisionDisplayNumber.set(section.divisionId, idx + 1);
    }
  });

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
            label={div.name}
            x={div.x + 14}
            y={div.y + 14}
          />
        );
      })}
    </svg>
  );
});

function FlowBadge({
  number,
  label,
  x,
  y,
}: {
  number: number;
  label: string;
  x: number;
  y: number;
}) {
  const truncated = label.length > 12 ? `${label.slice(0, 12)}…` : label;
  const pillW = 28 + truncated.length * 6.6;
  return (
    <g transform={`translate(${x}, ${y})`} style={{ pointerEvents: "none" }}>
      {/* Pill background */}
      <rect
        x={0}
        y={-2}
        width={pillW}
        height={22}
        rx={11}
        fill="var(--surface)"
        stroke="var(--accent)"
        strokeWidth={1.5}
        opacity={0.97}
      />
      {/* Number badge */}
      <circle cx={11} cy={9} r={10} fill="var(--accent)" />
      <text
        x={11}
        y={9}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={700}
        fill="var(--surface)"
        style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }}
      >
        {number}
      </text>
      {/* Zone label */}
      <text
        x={26}
        y={9}
        dominantBaseline="central"
        fontSize={12}
        fontWeight={500}
        fill="var(--ink-dim)"
      >
        {truncated}
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
        strokeWidth={2.2}
        strokeDasharray="6 5"
        opacity={0.85}
      />
      <ArrowHead x={to.x} y={to.y} angle={angle} />
    </g>
  );
}

function ArrowHead({ x, y, angle }: { x: number; y: number; angle: number }) {
  return (
    <path
      d="M 0 0 L -10 5 L -10 -5 Z"
      fill="var(--accent)"
      transform={`translate(${x}, ${y}) rotate(${(angle * 180) / Math.PI})`}
    />
  );
}

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