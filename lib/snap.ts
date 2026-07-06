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