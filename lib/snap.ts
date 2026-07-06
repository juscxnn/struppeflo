import type { Card, Division, ID, Rect } from "./types";

/** Snap a coordinate to the nearest multiple of `grid`. */
export function snapToGrid(n: number, grid: number): number {
  if (grid <= 0) return n;
  return Math.round(n / grid) * grid;
}

/**
 * Snap a rectangle's edges and centers to other cards' edges and centers.
 * Returns the snapped rect. Threshold is in world units. Empty candidates =
 * no snap.
 */
export function snapRectToCards(
  rect: Rect,
  candidates: ReadonlyArray<Rect>,
  threshold: number,
): Rect {
  if (candidates.length === 0) return rect;

  const xPoints = [
    rect.x,
    rect.x + rect.w,
    rect.x + rect.w / 2,
  ];
  const yPoints = [
    rect.y,
    rect.y + rect.h,
    rect.y + rect.h / 2,
  ];
  const theirsX: number[] = [];
  const theirsY: number[] = [];
  for (const c of candidates) {
    theirsX.push(c.x, c.x + c.w, c.x + c.w / 2);
    theirsY.push(c.y, c.y + c.h, c.y + c.h / 2);
  }

  let bestDx = 0;
  let bestDy = 0;
  let bestDxAbs = threshold + 1;
  let bestDyAbs = threshold + 1;

  for (const mine of xPoints) {
    for (const t of theirsX) {
      const d = t - mine;
      const abs = Math.abs(d);
      if (abs < bestDxAbs) {
        bestDxAbs = abs;
        bestDx = d;
      }
    }
  }
  for (const mine of yPoints) {
    for (const t of theirsY) {
      const d = t - mine;
      const abs = Math.abs(d);
      if (abs < bestDyAbs) {
        bestDyAbs = abs;
        bestDy = d;
      }
    }
  }

  let dx = bestDxAbs <= threshold ? bestDx : 0;
  let dy = bestDyAbs <= threshold ? bestDy : 0;

  // If both axes are snapping, prefer the closer one so we don't double-snap.
  if (dx !== 0 && dy !== 0 && bestDxAbs + bestDyAbs > threshold) {
    if (bestDxAbs < bestDyAbs) dy = 0;
    else dx = 0;
  }

  return { x: rect.x + dx, y: rect.y + dy, w: rect.w, h: rect.h };
}

/**
 * Given a set of card rects (already in world coords), return the smallest
 * enclosing rect with the given padding on every side. Used to auto-fit a
 * zone to its member cards.
 */
export function enclosingRect(
  rects: ReadonlyArray<Rect>,
  padding: number,
  minW: number,
  minH: number,
): Rect {
  if (rects.length === 0) {
    return { x: 0, y: 0, w: minW, h: minH };
  }
  let minX = rects[0].x;
  let minY = rects[0].y;
  let maxX = rects[0].x + rects[0].w;
  let maxY = rects[0].y + rects[0].h;
  for (const r of rects) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }
  return {
    x: Math.round(minX - padding),
    y: Math.round(minY - padding),
    w: Math.max(minW, Math.round(maxX - minX + padding * 2)),
    h: Math.max(minH, Math.round(maxY - minY + padding * 2)),
  };
}

/**
 * Fit a division's rect to enclose all its member cards. Returns null when
 * the division has no members or no change is needed.
 */
export function fitDivision(
  division: Division,
  members: ReadonlyArray<Card>,
  padding: number,
  minW: number,
  minH: number,
): { x: number; y: number; w: number; h: number } | null {
  if (members.length === 0) return null;
  const target = enclosingRect(
    members.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h })),
    padding,
    minW,
    minH,
  );
  if (
    target.x === division.x &&
    target.y === division.y &&
    target.w === division.w &&
    target.h === division.h
  ) {
    return null;
  }
  return target;
}

/** Snap a division rect to the grid. Used during resize. */
export function snapDivisionRect(rect: Rect, grid: number): Rect {
  return {
    x: snapToGrid(rect.x, grid),
    y: snapToGrid(rect.y, grid),
    w: Math.max(snapToGrid(rect.w, grid), 1),
    h: Math.max(snapToGrid(rect.h, grid), 1),
  };
}

/** Card centers as snap targets, used during card drag. */
export function cardRectsExcluding(
  board: { cards: Record<ID, Card> },
  exclude: ReadonlySet<ID>,
): Rect[] {
  const out: Rect[] = [];
  for (const c of Object.values(board.cards)) {
    if (exclude.has(c.id)) continue;
    out.push({ x: c.x, y: c.y, w: c.w, h: c.h });
  }
  return out;
}

export interface SnapGuide {
  axis: "v" | "h";
  /** World x (vertical guide) or world y (horizontal guide). */
  pos: number;
  start: number;
  end: number;
}

export interface SnapWithGuidesResult {
  x: number;
  y: number;
  guides: SnapGuide[];
}

/**
 * Alignment-only snapping with guide geometry: snaps the rect's edges and
 * centers to the candidates' edges and centers (both axes independently,
 * Figma-style) and returns the guide lines to render — spanning the dragged
 * rect and every candidate that shares the aligned coordinate. Threshold is
 * in world units; pass a screen-px threshold divided by the camera scale so
 * grabbiness is consistent at every zoom.
 */
export function snapRectWithGuides(
  rect: Rect,
  candidates: ReadonlyArray<Rect>,
  threshold: number,
): SnapWithGuidesResult {
  if (candidates.length === 0 || threshold <= 0) {
    return { x: rect.x, y: rect.y, guides: [] };
  }

  const myX = [rect.x, rect.x + rect.w / 2, rect.x + rect.w];
  const myY = [rect.y, rect.y + rect.h / 2, rect.y + rect.h];

  let bestDx = 0;
  let bestDxAbs = Infinity;
  let bestDy = 0;
  let bestDyAbs = Infinity;

  for (const c of candidates) {
    const cx = [c.x, c.x + c.w / 2, c.x + c.w];
    const cy = [c.y, c.y + c.h / 2, c.y + c.h];
    for (const m of myX) {
      for (const t of cx) {
        const d = t - m;
        const a = Math.abs(d);
        if (a < bestDxAbs) {
          bestDxAbs = a;
          bestDx = d;
        }
      }
    }
    for (const m of myY) {
      for (const t of cy) {
        const d = t - m;
        const a = Math.abs(d);
        if (a < bestDyAbs) {
          bestDyAbs = a;
          bestDy = d;
        }
      }
    }
  }

  const snapX = bestDxAbs <= threshold;
  const snapY = bestDyAbs <= threshold;
  const x = rect.x + (snapX ? bestDx : 0);
  const y = rect.y + (snapY ? bestDy : 0);

  const guides: SnapGuide[] = [];
  const EPS = 0.5;

  if (snapX) {
    const sx = [x, x + rect.w / 2, x + rect.w];
    let pos: number | null = null;
    let lo = y;
    let hi = y + rect.h;
    for (const c of candidates) {
      const cx = [c.x, c.x + c.w / 2, c.x + c.w];
      for (const m of sx) {
        for (const t of cx) {
          if (Math.abs(t - m) <= EPS) {
            pos = t;
            lo = Math.min(lo, c.y);
            hi = Math.max(hi, c.y + c.h);
          }
        }
      }
    }
    if (pos !== null) guides.push({ axis: "v", pos, start: lo, end: hi });
  }

  if (snapY) {
    const sy = [y, y + rect.h / 2, y + rect.h];
    let pos: number | null = null;
    let lo = x;
    let hi = x + rect.w;
    for (const c of candidates) {
      const cy = [c.y, c.y + c.h / 2, c.y + c.h];
      for (const m of sy) {
        for (const t of cy) {
          if (Math.abs(t - m) <= EPS) {
            pos = t;
            lo = Math.min(lo, c.x);
            hi = Math.max(hi, c.x + c.w);
          }
        }
      }
    }
    if (pos !== null) guides.push({ axis: "h", pos, start: lo, end: hi });
  }

  return { x, y, guides };
}