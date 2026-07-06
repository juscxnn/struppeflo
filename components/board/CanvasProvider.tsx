"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { registerCanvas } from "@/lib/canvasBridge";
import type { StoreApi } from "zustand";
import type { WorkspaceState } from "@/lib/store/boardStore";
import { useUIStore } from "@/lib/store/uiStore";
import {
  PERF_ZOOM_CUTOFF,
  PROXIMITY_DWELL_MS,
  PROXIMITY_THRESHOLD,
  ZOOM_MAX,
  ZOOM_MIN,
} from "@/lib/constants";
import {
  anchorsFor,
  bezierBetween,
  boundsOfRects,
  clamp,
  edgeGapDistance,
} from "@/lib/geometry";
import type { Camera, ID, InteractionPolicy, Rect } from "@/lib/types";

export type WorkspaceStore = StoreApi<WorkspaceState>;

/* ------------------------------ LinkRegistry ------------------------------ */

type RectListener = (cardId: ID, liveRect: Rect | null) => void;

/**
 * Lets link paths track card motion during a drag without React renders:
 * the drag rAF calls notify() with live rects; paths recompute their `d`
 * via direct attribute writes. notify(id, null) means "drag over — read the
 * settled rect from the store again."
 */
export class LinkRegistry {
  private byCard = new Map<ID, Set<RectListener>>();

  subscribe(cardIds: ID[], listener: RectListener): () => void {
    for (const id of cardIds) {
      let set = this.byCard.get(id);
      if (!set) {
        set = new Set();
        this.byCard.set(id, set);
      }
      set.add(listener);
    }
    return () => {
      for (const id of cardIds) {
        const set = this.byCard.get(id);
        set?.delete(listener);
        if (set && set.size === 0) this.byCard.delete(id);
      }
    };
  }

  notify(cardId: ID, liveRect: Rect | null): void {
    this.byCard.get(cardId)?.forEach((l) => l(cardId, liveRect));
  }
}

/* ---------------------------- Proximity engine ---------------------------- */

export interface GhostRefs {
  path: SVGPathElement | null;
  chip: HTMLDivElement | null;
}

/**
 * Runs inside the drag rAF for single-card drags. Finds the nearest unlinked
 * card within the edge-gap threshold, arms after a continuous dwell, applies
 * the glow class + ghost bezier imperatively, and reports the armed target
 * on drop.
 */
class ProximityEngine {
  private candidate: ID | null = null;
  private candidateSince = 0;
  private armed = false;
  private excluded = new Set<ID>();

  constructor(
    private getBoard: () => { cards: Record<ID, Rect & { id: ID }> } | undefined,
    private cardElements: Map<ID, HTMLElement>,
    private ghost: RefObject<GhostRefs>,
  ) {}

  /** Called at drag start: pairs already linked to the dragged card. */
  begin(excludedTargets: Set<ID>) {
    this.excluded = excludedTargets;
    this.reset();
  }

  scan(draggedId: ID, liveRect: Rect, enabled: boolean): void {
    if (!enabled) {
      this.reset();
      return;
    }
    const board = this.getBoard();
    if (!board) return;

    let best: ID | null = null;
    let bestDist = PROXIMITY_THRESHOLD;
    let bestRect: Rect | null = null;
    for (const card of Object.values(board.cards)) {
      if (card.id === draggedId || this.excluded.has(card.id)) continue;
      const d = edgeGapDistance(liveRect, card);
      if (d < bestDist) {
        bestDist = d;
        best = card.id;
        bestRect = card;
      }
    }

    const now = performance.now();
    if (best !== this.candidate) {
      this.setGlow(this.candidate, false);
      this.candidate = best;
      this.candidateSince = now;
      this.armed = false;
      this.hideGhost();
    }

    if (
      this.candidate &&
      bestRect &&
      now - this.candidateSince >= PROXIMITY_DWELL_MS
    ) {
      if (!this.armed) {
        this.armed = true;
        this.setGlow(this.candidate, true);
      }
      this.drawGhost(liveRect, bestRect);
    }
  }

  /** Returns the armed target (if any) and clears all visuals. */
  finish(): ID | null {
    const target = this.armed ? this.candidate : null;
    this.reset();
    return target;
  }

  private reset() {
    this.setGlow(this.candidate, false);
    this.candidate = null;
    this.armed = false;
    this.hideGhost();
  }

  private setGlow(id: ID | null, on: boolean) {
    if (!id) return;
    this.cardElements.get(id)?.classList.toggle("proximity-target", on);
  }

  private drawGhost(from: Rect, to: Rect) {
    const g = this.ghost.current;
    if (!g?.path) return;
    const anchors = anchorsFor(from, to);
    const bez = bezierBetween(anchors.a, anchors.b);
    g.path.setAttribute("d", bez.d);
    g.path.style.display = "";
    if (g.chip) {
      g.chip.style.display = "";
      g.chip.style.transform = `translate3d(${bez.mid.x}px, ${bez.mid.y}px, 0) translate(-50%, -50%)`;
    }
  }

  private hideGhost() {
    const g = this.ghost.current;
    if (g?.path) g.path.style.display = "none";
    if (g?.chip) g.chip.style.display = "none";
  }
}

/* -------------------------------- Context -------------------------------- */

export interface CanvasContextValue {
  store: WorkspaceStore;
  boardId: ID;
  policy: InteractionPolicy;
  cameraRef: RefObject<Camera>;
  viewportRef: RefObject<HTMLDivElement | null>;
  worldRef: RefObject<HTMLDivElement | null>;
  /** Card DOM nodes, for imperative class toggles (glow) and measurements. */
  cardElements: Map<ID, HTMLElement>;
  /** Division DOM nodes, for drag-into highlighting. */
  divisionElements: Map<ID, HTMLElement>;
  linkRegistry: LinkRegistry;
  proximity: ProximityEngine;
  ghostRef: RefObject<GhostRefs>;
  /** Set by Board — opens the link type popover for a link id. */
  requestLinkPopover: (linkId: ID, screen: { x: number; y: number }) => void;
  history: { pause: () => void; resume: () => void };
  /** True when card count pushed the board into perf mode (React-computed). */
  perfByCountRef: RefObject<boolean>;
  applyCamera: () => void;
  toWorld: (sx: number, sy: number) => { x: number; y: number };
  toScreen: (wx: number, wy: number) => { x: number; y: number };
  /** Notified after every applyCamera — for zoom readouts, no store churn. */
  cameraListeners: Set<(cam: Camera) => void>;
  /** Zoom by a factor around the viewport center. */
  zoomBy: (factor: number) => void;
  /** Frame all content in the viewport. */
  fitToContent: () => void;
}

const CanvasContext = createContext<CanvasContextValue | null>(null);

export function useCanvas(): CanvasContextValue {
  const ctx = useContext(CanvasContext);
  if (!ctx) throw new Error("useCanvas must be used inside <CanvasProvider>");
  return ctx;
}

export function CanvasProvider({
  store,
  boardId,
  policy,
  history,
  initialCamera,
  requestLinkPopover,
  children,
}: {
  store: WorkspaceStore;
  boardId: ID;
  policy: InteractionPolicy;
  history?: { pause: () => void; resume: () => void };
  initialCamera?: Camera;
  requestLinkPopover: (linkId: ID, screen: { x: number; y: number }) => void;
  children: ReactNode;
}) {
  const cameraRef = useRef<Camera>(initialCamera ?? { tx: 0, ty: 0, s: 1 });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const ghostRef = useRef<GhostRefs>({ path: null, chip: null });
  const perfByCountRef = useRef(false);

  const value = useMemo<CanvasContextValue>(() => {
    const cardElements = new Map<ID, HTMLElement>();
    const divisionElements = new Map<ID, HTMLElement>();
    const linkRegistry = new LinkRegistry();
    const proximity = new ProximityEngine(
      () => store.getState().boards[boardId],
      cardElements,
      ghostRef,
    );

    const cameraListeners = new Set<(cam: Camera) => void>();

    const applyCamera = () => {
      const { tx, ty, s } = cameraRef.current;
      const world = worldRef.current;
      if (world) {
        world.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${s})`;
      }
      viewportRef.current?.classList.toggle(
        "perf-mode",
        perfByCountRef.current || s < PERF_ZOOM_CUTOFF,
      );
      cameraListeners.forEach((l) => l(cameraRef.current));
    };

    const saveCamera = () => {
      useUIStore.getState().saveCamera(boardId, { ...cameraRef.current });
    };

    const zoomBy = (factor: number) => {
      const vp = viewportRef.current;
      if (!vp) return;
      const rect = vp.getBoundingClientRect();
      const px = rect.width / 2;
      const py = rect.height / 2;
      const cam = cameraRef.current;
      const next = clamp(cam.s * factor, ZOOM_MIN, ZOOM_MAX);
      const k = next / cam.s;
      cam.tx = px - (px - cam.tx) * k;
      cam.ty = py - (py - cam.ty) * k;
      cam.s = next;
      applyCamera();
      saveCamera();
    };

    const fitToContent = () => {
      const vp = viewportRef.current;
      const board = store.getState().boards[boardId];
      if (!vp || !board) return;
      const bounds = boundsOfRects([
        ...Object.values(board.cards),
        ...Object.values(board.divisions),
      ]);
      const cam = cameraRef.current;
      if (!bounds) {
        cam.tx = 0;
        cam.ty = 0;
        cam.s = 1;
      } else {
        const rect = vp.getBoundingClientRect();
        const pad = 80;
        const s = clamp(
          Math.min(
            rect.width / (bounds.w + pad * 2),
            rect.height / (bounds.h + pad * 2),
          ),
          ZOOM_MIN,
          1,
        );
        cam.s = s;
        cam.tx = rect.width / 2 - (bounds.x + bounds.w / 2) * s;
        cam.ty = rect.height / 2 - (bounds.y + bounds.h / 2) * s;
      }
      applyCamera();
      saveCamera();
    };

    const toWorld = (sx: number, sy: number) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      const { tx, ty, s } = cameraRef.current;
      return {
        x: (sx - (rect?.left ?? 0) - tx) / s,
        y: (sy - (rect?.top ?? 0) - ty) / s,
      };
    };

    const toScreen = (wx: number, wy: number) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      const { tx, ty, s } = cameraRef.current;
      return {
        x: wx * s + tx + (rect?.left ?? 0),
        y: wy * s + ty + (rect?.top ?? 0),
      };
    };

    return {
      store,
      boardId,
      policy,
      cameraRef,
      viewportRef,
      worldRef,
      cardElements,
      divisionElements,
      linkRegistry,
      proximity,
      ghostRef,
      requestLinkPopover,
      history: history ?? { pause: () => {}, resume: () => {} },
      perfByCountRef,
      applyCamera,
      toWorld,
      toScreen,
      cameraListeners,
      zoomBy,
      fitToContent,
    };
  }, [store, boardId, policy, history, requestLinkPopover]);

  // Only the full-policy (studio) canvas exposes itself to the chrome bridge.
  useEffect(() => {
    if (!policy.createCards) return;
    return registerCanvas({
      viewportCenterWorld: () => {
        const rect = viewportRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        return value.toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
      },
      setWorldClass: (className, on) => {
        worldRef.current?.classList.toggle(className, on);
      },
      zoomFit: () => value.fitToContent(),
    });
  }, [policy.createCards, value]);

  return (
    <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
  );
}

/** Convenience: is proximity linking currently allowed for this canvas? */
export function proximityEnabled(policy: InteractionPolicy): boolean {
  return policy.createLinks && useUIStore.getState().proximityLinkingEnabled;
}
