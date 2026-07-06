import type { Card, Division, ID, Rect } from "./types";

/* ============================================================================
 * Snap engine — group-rigid, bounding-box based, with full guide geometry.
 *
 * Mental model:
 *   - The dragged set forms a single bounding box.
 *   - Snap tries each of the 6 candidate lines on each edge of the box
 *     (left edge, right edge, top, bottom, center-x, center-y) against every
 *     candidate's 6 lines (cards + zones).
 *   - The BEST snap on each axis wins (smallest distance to a candidate line).
 *   - If both axes have a winning snap, both apply (the box moves diagonally).
 *     If only one axis has a winner, only that axis snaps.
 *   - The snap offset is applied rigidly to every card in the dragged set,
 *     preserving the group's internal layout.
 *
 * Threshold semantics:
 *   - `thresholdScreenPx` is the snap sensitivity in SCREEN pixels. The
 *     function converts it to world units by dividing by the camera scale
 *     so grabbiness is constant at every zoom.
 * ========================================================================== */

export interface SnapGuide {
  axis: "v" | "h";
  /** World x (vertical guide) or world y (horizontal guide). */
  pos: number;
  /** World-space span start (along the perpendicular axis). */
  start: number;
  /** World-space span end. */
  end: number;
  /** Which points on the dragged set are aligned at `pos`. */
  aligned: ("left" | "cx" | "right" | "top" | "cy" | "bottom")[];
  /** The candidate rectangles that contributed to this guide (for spans). */
  candidates: Rect[];
}

export interface SnapWithGuidesResult {
  x: number;
  y: number;
  dx: number;
  dy: number;
  guides: SnapGuide[];
}

/**
 * A rect's six "alignment lines" — the points other rects can snap to.
 * Order: left, center-x, right, top, center-y, bottom.
 */
function alignmentPoints(r: Rect): {
  x: number[];
  y: number[];
} {
  return {
    x: [r.x, r.x + r.w / 2, r.x + r.w],
    y: [r.y, r.y + r.h / 2, r.y + r.h],
  };
}

function alignmentLabel(idx: number): "left" | "cx" | "right" | "top" | "cy" | "bottom" {
  if (idx === 0) return "left";
  if (idx === 1) return "cx";
  if (idx === 2) return "right";
  if (idx === 3) return "top";
  if (idx === 4) return "cy";
  return "bottom";
}

/** Bounding box of a set of rects. */
function boundingBox(rects: ReadonlyArray<Rect>): Rect {
  if (rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Compute the bounding box of a SET of cards at their tentative positions
 * (used when dragging multiple cards — we snap the group's box, not one card).
 */
export function groupBoundingBox(
  starts: Map<ID, Rect>,
  deltas: { dx: number; dy: number },
): Rect {
  const positions: Rect[] = [];
  for (const r of starts.values()) {
    positions.push({ x: r.x + deltas.dx, y: r.y + deltas.dy, w: r.w, h: r.h });
  }
  return boundingBox(positions);
}

/**
 * Find the best snap delta + guides for the given group bounding box.
 * Pure function — no side effects.
 */
export function snapGroupBox(
  groupBox: Rect,
  candidates: ReadonlyArray<Rect>,
  thresholdWorld: number,
): SnapWithGuidesResult {
  if (candidates.length === 0 || thresholdWorld <= 0) {
    return { x: groupBox.x, y: groupBox.y, dx: 0, dy: 0, guides: [] };
  }

  // Build candidate points
  const candXByPoint: Record<"left" | "cx" | "right", Array<{ pos: number; rect: Rect }>> = {
    left: [],
    cx: [],
    right: [],
  };
  const candYByPoint: Record<"top" | "cy" | "bottom", Array<{ pos: number; rect: Rect }>> = {
    top: [],
    cy: [],
    bottom: [],
  };
  for (const c of candidates) {
    const ap = alignmentPoints(c);
    candXByPoint.left.push({ pos: ap.x[0], rect: c });
    candXByPoint.cx.push({ pos: ap.x[1], rect: c });
    candXByPoint.right.push({ pos: ap.x[2], rect: c });
    candYByPoint.top.push({ pos: ap.y[0], rect: c });
    candYByPoint.cy.push({ pos: ap.y[1], rect: c });
    candYByPoint.bottom.push({ pos: ap.y[2], rect: c });
  }

  const myPoints = alignmentPoints(groupBox);

  // For X axis: try all (myPoint, candPoint) pairs, pick closest within threshold.
  type CandidateX = {
    delta: number;
    abs: number;
    myPointIdx: 0 | 1 | 2;
    candPos: number;
    candRects: Rect[];
  };
  type CandidateY = {
    delta: number;
    abs: number;
    myPointIdx: 0 | 1 | 2;
    candPos: number;
    candRects: Rect[];
  };

  const xCandidates: CandidateX[] = [];
  for (const myKey of ["left", "cx", "right"] as const) {
    const myIdx: 0 | 1 | 2 = myKey === "left" ? 0 : myKey === "cx" ? 1 : 2;
    const myPos = myPoints.x[myIdx];
    const matches = candXByPoint[myKey];
    const byPos = new Map<number, Rect[]>();
    for (const { pos, rect } of matches) {
      const delta = pos - myPos;
      if (Math.abs(delta) > thresholdWorld) continue;
      const list = byPos.get(pos);
      if (list) list.push(rect);
      else byPos.set(pos, [rect]);
    }
    for (const [pos, rects] of byPos) {
      xCandidates.push({
        delta: pos - myPos,
        abs: Math.abs(pos - myPos),
        myPointIdx: myIdx,
        candPos: pos,
        candRects: rects,
      });
    }
  }

  const yCandidates: CandidateY[] = [];
  for (const myKey of ["top", "cy", "bottom"] as const) {
    const myIdx: 0 | 1 | 2 = myKey === "top" ? 0 : myKey === "cy" ? 1 : 2;
    const myPos = myPoints.y[myIdx];
    const matches = candYByPoint[myKey];
    const byPos = new Map<number, Rect[]>();
    for (const { pos, rect } of matches) {
      const delta = pos - myPos;
      if (Math.abs(delta) > thresholdWorld) continue;
      const list = byPos.get(pos);
      if (list) list.push(rect);
      else byPos.set(pos, [rect]);
    }
    for (const [pos, rects] of byPos) {
      yCandidates.push({
        delta: pos - myPos,
        abs: Math.abs(pos - myPos),
        myPointIdx: myIdx,
        candPos: pos,
        candRects: rects,
      });
    }
  }

  // Pick the best candidate on each axis (smallest distance, ties broken by lower idx = more "primary" edge)
  const bestX = pickBest<CandidateX>(xCandidates);
  const bestY = pickBest<CandidateY>(yCandidates);

  const dx = bestX?.delta ?? 0;
  const dy = bestY?.delta ?? 0;

  const guides: SnapGuide[] = [];

  if (bestX) {
    // Guide spans from the topmost candidate to the bottommost candidate,
    // extended to cover the group's full vertical span at this x.
    const allRects = [...bestX.candRects, groupBox];
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of allRects) {
      if (r.y < lo) lo = r.y;
      if (r.y + r.h > hi) hi = r.y + r.h;
    }
    guides.push({
      axis: "v",
      pos: bestX.candPos,
      start: lo,
      end: hi,
      aligned: [alignmentLabel(bestX.myPointIdx)],
      candidates: bestX.candRects,
    });
  }

  if (bestY) {
    const allRects = [...bestY.candRects, groupBox];
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of allRects) {
      if (r.x < lo) lo = r.x;
      if (r.x + r.w > hi) hi = r.x + r.w;
    }
    guides.push({
      axis: "h",
      pos: bestY.candPos,
      start: lo,
      end: hi,
      aligned: [alignmentLabel(bestY.myPointIdx)],
      candidates: bestY.candRects,
    });
  }

  return {
    x: groupBox.x + dx,
    y: groupBox.y + dy,
    dx,
    dy,
    guides,
  };
}

function pickBest<T extends { abs: number }>(candidates: T[]): T | null {
  if (candidates.length === 0) return null;
  let best = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].abs < best.abs) best = candidates[i];
  }
  return best;
}

/* ============================================================================
 * Zone auto-fit utilities — unchanged from before.
 * ========================================================================== */

export function snapToGrid(n: number, grid: number): number {
  if (grid <= 0) return n;
  return Math.round(n / grid) * grid;
}

/** Smallest enclosing rect with padding. */
export function enclosingRect(
  rects: ReadonlyArray<Rect>,
  padding: number,
  minW: number,
  minH: number,
): Rect {
  if (rects.length === 0) return { x: 0, y: 0, w: minW, h: minH };
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

/** Fit a division to enclose its members. Returns null if no change needed. */
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

export function snapDivisionRect(rect: Rect, grid: number): Rect {
  return {
    x: snapToGrid(rect.x, grid),
    y: snapToGrid(rect.y, grid),
    w: Math.max(snapToGrid(rect.w, grid), 1),
    h: Math.max(snapToGrid(rect.h, grid), 1),
  };
}

/** Card rects as snap candidates (used during card drag). */
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

/* ============================================================================
 * De-overlap helper — runs at end of drag to space cards that ended up on
 * top of each other or on top of zone residents.
 * ========================================================================== */

/**
 * Resolve overlaps after a multi-card drag. The dragged set keeps its
 * perpendicular-to-axis spacing and cascades along the drag axis until no
 * card overlaps any other.
 */
export function deOverlap(
  dragged: Map<ID, Rect>,
  others: Map<ID, Rect>,
  dx: number,
  dy: number,
): Map<ID, Rect> {
  const ids = [...dragged.keys()];
  if (ids.length < 2) return dragged;
  const horizontal = Math.abs(dx) > Math.abs(dy) * 1.15;
  const cmp = (a: ID, b: ID): number => {
    const ra = dragged.get(a)!;
    const rb = dragged.get(b)!;
    return horizontal ? ra.x - rb.x || ra.y - rb.y : ra.y - rb.y || ra.x - rb.x;
  };
  const ordered = [...ids].sort(cmp);

  const out = new Map<ID, Rect>();
  for (const id of ordered) {
    let r: Rect = { ...dragged.get(id)! };
    for (let pass = 0; pass < 8; pass++) {
      let collided = false;
      for (const other of out.values()) {
        if (rectsOverlap(r, other)) {
          if (horizontal) r.x = other.x + other.w + 16;
          else r.y = other.y + other.h + 16;
          collided = true;
        }
      }
      for (const resident of others.values()) {
        if (rectsOverlap(r, resident)) {
          if (horizontal) r.x = resident.x + resident.w + 16;
          else r.y = resident.y + resident.h + 16;
          collided = true;
        }
      }
      if (!collided) break;
    }
    out.set(id, r);
  }
  return out;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}