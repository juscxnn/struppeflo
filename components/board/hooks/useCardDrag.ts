"use client";

import { useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCanvas } from "../CanvasProvider";
import { useUIStore } from "@/lib/store/uiStore";
import { useToast } from "@/components/ui/Toast";
import {
  DRAG_THRESHOLD_PX,
  SNAP_ALIGN_PX,
  SNAP_GRID,
} from "@/lib/constants";
import { anchorsFor, bezierBetween, clamp } from "@/lib/geometry";
import { divisionForCard } from "@/lib/store/boardStore";
import {
  cardRectsExcluding,
  snapRectToCards,
  snapToGrid,
} from "@/lib/snap";
import type { ID, Rect } from "@/lib/types";

interface DragSnapshot {
  ids: ID[];
  start: Map<ID, Rect>;
}

/**
 * Card drag engine. Zero store writes and zero React renders while dragging:
 * pointermove stashes the latest point, one rAF loop applies translate3d
 * deltas and feeds the link registry + proximity engine, and pointerup
 * commits atomically.
 */
export function useCardDrag(cardId: ID) {
  const ctx = useCanvas();
  const { toast } = useToast();

  const state = useRef({
    active: false,
    moved: false,
    wasSoleSelected: false,
    startClient: { x: 0, y: 0 },
    latestClient: { x: 0, y: 0 },
    raf: 0,
    snapshot: null as DragSnapshot | null,
    hoverDivision: null as ID | null,
    shiftDuringDrag: false,
  });

  return useMemo(() => {
    const s = state;

    const liveRects = (): Map<ID, Rect> | null => {
      const snap = s.current.snapshot;
      if (!snap) return null;
      const scale = ctx.cameraRef.current.s;
      const dx = (s.current.latestClient.x - s.current.startClient.x) / scale;
      const dy = (s.current.latestClient.y - s.current.startClient.y) / scale;
      const bounds = ctx.policy.bounds;
      const snapEnabled = !s.current.shiftDuringDrag;
      const board = ctx.store.getState().boards[ctx.boardId];
      const candidates = snapEnabled
        ? cardRectsExcluding(board ?? { cards: {} }, new Set(snap.ids))
        : [];

      // Compute tentative positions first.
      const tentative = new Map<ID, { x: number; y: number }>();
      for (const id of snap.ids) {
        const r = snap.start.get(id);
        if (!r) continue;
        tentative.set(id, { x: r.x + dx, y: r.y + dy });
      }

      // Pick a reference card = leftmost-topmost of the dragged set. The snap
      // decision is computed ONCE for this card, then applied rigidly to the
      // whole group. This is what keeps the group's internal layout intact
      // while still snapping to grid + aligning to other cards.
      let refId: ID | null = null;
      let refX = 0;
      let refY = 0;
      for (const id of snap.ids) {
        const t = tentative.get(id);
        if (!t) continue;
        if (
          refId === null ||
          t.x < refX ||
          (t.x === refX && t.y < refY)
        ) {
          refId = id;
          refX = t.x;
          refY = t.y;
        }
      }
      if (refId === null) return null;

      let snappedX = refX;
      let snappedY = refY;
      if (snapEnabled) {
        snappedX = snapToGrid(snappedX, SNAP_GRID);
        snappedY = snapToGrid(snappedY, SNAP_GRID);
        const refRect = snap.start.get(refId);
        if (refRect) {
          const aligned = snapRectToCards(
            { x: snappedX, y: snappedY, w: refRect.w, h: refRect.h },
            candidates,
            SNAP_ALIGN_PX,
          );
          snappedX = aligned.x;
          snappedY = aligned.y;
        }
      }

      const offsetX = snappedX - refX;
      const offsetY = snappedY - refY;

      const out = new Map<ID, Rect>();
      for (const id of snap.ids) {
        const r = snap.start.get(id);
        const t = tentative.get(id);
        if (!r || !t) continue;
        let x = t.x + offsetX;
        let y = t.y + offsetY;
        if (bounds) {
          x = clamp(x, bounds.x, bounds.x + bounds.w - r.w);
          y = clamp(y, bounds.y, bounds.y + bounds.h - r.h);
        }
        out.set(id, { x, y, w: r.w, h: r.h });
      }
      return out;
    };

    const tick = () => {
      s.current.raf = 0;
      const snap = s.current.snapshot;
      const rects = liveRects();
      if (!snap || !rects) return;
      for (const id of snap.ids) {
        const r = rects.get(id);
        const start = snap.start.get(id);
        const el = ctx.cardElements.get(id);
        if (!r || !start || !el) continue;
        el.style.transform = `translate3d(${r.x - start.x}px, ${r.y - start.y}px, 0)`;
        ctx.linkRegistry.notify(id, r);
      }
      if (snap.ids.length === 1) {
        const r = rects.get(snap.ids[0]);
        if (r) {
          ctx.proximity.scan(
            snap.ids[0],
            r,
            ctx.policy.createLinks &&
              useUIStore.getState().proximityLinkingEnabled,
          );
          // Highlight the division that would adopt the card on drop.
          const board = ctx.store.getState().boards[ctx.boardId];
          const hover = board ? divisionForCard(r, board.divisions) : null;
          if (hover !== s.current.hoverDivision) {
            setDivisionHover(s.current.hoverDivision, false);
            setDivisionHover(hover, true);
            s.current.hoverDivision = hover;
          }
        }
      }
    };

    const setDivisionHover = (id: ID | null, on: boolean) => {
      if (!id) return;
      ctx.divisionElements.get(id)?.classList.toggle("division-hover", on);
    };

    const beginDrag = () => {
      const ui = useUIStore.getState();
      const ids = ui.selection.includes(cardId) ? [...ui.selection] : [cardId];
      const board = ctx.store.getState().boards[ctx.boardId];
      if (!board) return;
      const start = new Map<ID, Rect>();
      for (const id of ids) {
        const card = board.cards[id];
        if (card) start.set(id, { x: card.x, y: card.y, w: card.w, h: card.h });
      }
      s.current.snapshot = { ids: ids.filter((id) => start.has(id)), start };
      s.current.moved = true;
      ctx.history.pause();

      const excluded = new Set<ID>();
      for (const link of Object.values(board.links)) {
        if (link.from === cardId) excluded.add(link.to);
        if (link.to === cardId) excluded.add(link.from);
      }
      ctx.proximity.begin(excluded);

      for (const id of s.current.snapshot.ids) {
        const el = ctx.cardElements.get(id);
        if (el) {
          el.dataset.dragging = "true";
          el.style.willChange = "transform";
          el.style.zIndex = "9999";
        }
      }
    };

    const cleanupVisuals = () => {
      const snap = s.current.snapshot;
      if (!snap) return;
      for (const id of snap.ids) {
        const el = ctx.cardElements.get(id);
        if (el) {
          delete el.dataset.dragging;
          el.style.transform = "";
          el.style.willChange = "";
          el.style.zIndex = "";
        }
        ctx.linkRegistry.notify(id, null);
      }
    };

    const endDrag = (commit: boolean) => {
      if (s.current.raf) {
        cancelAnimationFrame(s.current.raf);
        s.current.raf = 0;
      }
      const snap = s.current.snapshot;
      const rects = commit ? liveRects() : null;
      const target = ctx.proximity.finish();
      setDivisionHover(s.current.hoverDivision, false);
      s.current.hoverDivision = null;
      cleanupVisuals();
      s.current.snapshot = null;

      // Resume BEFORE the commit so the whole drag is one undo entry.
      ctx.history.resume();

      if (snap && rects) {
        ctx.store.getState().commitMove(
          ctx.boardId,
          snap.ids.map((id) => {
            const r = rects.get(id)!;
            return { id, x: r.x, y: r.y };
          }),
        );

        if (target && snap.ids.length === 1) {
          const linkId = ctx.store
            .getState()
            .addLink(ctx.boardId, snap.ids[0], target, "depends_on", true);
          if (linkId) {
            toast({
              message: "Linked. Click the line to change type.",
              variant: "info",
            });
            const board = ctx.store.getState().boards[ctx.boardId];
            const a = board?.cards[snap.ids[0]];
            const b = board?.cards[target];
            if (a && b) {
              const bez = bezierBetween(
                anchorsFor(a, b).a,
                anchorsFor(a, b).b,
              );
              const screen = ctx.toScreen(bez.mid.x, bez.mid.y);
              ctx.requestLinkPopover(linkId, screen);
            }
          }
        }
      }
    };

    return {
      onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        if (useUIStore.getState().editingCardId === cardId) return;
        e.stopPropagation();

        const ui = useUIStore.getState();
        if (e.shiftKey) {
          ui.toggleSelected(cardId);
          return;
        }
        s.current.wasSoleSelected =
          ui.selection.length === 1 && ui.selection[0] === cardId;
        if (!ui.selection.includes(cardId)) ui.setSelection([cardId]);

        s.current.active = true;
        s.current.moved = false;
        s.current.shiftDuringDrag = false;
        s.current.startClient = { x: e.clientX, y: e.clientY };
        s.current.latestClient = { x: e.clientX, y: e.clientY };
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Capture can fail for exotic/synthetic pointers — drag still works
          // as long as moves land on the element.
        }
      },

      onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!s.current.active) return;
        if (e.shiftKey) s.current.shiftDuringDrag = true;
        s.current.latestClient = { x: e.clientX, y: e.clientY };
        if (!s.current.moved) {
          const dx = e.clientX - s.current.startClient.x;
          const dy = e.clientY - s.current.startClient.y;
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
          beginDrag();
        }
        // rAF suspends in hidden tabs (headless e2e) — run inline there.
        if (document.visibilityState === "hidden") tick();
        else if (!s.current.raf) s.current.raf = requestAnimationFrame(tick);
      },

      onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!s.current.active) return;
        s.current.active = false;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // Never captured — nothing to release.
        }
        if (!s.current.moved) {
          if (s.current.wasSoleSelected && ctx.policy.edit) {
            useUIStore.getState().setEditingCard(cardId);
          }
          return;
        }
        endDrag(true);
      },

      onPointerCancel: () => {
        if (!s.current.active) return;
        s.current.active = false;
        if (!s.current.moved) return;
        endDrag(false);
      },
    };
  }, [cardId, ctx]);
}
