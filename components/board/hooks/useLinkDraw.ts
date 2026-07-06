"use client";

import { useMemo, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCanvas } from "../CanvasProvider";
import { useToast } from "@/components/ui/Toast";
import { anchorsFor, bezierBetween, pointInRect } from "@/lib/geometry";
import type { ID } from "@/lib/types";

/**
 * n8n-style explicit linking: drag from a card's edge handle, a ghost line
 * follows the cursor, potential targets highlight, release on a card to link.
 * Same imperative discipline as card dragging — zero renders mid-gesture.
 */
export function useLinkDraw(cardId: ID) {
  const ctx = useCanvas();
  const { toast } = useToast();
  const s = useRef({
    active: false,
    latestClient: { x: 0, y: 0 },
    raf: 0,
    target: null as ID | null,
  });

  return useMemo(() => {
    const hideGhost = () => {
      const g = ctx.ghostRef.current;
      if (g?.path) g.path.style.display = "none";
      if (g?.chip) g.chip.style.display = "none";
    };

    const setTargetGlow = (id: ID | null, on: boolean) => {
      if (!id) return;
      ctx.cardElements.get(id)?.classList.toggle("proximity-target", on);
    };

    const tick = () => {
      s.current.raf = 0;
      if (!s.current.active) return;
      const board = ctx.store.getState().boards[ctx.boardId];
      const source = board?.cards[cardId];
      if (!board || !source) return;

      const p = ctx.toWorld(s.current.latestClient.x, s.current.latestClient.y);

      // Hit-test cards under the cursor (smallest z wins is irrelevant — any).
      let target: ID | null = null;
      for (const card of Object.values(board.cards)) {
        if (card.id !== cardId && pointInRect(p.x, p.y, card)) {
          target = card.id;
          break;
        }
      }
      if (target !== s.current.target) {
        setTargetGlow(s.current.target, false);
        setTargetGlow(target, true);
        s.current.target = target;
      }

      const cursorRect = { x: p.x, y: p.y, w: 0, h: 0 };
      const end = target ? board.cards[target] : cursorRect;
      const anchors = anchorsFor(source, end);
      const bez = bezierBetween(anchors.a, anchors.b);
      const g = ctx.ghostRef.current;
      if (g?.path) {
        g.path.setAttribute("d", bez.d);
        g.path.style.display = "";
      }
      if (g?.chip) {
        if (target) {
          g.chip.style.display = "";
          g.chip.style.transform = `translate3d(${bez.mid.x}px, ${bez.mid.y}px, 0) translate(-50%, -50%)`;
          g.chip.textContent = "Release to link";
        } else {
          g.chip.style.display = "none";
        }
      }
    };

    const end = (commit: boolean) => {
      if (!s.current.active) return;
      s.current.active = false;
      if (s.current.raf) {
        cancelAnimationFrame(s.current.raf);
        s.current.raf = 0;
      }
      const target = s.current.target;
      setTargetGlow(target, false);
      s.current.target = null;
      hideGhost();

      if (commit && target) {
        const linkId = ctx.store
          .getState()
          .addLink(ctx.boardId, cardId, target, "depends_on", false);
        if (linkId) {
          toast({
            message: "Linked. Click the line to change type.",
            variant: "info",
          });
          const board = ctx.store.getState().boards[ctx.boardId];
          const a = board?.cards[cardId];
          const b = board?.cards[target];
          if (a && b) {
            const anchors = anchorsFor(a, b);
            const mid = bezierBetween(anchors.a, anchors.b).mid;
            const screen = ctx.toScreen(mid.x, mid.y);
            ctx.requestLinkPopover(linkId, screen);
          }
        }
      }
    };

    return {
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        if (e.button !== 0 || !ctx.policy.createLinks) return;
        e.stopPropagation();
        s.current.active = true;
        s.current.latestClient = { x: e.clientX, y: e.clientY };
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Best-effort; the active flag drives the gesture.
        }
      },
      onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
        if (!s.current.active) return;
        s.current.latestClient = { x: e.clientX, y: e.clientY };
        // rAF suspends in hidden tabs (headless e2e) — run inline there.
        if (document.visibilityState === "hidden") tick();
        else if (!s.current.raf) s.current.raf = requestAnimationFrame(tick);
      },
      onPointerUp: () => end(true),
      onPointerCancel: () => end(false),
    };
  }, [cardId, ctx]);
}
