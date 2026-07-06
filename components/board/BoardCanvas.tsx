"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useCanvas } from "./CanvasProvider";
import { CardView } from "./CardView";
import { DivisionView } from "./DivisionView";
import { FlowLayer } from "./FlowLayer";
import { LinkLayer } from "./LinkLayer";
import { SnapHintToast } from "./SnapHintToast";
import { SuggestionLayer } from "./SuggestionLayer";
import { ZonePreviewLayer } from "./ZonePreviewLayer";
import { ZoomControls } from "./ZoomControls";
import { DumpIcon, CardStackIcon } from "@/components/ui/icons";
import { useUIStore } from "@/lib/store/uiStore";
import {
  CARD_W,
  DIVISION_MIN_H,
  DIVISION_MIN_W,
  PERF_CARD_LIMIT,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_WHEEL_FACTOR,
} from "@/lib/constants";
import { clamp, rectsIntersect } from "@/lib/geometry";
import type { Rect } from "@/lib/types";

const GRID_SPACING = 28;

type Gesture =
  | { kind: "pan"; startClient: { x: number; y: number }; startCam: { tx: number; ty: number } }
  | { kind: "marquee"; startClient: { x: number; y: number }; additive: boolean }
  | { kind: "division"; startClient: { x: number; y: number } }
  | null;

export function BoardCanvas({ className = "" }: { className?: string }) {
  const ctx = useCanvas();
  const cardIds = useStore(
    ctx.store,
    useShallow((s) => Object.keys(s.boards[ctx.boardId]?.cards ?? {})),
  );
  const divisionIds = useStore(
    ctx.store,
    useShallow((s) => Object.keys(s.boards[ctx.boardId]?.divisions ?? {})),
  );

  const gridRef = useRef<HTMLDivElement>(null);
  const rubberRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture>(null);
  const latestClient = useRef({ x: 0, y: 0 });
  const raf = useRef(0);
  const spaceDown = useRef(false);
  const wheelIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWheel = useRef({ panX: 0, panY: 0, zoom: 1, zx: 0, zy: 0 });

  /* Perf mode by card count (zoom part is handled inside applyCamera). */
  useEffect(() => {
    ctx.perfByCountRef.current = cardIds.length > PERF_CARD_LIMIT;
    ctx.applyCamera();
  }, [cardIds.length, ctx]);

  /* Grid follows the camera: background-position/size mutated in applyCamera. */
  const syncGrid = () => {
    const grid = gridRef.current;
    if (!grid) return;
    const { tx, ty, s } = ctx.cameraRef.current;
    const size = GRID_SPACING * s;
    grid.style.backgroundSize = `${size}px ${size}px`;
    grid.style.backgroundPosition = `${tx % size}px ${ty % size}px`;
    grid.style.opacity = s < 0.4 ? "0" : "1";
  };

  useLayoutEffect(() => {
    ctx.applyCamera();
    syncGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  /* --------------------------- wheel: pan / zoom --------------------------- */
  useEffect(() => {
    const vp = ctx.viewportRef.current;
    if (!vp) return;

    const applyWheel = () => {
      raf.current = 0;
      const cam = ctx.cameraRef.current;
      const p = pendingWheel.current;
      if (p.zoom !== 1) {
        const next = clamp(cam.s * p.zoom, ZOOM_MIN, ZOOM_MAX);
        const k = next / cam.s;
        cam.tx = p.zx - (p.zx - cam.tx) * k;
        cam.ty = p.zy - (p.zy - cam.ty) * k;
        cam.s = next;
      }
      cam.tx -= p.panX;
      cam.ty -= p.panY;
      pendingWheel.current = { panX: 0, panY: 0, zoom: 1, zx: 0, zy: 0 };
      ctx.applyCamera();
      syncGrid();
    };

    const onWheel = (e: WheelEvent) => {
      const zooming = e.ctrlKey || e.metaKey;
      if (zooming && !ctx.policy.zoom) return;
      if (!zooming && !ctx.policy.pan) return;
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const p = pendingWheel.current;
      if (zooming) {
        p.zoom *= Math.exp(-e.deltaY * ZOOM_WHEEL_FACTOR);
        p.zx = e.clientX - rect.left;
        p.zy = e.clientY - rect.top;
      } else {
        p.panX += e.deltaX;
        p.panY += e.deltaY;
      }
      if (!raf.current) raf.current = requestAnimationFrame(applyWheel);

      if (wheelIdleTimer.current) clearTimeout(wheelIdleTimer.current);
      wheelIdleTimer.current = setTimeout(() => {
        useUIStore
          .getState()
          .saveCamera(ctx.boardId, { ...ctx.cameraRef.current });
      }, 150);
    };

    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [ctx]);

  /* ------------------------- space-held hand tool ------------------------- */
  useEffect(() => {
    if (!ctx.policy.pan) return;
    const isTyping = () => {
      const t = document.activeElement;
      return (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      );
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTyping() && !e.repeat) {
        spaceDown.current = true;
        ctx.viewportRef.current?.style.setProperty("cursor", "grab");
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDown.current = false;
        ctx.viewportRef.current?.style.removeProperty("cursor");
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [ctx]);

  /* --------------------- pointer gestures on background -------------------- */

  const rubberScreenRect = (): Rect => {
    const vp = ctx.viewportRef.current!.getBoundingClientRect();
    const a = gesture.current as Exclude<Gesture, null | { kind: "pan" }>;
    const x1 = a.startClient.x - vp.left;
    const y1 = a.startClient.y - vp.top;
    const x2 = latestClient.current.x - vp.left;
    const y2 = latestClient.current.y - vp.top;
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      w: Math.abs(x2 - x1),
      h: Math.abs(y2 - y1),
    };
  };

  const rubberWorldRect = (): Rect => {
    const g = gesture.current as Exclude<Gesture, null | { kind: "pan" }>;
    const a = ctx.toWorld(g.startClient.x, g.startClient.y);
    const b = ctx.toWorld(latestClient.current.x, latestClient.current.y);
    return {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      w: Math.abs(b.x - a.x),
      h: Math.abs(b.y - a.y),
    };
  };

  const gestureTick = () => {
    raf.current = 0;
    const g = gesture.current;
    if (!g) return;

    if (g.kind === "pan") {
      const cam = ctx.cameraRef.current;
      cam.tx = g.startCam.tx + (latestClient.current.x - g.startClient.x);
      cam.ty = g.startCam.ty + (latestClient.current.y - g.startClient.y);
      ctx.applyCamera();
      syncGrid();
      return;
    }

    const r = rubberScreenRect();
    const el = rubberRef.current;
    if (el) {
      el.style.display = "";
      el.style.left = `${r.x}px`;
      el.style.top = `${r.y}px`;
      el.style.width = `${r.w}px`;
      el.style.height = `${r.h}px`;
      el.dataset.mode = g.kind;
    }

    if (g.kind === "marquee") {
      const world = rubberWorldRect();
      const board = ctx.store.getState().boards[ctx.boardId];
      if (!board) return;
      const hits: string[] = [];
      for (const card of Object.values(board.cards)) {
        if (rectsIntersect(world, card)) hits.push(card.id);
      }
      const ui = useUIStore.getState();
      const next = g.additive
        ? Array.from(new Set([...ui.selection, ...hits]))
        : hits;
      if (
        next.length !== ui.selection.length ||
        next.some((id, i) => ui.selection[i] !== id)
      ) {
        ui.setSelection(next);
      }
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Cards/divisions/links stop propagation — reaching here means background.
    const ui = useUIStore.getState();
    ui.setEditingCard(null);

    const panIntent =
      ctx.policy.pan && (e.button === 1 || (e.button === 0 && spaceDown.current));

    if (panIntent) {
      gesture.current = {
        kind: "pan",
        startClient: { x: e.clientX, y: e.clientY },
        startCam: { tx: ctx.cameraRef.current.tx, ty: ctx.cameraRef.current.ty },
      };
    } else if (e.button === 0) {
      if (ui.toolMode === "division" && ctx.policy.createDivisions) {
        gesture.current = {
          kind: "division",
          startClient: { x: e.clientX, y: e.clientY },
        };
      } else {
        if (!e.shiftKey) ui.clearSelection();
        gesture.current = {
          kind: "marquee",
          startClient: { x: e.clientX, y: e.clientY },
          additive: e.shiftKey,
        };
      }
    } else {
      return;
    }

    latestClient.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!gesture.current) return;
    latestClient.current = { x: e.clientX, y: e.clientY };
    if (!raf.current) raf.current = requestAnimationFrame(gestureTick);
  };

  const endGesture = (commit: boolean) => {
    const g = gesture.current;
    gesture.current = null;
    if (raf.current) {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    }
    if (rubberRef.current) rubberRef.current.style.display = "none";
    if (!g) return;

    if (g.kind === "pan") {
      useUIStore.getState().saveCamera(ctx.boardId, { ...ctx.cameraRef.current });
      return;
    }
    if (g.kind === "division" && commit) {
      const world = rubberWorldRect();
      if (world.w > 24 && world.h > 24) {
        ctx.store.getState().addDivision(ctx.boardId, {
          x: world.x,
          y: world.y,
          w: Math.max(DIVISION_MIN_W, world.w),
          h: Math.max(DIVISION_MIN_H, world.h),
        });
      }
      useUIStore.getState().setToolMode("select");
    }
  };

  const onPointerUp = () => endGesture(true);
  const onPointerCancel = () => endGesture(false);

  const onDoubleClick = (e: ReactPointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    if (!ctx.policy.createCards) return;
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.canvasBg) {
      return;
    }
    const w = ctx.toWorld(e.clientX, e.clientY);
    const id = ctx.store.getState().addCard(ctx.boardId, {
      x: Math.round(w.x - CARD_W / 2),
      y: Math.round(w.y - 40),
    });
    if (id) {
      useUIStore.getState().setSelection([id]);
      useUIStore.getState().setEditingCard(id);
    }
  };

  const divisionMode = useUIStore((s) => s.toolMode === "division");

  return (
    <div
      ref={ctx.viewportRef}
      data-canvas-bg
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDoubleClick={onDoubleClick}
      className={`overflow-hidden touch-none select-none
        ${divisionMode ? "cursor-crosshair" : ""} ${className}`}
    >
      {/* Camera-synced dot grid. */}
      <div
        ref={gridRef}
        aria-hidden
        data-canvas-bg
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--border-strong) 1px, transparent 1.5px)",
          backgroundSize: `${GRID_SPACING}px ${GRID_SPACING}px`,
          opacity: 0.55,
        }}
      />

      <div
        ref={ctx.worldRef}
        className="absolute top-0 left-0 w-0 h-0"
        style={{ transformOrigin: "0 0" }}
      >
        <div>
          {divisionIds.map((id) => (
            <DivisionView key={id} divisionId={id} />
          ))}
        </div>
        <LinkLayer />
        <FlowLayer />
        <ZonePreviewLayer />
        <div>
          {cardIds.map((id) => (
            <CardView key={id} cardId={id} />
          ))}
        </div>
        <SuggestionLayer />
        {/* Alignment guides (world space, driven by the drag loop). */}
        <div
          ref={(el) => {
            ctx.guidesRef.current.v = el;
          }}
          aria-hidden
          className="absolute top-0 left-0 pointer-events-none z-[9996]"
          style={{ display: "none", background: "var(--accent)" }}
        />
        <div
          ref={(el) => {
            ctx.guidesRef.current.h = el;
          }}
          aria-hidden
          className="absolute top-0 left-0 pointer-events-none z-[9996]"
          style={{ display: "none", background: "var(--accent)" }}
        />
        {/* Proximity-link chip (world space, imperatively positioned). */}
        <div
          ref={(el) => {
            ctx.ghostRef.current.chip = el;
          }}
          className="glass-strong absolute top-0 left-0 pointer-events-none z-[10000]
            rounded-md px-2.5 py-1 text-[11px] font-medium
            text-[var(--accent)] whitespace-nowrap"
          style={{ display: "none" }}
        >
          Release to link
        </div>
      </div>

      {/* Marquee / division rubber band (screen space). */}
      <div
        ref={rubberRef}
        className="absolute pointer-events-none rounded-md border
          border-[var(--accent)] bg-[var(--accent-soft)]
          data-[mode=division]:border-dashed data-[mode=division]:rounded-2xl"
        style={{ display: "none" }}
      />

      {ctx.policy.zoom && <ZoomControls />}

      {ctx.policy.createCards &&
        cardIds.length === 0 &&
        divisionIds.length === 0 && <EmptyState />}

      {ctx.policy.edit && <SnapHintToast />}
    </div>
  );
}

/**
 * The blank-canvas front door. Nobody should ever stare at an empty void
 * wondering what to do — the two highest-leverage starts are one click away.
 */
function EmptyState() {
  const openDump = () => useUIStore.getState().setBrainDumpOpen(true);
  const openTemplates = () => useUIStore.getState().setTemplatePickerOpen(true);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center
        pointer-events-none"
    >
      <div className="pointer-events-auto text-center max-w-sm px-6 fade-up">
        <h2 className="text-[19px] font-semibold tracking-tight">
          What&apos;s on your mind?
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-dim)]">
          Dump it all here — messy is fine. Organizing is the easy part.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={openDump}
            className="btn-primary h-11 rounded-lg inline-flex items-center
              justify-center gap-2 text-[14px] font-semibold"
          >
            <DumpIcon size={16} />
            Brain dump — one thought per line
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={openTemplates}
            className="glass h-11 rounded-lg inline-flex items-center
              justify-center gap-2 text-[13.5px] font-medium
              text-[var(--ink-dim)] hover:text-[var(--ink)]
              hover:border-[var(--border-strong)]"
          >
            <CardStackIcon size={16} />
            Start from a template
          </button>
        </div>
        <p className="mt-4 text-[11.5px] text-[var(--ink-faint)]">
          or double-click anywhere to drop a card · press{" "}
          <kbd className="font-medium">N</kbd> for a new card
        </p>
      </div>
    </div>
  );
}
