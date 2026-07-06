"use client";

import { useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCanvas } from "../CanvasProvider";
import { useUIStore } from "@/lib/store/uiStore";
import { useToast } from "@/components/ui/Toast";
import { noteDragForSnapHint } from "../SnapHintToast";
import { DRAG_THRESHOLD_PX, SNAP_ALIGN_PX } from "@/lib/constants";
import { anchorsFor, bezierBetween, clamp } from "@/lib/geometry";
import { divisionForCard } from "@/lib/store/boardStore";
import {
  cardRectsExcluding,
  fitDivision,
  snapRectWithGuides,
  type SnapGuide,
} from "@/lib/snap";
import {
  DIVISION_MIN_H,
  DIVISION_MIN_W,
  ZONE_FIT_PADDING,
} from "@/lib/constants";
import type { Card, ID, Rect } from "@/lib/types";

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
    snapDisabled: false,
    guides: [] as SnapGuide[],
    /** Sticky "user wanted free placement" flag — once set during a drag,
     *  snap stays disengaged for the rest of the gesture even if Shift is
     *  released. This prevents an end-of-drag snap pop on free-placed cards. */
    shiftWasHeldThisDrag: false,
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
      const board = ctx.store.getState().boards[ctx.boardId];
      const snapEnabled = !s.current.snapDisabled && !!board;

      // Compute tentative positions first.
      const tentative = new Map<ID, { x: number; y: number }>();
      for (const id of snap.ids) {
        const r = snap.start.get(id);
        if (!r) continue;
        tentative.set(id, { x: r.x + dx, y: r.y + dy });
      }

      // Reference card = leftmost-topmost of the dragged set. The snap
      // decision is computed ONCE for this card, then applied rigidly to the
      // whole group, so the group's internal layout never deforms.
      let refId: ID | null = null;
      let refX = 0;
      let refY = 0;
      for (const id of snap.ids) {
        const t = tentative.get(id);
        if (!t) continue;
        if (refId === null || t.x < refX || (t.x === refX && t.y < refY)) {
          refId = id;
          refX = t.x;
          refY = t.y;
        }
      }
      if (refId === null) return null;

      // Alignment-only snapping (no grid quantization — that made dragging
      // feel steppy). Cards align to other cards AND zone edges. Threshold is
      // constant in SCREEN pixels, so grabbiness is the same at every zoom.
      let snappedX = refX;
      let snappedY = refY;
      s.current.guides = [];
      if (snapEnabled) {
        const dragged = new Set(snap.ids);
        const candidates: Rect[] = cardRectsExcluding(board, dragged);
        for (const d of Object.values(board.divisions)) {
          candidates.push({ x: d.x, y: d.y, w: d.w, h: d.h });
        }
        const refRect = snap.start.get(refId);
        if (refRect && candidates.length > 0) {
          const result = snapRectWithGuides(
            { x: refX, y: refY, w: refRect.w, h: refRect.h },
            candidates,
            SNAP_ALIGN_PX / scale,
          );
          snappedX = result.x;
          snappedY = result.y;
          s.current.guides = result.guides;
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

    const drawGuides = () => {
      const g = ctx.guidesRef.current;
      if (!g) return;
      const scale = ctx.cameraRef.current.s;
      const lineW = Math.max(1 / scale, 0.75);
      const overshoot = 8 / scale;
      const v = s.current.guides.find((x) => x.axis === "v");
      const h = s.current.guides.find((x) => x.axis === "h");
      if (g.v) {
        if (v) {
          g.v.style.display = "";
          g.v.style.left = `${v.pos - lineW / 2}px`;
          g.v.style.top = `${v.start - overshoot}px`;
          g.v.style.width = `${lineW}px`;
          g.v.style.height = `${v.end - v.start + overshoot * 2}px`;
        } else {
          g.v.style.display = "none";
        }
      }
      if (g.h) {
        if (h) {
          g.h.style.display = "";
          g.h.style.left = `${h.start - overshoot}px`;
          g.h.style.top = `${h.pos - lineW / 2}px`;
          g.h.style.width = `${h.end - h.start + overshoot * 2}px`;
          g.h.style.height = `${lineW}px`;
        } else {
          g.h.style.display = "none";
        }
      }
    };

    const hideGuides = () => {
      s.current.guides = [];
      const g = ctx.guidesRef.current;
      if (g?.v) g.v.style.display = "none";
      if (g?.h) g.h.style.display = "none";
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
      drawGuides();
      if (snap.ids.length === 1) {
        const r = rects.get(snap.ids[0]);
        if (r) {
          ctx.proximity.scan(
            snap.ids[0],
            r,
            ctx.policy.createLinks &&
              useUIStore.getState().proximityLinkingEnabled,
          );
          // Highlight the division that would adopt the card on drop, and
          // publish a post-fit zone preview so the ZonePreviewLayer can show
          // the user exactly where the zone will land.
          const board = ctx.store.getState().boards[ctx.boardId];
          const hover = board ? divisionForCard(r, board.divisions) : null;
          if (hover !== s.current.hoverDivision) {
            setDivisionHover(s.current.hoverDivision, false);
            setDivisionHover(hover, true);
            s.current.hoverDivision = hover;
          }
          updatePreviewZone(board, hover, r, snap.ids[0]);
        }
      }
    };

    const updatePreviewZone = (
      board: ReturnType<typeof ctx.store.getState>["boards"][string] | undefined,
      hover: ID | null,
      draggedRect: Rect,
      draggedId: ID,
    ) => {
      const ref = ctx.previewZoneRef;
      if (!board || !hover) {
        if (ref.current !== null) ref.current = null;
        return;
      }
      const division = board.divisions[hover];
      if (!division) {
        if (ref.current !== null) ref.current = null;
        return;
      }
      // Prospective membership: current members of `division` (excluding the
      // dragged card if it already belongs) + the dragged card at its new rect.
      const members: Card[] = [];
      for (const card of Object.values(board.cards)) {
        if (card.id === draggedId) continue;
        if (card.divisionId === hover) {
          members.push({ ...card });
        }
      }
      // Synthetic card at the live drag rect, ready for the auto-fit math.
      const draggedCard = board.cards[draggedId];
      if (draggedCard) {
        members.push({
          ...draggedCard,
          x: draggedRect.x,
          y: draggedRect.y,
        });
      }
      const fitted = fitDivision(
        division,
        members,
        ZONE_FIT_PADDING,
        DIVISION_MIN_W,
        DIVISION_MIN_H,
      );
      if (!fitted) {
        if (ref.current !== null) ref.current = null;
        return;
      }
      const next = {
        divisionId: hover,
        rect: fitted,
        memberCount: members.length,
      };
      const cur = ref.current;
      if (
        !cur ||
        cur.divisionId !== next.divisionId ||
        cur.rect.x !== next.rect.x ||
        cur.rect.y !== next.rect.y ||
        cur.rect.w !== next.rect.w ||
        cur.rect.h !== next.rect.h ||
        cur.memberCount !== next.memberCount
      ) {
        ref.current = next;
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
      ctx.previewZoneRef.current = null;
      hideGuides();
      cleanupVisuals();
      s.current.snapshot = null;
      s.current.shiftWasHeldThisDrag = false;

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
        noteDragForSnapHint();

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
              const anchors = anchorsFor(a, b);
              const bez = bezierBetween(anchors.a, anchors.b);
              const screen = ctx.toScreen(bez.mid.x, bez.mid.y);
              ctx.requestLinkPopover(linkId, {
                x: screen.x,
                y: screen.y,
                normal: bez.normal,
              });
            }
          }
        }
      }
    };

    return {
      onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        if (useUIStore.getState().toolMode === "division") return;
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
        s.current.snapDisabled = false;
        s.current.shiftWasHeldThisDrag = false;
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
        // Live toggle: hold Shift to drag freely. Once the user has held Shift
        // during a drag, snap stays disengaged for the rest of the gesture
        // even after release — releasing Shift at the end shouldn't snap the
        // card back to a guide line the user deliberately avoided.
        if (e.shiftKey) s.current.shiftWasHeldThisDrag = true;
        s.current.snapDisabled = s.current.shiftWasHeldThisDrag || e.shiftKey;
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
