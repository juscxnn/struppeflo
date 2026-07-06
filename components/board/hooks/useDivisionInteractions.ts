"use client";

import { useMemo, useRef, type RefObject } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCanvas } from "../CanvasProvider";
import {
  DIVISION_MIN_H,
  DIVISION_MIN_W,
  DRAG_THRESHOLD_PX,
  SNAP_GRID,
} from "@/lib/constants";
import { snapToGrid } from "@/lib/snap";
import type { ID, Rect } from "@/lib/types";

export type Corner = "nw" | "ne" | "sw" | "se";

/**
 * Division drag (moves member cards with the frame; Alt = frame only) and
 * corner resize. Same rAF/imperative discipline as card dragging.
 */
export function useDivisionInteractions(
  divisionId: ID,
  rootRef: RefObject<HTMLDivElement | null>,
) {
  const ctx = useCanvas();
  const s = useRef({
    mode: null as "move" | Corner | null,
    moved: false,
    frameOnly: false,
    startClient: { x: 0, y: 0 },
    latestClient: { x: 0, y: 0 },
    startRect: { x: 0, y: 0, w: 0, h: 0 } as Rect,
    members: new Map<ID, Rect>(),
    raf: 0,
    shiftDuringDrag: false,
  });

  return useMemo(() => {
    const worldDelta = () => {
      const scale = ctx.cameraRef.current.s;
      return {
        dx: (s.current.latestClient.x - s.current.startClient.x) / scale,
        dy: (s.current.latestClient.y - s.current.startClient.y) / scale,
      };
    };

    const liveRect = (): Rect => {
      const { dx, dy } = worldDelta();
      const r = s.current.startRect;
      const mode = s.current.mode;
      const shift = s.current.shiftDuringDrag;
      if (mode === "move") {
        let nx = r.x + dx;
        let ny = r.y + dy;
        if (!shift) {
          nx = snapToGrid(nx, SNAP_GRID);
          ny = snapToGrid(ny, SNAP_GRID);
        }
        return { ...r, x: nx, y: ny };
      }
      let { x, y, w, h } = r;
      if (mode === "nw" || mode === "sw") {
        const nx = Math.min(x + dx, x + w - DIVISION_MIN_W);
        w = w + (x - nx);
        x = nx;
      }
      if (mode === "ne" || mode === "se") w = Math.max(DIVISION_MIN_W, w + dx);
      if (mode === "nw" || mode === "ne") {
        const ny = Math.min(y + dy, y + h - DIVISION_MIN_H);
        h = h + (y - ny);
        y = ny;
      }
      if (mode === "sw" || mode === "se") h = Math.max(DIVISION_MIN_H, h + dy);
      if (!shift) {
        x = snapToGrid(x, SNAP_GRID);
        y = snapToGrid(y, SNAP_GRID);
        w = Math.max(snapToGrid(w, SNAP_GRID), DIVISION_MIN_W);
        h = Math.max(snapToGrid(h, SNAP_GRID), DIVISION_MIN_H);
      }
      return { x, y, w, h };
    };

    const tick = () => {
      s.current.raf = 0;
      const el = rootRef.current;
      if (!el || !s.current.mode) return;
      const r = liveRect();

      if (s.current.mode === "move") {
        const { dx, dy } = worldDelta();
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        if (!s.current.frameOnly) {
          for (const [id, start] of s.current.members) {
            const cardEl = ctx.cardElements.get(id);
            if (cardEl) {
              cardEl.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
            }
            ctx.linkRegistry.notify(id, {
              x: start.x + dx,
              y: start.y + dy,
              w: start.w,
              h: start.h,
            });
          }
        }
      } else {
        el.style.left = `${r.x}px`;
        el.style.top = `${r.y}px`;
        el.style.width = `${r.w}px`;
        el.style.height = `${r.h}px`;
      }
    };

    const begin = (
      e: ReactPointerEvent<HTMLElement>,
      mode: "move" | Corner,
    ) => {
      if (e.button !== 0 || !ctx.policy.createDivisions) return;
      e.stopPropagation();
      const board = ctx.store.getState().boards[ctx.boardId];
      const division = board?.divisions[divisionId];
      if (!board || !division) return;

      s.current.mode = mode;
      s.current.moved = false;
      s.current.frameOnly = e.altKey;
      s.current.shiftDuringDrag = e.shiftKey;
      s.current.startClient = { x: e.clientX, y: e.clientY };
      s.current.latestClient = { x: e.clientX, y: e.clientY };
      s.current.startRect = {
        x: division.x,
        y: division.y,
        w: division.w,
        h: division.h,
      };
      s.current.members = new Map();
      if (mode === "move") {
        for (const card of Object.values(board.cards)) {
          if (card.divisionId === divisionId) {
            s.current.members.set(card.id, {
              x: card.x,
              y: card.y,
              w: card.w,
              h: card.h,
            });
          }
        }
      }
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Capture is best-effort; the mode flag drives the gesture.
      }
    };

    const move = (e: ReactPointerEvent<HTMLElement>) => {
      if (!s.current.mode) return;
      if (e.shiftKey) s.current.shiftDuringDrag = true;
      s.current.latestClient = { x: e.clientX, y: e.clientY };
      if (!s.current.moved) {
        const d = Math.hypot(
          e.clientX - s.current.startClient.x,
          e.clientY - s.current.startClient.y,
        );
        if (d < DRAG_THRESHOLD_PX) return;
        s.current.moved = true;
        ctx.history.pause();
        if (rootRef.current) rootRef.current.style.willChange = "transform";
      }
      if (!s.current.raf) s.current.raf = requestAnimationFrame(tick);
    };

    const end = (commit: boolean) => {
      const mode = s.current.mode;
      s.current.mode = null;
      if (s.current.raf) {
        cancelAnimationFrame(s.current.raf);
        s.current.raf = 0;
      }
      if (!mode || !s.current.moved) return;

      const r = liveRect();
      const { dx, dy } = worldDelta();

      const el = rootRef.current;
      if (el) {
        el.style.transform = "";
        el.style.willChange = "";
      }
      const memberMoves: Array<{ id: ID; x: number; y: number }> = [];
      if (mode === "move" && !s.current.frameOnly) {
        for (const [id, start] of s.current.members) {
          const cardEl = ctx.cardElements.get(id);
          if (cardEl) cardEl.style.transform = "";
          ctx.linkRegistry.notify(id, null);
          memberMoves.push({ id, x: start.x + dx, y: start.y + dy });
        }
      }

      ctx.history.resume();
      if (commit) {
        ctx.store
          .getState()
          .commitDivision(ctx.boardId, divisionId, r, memberMoves);
      }
    };

    return {
      moveHandlers: {
        onPointerDown: (e: ReactPointerEvent<HTMLElement>) => begin(e, "move"),
        onPointerMove: move,
        onPointerUp: () => end(true),
        onPointerCancel: () => end(false),
      },
      resizeHandlers: (corner: Corner) => ({
        onPointerDown: (e: ReactPointerEvent<HTMLElement>) => begin(e, corner),
        onPointerMove: move,
        onPointerUp: () => end(true),
        onPointerCancel: () => end(false),
      }),
    };
  }, [ctx, divisionId, rootRef]);
}
