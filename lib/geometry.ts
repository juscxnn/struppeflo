import { ANCHOR_CORNER_CLAMP } from "./constants";
import type { Rect } from "./types";

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function rectCenter(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

/** Gap between rect edges; 0 when overlapping. The proximity-link metric. */
export function edgeGapDistance(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)));
  const dy = Math.max(0, Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h)));
  return Math.hypot(dx, dy);
}

export function boundsOfRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export interface Anchor {
  x: number;
  y: number;
  /** Outward normal (unit axis vector) — bezier control points extend along it. */
  nx: number;
  ny: number;
}

/**
 * Facing-edge anchors for a link between two rects: the dominant axis of the
 * center-to-center vector picks the edge pair; each anchor sits at the other
 * rect's center projected onto that edge, clamped away from corners.
 */
export function anchorsFor(a: Rect, b: Rect): { a: Anchor; b: Anchor } {
  const ca = rectCenter(a);
  const cb = rectCenter(b);
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    const sign = dx >= 0 ? 1 : -1;
    return {
      a: {
        x: sign > 0 ? a.x + a.w : a.x,
        y: clamp(cb.y, a.y + ANCHOR_CORNER_CLAMP, a.y + a.h - ANCHOR_CORNER_CLAMP),
        nx: sign,
        ny: 0,
      },
      b: {
        x: sign > 0 ? b.x : b.x + b.w,
        y: clamp(ca.y, b.y + ANCHOR_CORNER_CLAMP, b.y + b.h - ANCHOR_CORNER_CLAMP),
        nx: -sign,
        ny: 0,
      },
    };
  }
  const sign = dy >= 0 ? 1 : -1;
  return {
    a: {
      x: clamp(cb.x, a.x + ANCHOR_CORNER_CLAMP, a.x + a.w - ANCHOR_CORNER_CLAMP),
      y: sign > 0 ? a.y + a.h : a.y,
      nx: 0,
      ny: sign,
    },
    b: {
      x: clamp(ca.x, b.x + ANCHOR_CORNER_CLAMP, b.x + b.w - ANCHOR_CORNER_CLAMP),
      y: sign > 0 ? b.y : b.y + b.h,
      nx: 0,
      ny: -sign,
    },
  };
}

export interface BezierGeometry {
  d: string;
  mid: { x: number; y: number };
  /** Radians — tangent direction arriving at the `b` end (for arrowheads). */
  endAngle: number;
}

/** Cubic bezier between two anchors with normal-aligned control points. */
export function bezierBetween(a: Anchor, b: Anchor): BezierGeometry {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const ext = clamp(0.4 * dist, 40, 160);
  const c1x = a.x + a.nx * ext;
  const c1y = a.y + a.ny * ext;
  const c2x = b.x + b.nx * ext;
  const c2y = b.y + b.ny * ext;

  // Cubic point at t=0.5: (p0 + 3p1 + 3p2 + p3) / 8
  const mid = {
    x: (a.x + 3 * c1x + 3 * c2x + b.x) / 8,
    y: (a.y + 3 * c1y + 3 * c2y + b.y) / 8,
  };

  return {
    d: `M ${round2(a.x)} ${round2(a.y)} C ${round2(c1x)} ${round2(c1y)}, ${round2(c2x)} ${round2(c2y)}, ${round2(b.x)} ${round2(b.y)}`,
    mid,
    endAngle: Math.atan2(b.y - c2y, b.x - c2x),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Spatial reading order: band rects into rows (y-ranges overlapping ≥ 50% of
 * the smaller height share a band), order bands top-down, then left-to-right
 * within a band. Returns indices into the input array.
 */
export function readingOrder(rects: Rect[]): number[] {
  const idx = rects.map((_, i) => i);
  const bands: number[][] = [];

  for (const i of [...idx].sort((p, q) => rects[p].y - rects[q].y)) {
    const r = rects[i];
    let placed = false;
    for (const band of bands) {
      const rep = rects[band[0]];
      const overlap =
        Math.min(r.y + r.h, rep.y + rep.h) - Math.max(r.y, rep.y);
      const minH = Math.min(r.h, rep.h);
      if (minH > 0 && overlap >= 0.5 * minH) {
        band.push(i);
        placed = true;
        break;
      }
    }
    if (!placed) bands.push([i]);
  }

  return bands.flatMap((band) => band.sort((p, q) => rects[p].x - rects[q].x));
}
