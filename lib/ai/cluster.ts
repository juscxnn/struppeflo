import { CARD_DEFAULT_H, CARD_W } from "@/lib/constants";
import { boundsOfRects } from "@/lib/geometry";
import type { Board, Card, CardColor, ID, OrganizePlan, Rect } from "@/lib/types";
import { buildVectors, cosine, tokenize } from "./text";

const MERGE_THRESHOLD = 0.18;
const OUTLIER_THRESHOLD = 0.05;
const UNSORTED_NAME = "Later / Unsorted";
const COLOR_CYCLE: readonly CardColor[] = ["blue", "violet", "teal", "amber", "rose"];

const PAD = 24;
const TOP_PAD = 56;
const GUTTER = 16;
const GRID_GUTTER = 40;
const GRID_OFFSET = 80;
const DIVISIONS_PER_ROW = 2;
const CARD_COLS = 2;
const DIV_W = PAD * 2 + CARD_W * CARD_COLS + GUTTER * (CARD_COLS - 1);

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function pairKey(a: ID, b: ID): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function cardH(c: Card): number {
  return c.h > 0 ? c.h : CARD_DEFAULT_H;
}

/** First raw word that produced each stem, for human-readable names. */
function displayWords(texts: readonly string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const text of texts) {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!cleaned) continue;
    for (const word of cleaned.split(/\s+/)) {
      const [term] = tokenize(word);
      if (term && !map.has(term)) map.set(term, word);
    }
  }
  return map;
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** 0 → "A", 25 → "Z", 26 → "AA", … */
function letterName(n: number): string {
  let out = "";
  let i = n;
  do {
    out = String.fromCharCode(65 + (i % 26)) + out;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  return out;
}

export function planOrganize(board: Board): OrganizePlan {
  const loose = Object.values(board.cards)
    .filter((c) => c.divisionId === null)
    .sort((a, b) => cmpStr(a.id, b.id));
  if (loose.length < 2) return { divisions: [], assignments: {}, positions: {} };

  const docs = loose.map((c) => ({
    id: c.id,
    // Title repeated twice for extra weight, then the body.
    text: `${c.title} ${c.title} ${c.body}`,
  }));
  const vectors = buildVectors(docs);
  const display = displayWords(docs.map((d) => d.text));

  const sim = new Map<string, number>();
  const maxSim = new Map<ID, number>();
  for (const c of loose) maxSim.set(c.id, 0);
  for (let i = 0; i < loose.length; i++) {
    for (let j = i + 1; j < loose.length; j++) {
      const a = loose[i].id;
      const b = loose[j].id;
      const s = cosine(vectors.get(a) as Map<string, number>, vectors.get(b) as Map<string, number>);
      sim.set(pairKey(a, b), s);
      if (s > (maxSim.get(a) ?? 0)) maxSim.set(a, s);
      if (s > (maxSim.get(b) ?? 0)) maxSim.set(b, s);
    }
  }

  const unsortedIds = loose
    .filter((c) => (maxSim.get(c.id) ?? 0) < OUTLIER_THRESHOLD)
    .map((c) => c.id);
  const unsortedSet = new Set(unsortedIds);
  const clusterable = loose.filter((c) => !unsortedSet.has(c.id));

  const simOf = (a: ID, b: ID): number => sim.get(pairKey(a, b)) ?? 0;
  const linkage = (as: readonly ID[], bs: readonly ID[]): number => {
    let sum = 0;
    for (const a of as) for (const b of bs) sum += simOf(a, b);
    return sum / (as.length * bs.length);
  };

  // Greedy average-linkage agglomeration. Clusters stay sorted by their
  // smallest member id, so the first strict-max pair is the lexicographic
  // tie-break winner.
  let clusters: ID[][] = clusterable.map((c) => [c.id]);
  const floor = Math.max(2, Math.ceil(clusterable.length / 6));
  while (clusters.length > floor) {
    let bestScore = -1;
    let bestI = -1;
    let bestJ = -1;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const s = linkage(clusters[i], clusters[j]);
        if (s > bestScore) {
          bestScore = s;
          bestI = i;
          bestJ = j;
        }
      }
    }
    if (bestScore <= MERGE_THRESHOLD) break;
    const merged = [...clusters[bestI], ...clusters[bestJ]].sort(cmpStr);
    clusters = clusters.filter((_, k) => k !== bestI && k !== bestJ);
    clusters.push(merged);
    clusters.sort((p, q) => cmpStr(p[0], q[0]));
  }

  if (unsortedIds.length > 0) clusters.push([...unsortedIds].sort(cmpStr));
  const unsortedIdx = unsortedIds.length > 0 ? clusters.length - 1 : -1;

  // Names: top 2 TF-IDF terms across member docs, mapped back to raw words.
  const usedNames = new Set<string>();
  let fallbackCounter = 0;
  const nameOf = (members: readonly ID[], idx: number): string => {
    if (idx === unsortedIdx) {
      usedNames.add(UNSORTED_NAME);
      return UNSORTED_NAME;
    }
    const weights = new Map<string, number>();
    for (const id of members) {
      for (const [term, w] of vectors.get(id) ?? []) {
        weights.set(term, (weights.get(term) ?? 0) + w);
      }
    }
    const top = [...weights.entries()]
      .sort((p, q) => q[1] - p[1] || cmpStr(p[0], q[0]))
      .slice(0, 2)
      .map(([term]) => titleCase(display.get(term) ?? term));
    let name = top.join(" & ");
    if (!name || usedNames.has(name)) {
      do {
        name = `Group ${letterName(fallbackCounter)}`;
        fallbackCounter += 1;
      } while (usedNames.has(name));
    }
    usedNames.add(name);
    return name;
  };

  // Layout: grid to the right of all existing content, 2 divisions per row.
  const cardById = new Map(loose.map((c) => [c.id, c]));
  const existing: Rect[] = [
    ...Object.values(board.cards).map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h })),
    ...Object.values(board.divisions).map((d) => ({ x: d.x, y: d.y, w: d.w, h: d.h })),
  ];
  const bounds = boundsOfRects(existing);
  const originX = bounds ? bounds.x + bounds.w + GRID_OFFSET : 0;
  const originY = bounds ? bounds.y : 0;

  const rowHeightsOf = (members: readonly ID[]): number[] => {
    const rows: number[] = [];
    for (let m = 0; m < members.length; m += CARD_COLS) {
      let h = 0;
      for (let k = m; k < Math.min(m + CARD_COLS, members.length); k++) {
        h = Math.max(h, cardH(cardById.get(members[k]) as Card));
      }
      rows.push(h);
    }
    return rows;
  };

  const divHeights = clusters.map((members) => {
    const rows = rowHeightsOf(members);
    const innerH =
      rows.reduce((sum, h) => sum + h, 0) + GUTTER * Math.max(0, rows.length - 1);
    return TOP_PAD + innerH + PAD;
  });

  const plan: OrganizePlan = { divisions: [], assignments: {}, positions: {} };
  let rowY = originY;
  let rowMaxH = 0;
  clusters.forEach((members, idx) => {
    const col = idx % DIVISIONS_PER_ROW;
    if (col === 0 && idx > 0) {
      rowY += rowMaxH + GRID_GUTTER;
      rowMaxH = 0;
    }
    const dx = originX + col * (DIV_W + GRID_GUTTER);
    const dy = rowY;
    const dh = divHeights[idx];
    rowMaxH = Math.max(rowMaxH, dh);

    plan.divisions.push({
      name: nameOf(members, idx),
      color: COLOR_CYCLE[idx % COLOR_CYCLE.length],
      rect: { x: dx, y: dy, w: DIV_W, h: dh },
    });

    const rows = rowHeightsOf(members);
    members.forEach((cardId, m) => {
      const cardCol = m % CARD_COLS;
      const cardRow = Math.floor(m / CARD_COLS);
      let yOff = 0;
      for (let r = 0; r < cardRow; r++) yOff += rows[r] + GUTTER;
      plan.assignments[cardId] = idx;
      plan.positions[cardId] = {
        x: dx + PAD + cardCol * (CARD_W + GUTTER),
        y: dy + TOP_PAD + yOff,
      };
    });
  });

  return plan;
}
