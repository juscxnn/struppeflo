"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { useCanvas } from "./CanvasProvider";
import { LINK_TYPE_META } from "@/lib/constants";
import { anchorsFor, bezierBetween } from "@/lib/geometry";
import type { ID, Rect } from "@/lib/types";

export const LinkPath = memo(function LinkPath({ linkId }: { linkId: ID }) {
  const ctx = useCanvas();
  const link = useStore(ctx.store, (s) => s.boards[ctx.boardId]?.links[linkId]);
  // Subscribing to endpoint cards keeps settled geometry in sync via React.
  const fromCard = useStore(ctx.store, (s) =>
    link ? s.boards[ctx.boardId]?.cards[link.from] : undefined,
  );
  const toCard = useStore(ctx.store, (s) =>
    link ? s.boards[ctx.boardId]?.cards[link.to] : undefined,
  );

  const visRef = useRef<SVGPathElement>(null);
  const hitRef = useRef<SVGPathElement>(null);
  const arrowRef = useRef<SVGPathElement>(null);
  // Live rects during a drag override the store-settled ones.
  const live = useRef<{ [cardId: ID]: Rect | null }>({});
  const [fresh, setFresh] = useState(false);

  const recompute = useCallback(() => {
    const board = ctx.store.getState().boards[ctx.boardId];
    const l = board?.links[linkId];
    if (!board || !l) return;
    const a = live.current[l.from] ?? board.cards[l.from];
    const b = live.current[l.to] ?? board.cards[l.to];
    if (!a || !b) return;
    const anchors = anchorsFor(a, b);
    const bez = bezierBetween(anchors.a, anchors.b);
    visRef.current?.setAttribute("d", bez.d);
    hitRef.current?.setAttribute("d", bez.d);
    const arrow = arrowRef.current;
    if (arrow) {
      if (l.type === "related_to") {
        arrow.style.display = "none";
      } else {
        arrow.style.display = "";
        arrow.setAttribute(
          "transform",
          `translate(${anchors.b.x}, ${anchors.b.y}) rotate(${(bez.endAngle * 180) / Math.PI})`,
        );
      }
    }
  }, [ctx, linkId]);

  useEffect(() => {
    if (!link) return;
    const off = ctx.linkRegistry.subscribe([link.from, link.to], (cardId, rect) => {
      live.current[cardId] = rect;
      recompute();
    });
    // Pulse the line for ~700ms after creation so users see something happen.
    setFresh(true);
    const t = window.setTimeout(() => setFresh(false), 700);
    return () => {
      window.clearTimeout(t);
      off();
    };
  }, [ctx, link, link?.createdAt, recompute]);

  // Settled state after any render (position commits, type changes, undo).
  useLayoutEffect(() => {
    recompute();
  });

  if (!link || !fromCard || !toCard) return null;
  const meta = LINK_TYPE_META[link.type];

  return (
    <g className={fresh ? "link-new" : undefined}>
      <path
        ref={hitRef}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        style={{ pointerEvents: "stroke", cursor: "pointer" }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => {
          const board = ctx.store.getState().boards[ctx.boardId];
          const l = board?.links[linkId];
          const a = l && board?.cards[l.from];
          const b = l && board?.cards[l.to];
          if (!a || !b) return;
          const anchors = anchorsFor(a, b);
          const mid = bezierBetween(anchors.a, anchors.b).mid;
          const screen = ctx.toScreen(mid.x, mid.y);
          ctx.requestLinkPopover(linkId, screen);
        }}
      />
      <path
        ref={visRef}
        fill="none"
        stroke={meta.color}
        strokeWidth={1.6}
        strokeDasharray={meta.dashed ? "5 4" : undefined}
        style={{ pointerEvents: "none" }}
      />
      <path
        ref={arrowRef}
        d="M 0 0 L -9 4 L -9 -4 Z"
        fill={meta.color}
        style={{ pointerEvents: "none" }}
      />
    </g>
  );
});