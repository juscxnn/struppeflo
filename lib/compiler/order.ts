import { readingOrder } from "../geometry";
import type { Board, Card, CompilerWarning, ID, Link } from "../types";

export interface OrderedSection {
  divisionId: string | null;
  name: string;
  cards: Card[];
}

export interface OrderResult {
  sections: OrderedSection[];
  executionOrder: Array<{ card: Card; sectionName: string }>;
  warnings: CompilerWarning[];
  edges: Record<
    string,
    { dependsOn: string[]; inputs: string[]; relatedTo: string[] }
  >;
}

/** Directed ordering edge: `from` is the prerequisite and must precede `to`. */
interface DirectedEdge {
  from: ID;
  to: ID;
  linkId: ID;
  createdAt: number;
}

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function byCreatedThenId(
  a: { createdAt: number; id: ID },
  b: { createdAt: number; id: ID },
): number {
  return a.createdAt - b.createdAt || cmpStr(a.id, b.id);
}

function insertSorted(
  arr: ID[],
  id: ID,
  compare: (a: ID, b: ID) => number,
): void {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (compare(arr[mid], id) <= 0) lo = mid + 1;
    else hi = mid;
  }
  arr.splice(lo, 0, id);
}

/**
 * Kahn topo sort; the ready queue always pops the minimum under `compare`,
 * so ties resolve deterministically. Returns a partial order on stall.
 */
function runKahn(
  nodeIds: readonly ID[],
  edges: ReadonlyArray<{ from: ID; to: ID }>,
  compare: (a: ID, b: ID) => number,
): ID[] {
  const inScope = new Set(nodeIds);
  const indegree = new Map<ID, number>();
  for (const id of nodeIds) indegree.set(id, 0);
  const out = new Map<ID, ID[]>();
  for (const e of edges) {
    if (!inScope.has(e.from) || !inScope.has(e.to)) continue;
    indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
    const list = out.get(e.from);
    if (list) list.push(e.to);
    else out.set(e.from, [e.to]);
  }
  const ready = nodeIds.filter((id) => indegree.get(id) === 0).sort(compare);
  const order: ID[] = [];
  while (ready.length > 0) {
    const id = ready.shift() as ID;
    order.push(id);
    for (const next of out.get(id) ?? []) {
      const d = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, d);
      if (d === 0) insertSorted(ready, next, compare);
    }
  }
  return order;
}

/** DFS over the given subgraph; returns the edges of the first cycle found. */
function findCycle(
  nodeIds: readonly ID[],
  edges: readonly DirectedEdge[],
): DirectedEdge[] {
  const inScope = new Set(nodeIds);
  const out = new Map<ID, DirectedEdge[]>();
  for (const e of edges) {
    if (!inScope.has(e.from) || !inScope.has(e.to)) continue;
    const list = out.get(e.from);
    if (list) list.push(e);
    else out.set(e.from, [e]);
  }
  // Deterministic traversal so the same cycle is found every run.
  for (const list of out.values()) {
    list.sort((a, b) => cmpStr(a.linkId, b.linkId));
  }

  const ON_PATH = 1;
  const DONE = 2;
  const state = new Map<ID, 1 | 2>();
  const path: DirectedEdge[] = [];
  let found: DirectedEdge[] = [];

  const visit = (id: ID): boolean => {
    state.set(id, ON_PATH);
    for (const e of out.get(id) ?? []) {
      const s = state.get(e.to);
      if (s === DONE) continue;
      if (s === ON_PATH) {
        const start = path.findIndex((p) => p.from === e.to);
        found = start === -1 ? [e] : [...path.slice(start), e];
        return true;
      }
      path.push(e);
      if (visit(e.to)) return true;
      path.pop();
    }
    state.set(id, DONE);
    return false;
  };

  for (const id of nodeIds) {
    if (!state.has(id) && visit(id)) return found;
  }
  return found;
}

/**
 * Kahn with cycle breaking: on stall, drop the cycle edge whose link has the
 * latest createdAt (ties → greater link id) and retry. The board's links are
 * never mutated — edges are only ignored for ordering.
 */
function topoWithCycleBreaking(
  nodeIds: readonly ID[],
  edges: readonly DirectedEdge[],
  compare: (a: ID, b: ID) => number,
  onBreak: (edge: DirectedEdge) => void,
): ID[] {
  const ignored = new Set<DirectedEdge>();
  for (;;) {
    const active = edges.filter((e) => !ignored.has(e));
    const order = runKahn(nodeIds, active, compare);
    if (order.length === nodeIds.length) return order;
    const done = new Set(order);
    const remaining = nodeIds.filter((id) => !done.has(id));
    const cycle = findCycle(remaining, active);
    if (cycle.length === 0) {
      // Unreachable after a stall; guards against an infinite loop.
      return [...order, ...[...remaining].sort(compare)];
    }
    let victim = cycle[0];
    for (const e of cycle) {
      if (
        e.createdAt > victim.createdAt ||
        (e.createdAt === victim.createdAt && cmpStr(e.linkId, victim.linkId) > 0)
      ) {
        victim = e;
      }
    }
    ignored.add(victim);
    onBreak(victim);
  }
}

export function orderBoard(board: Board): OrderResult {
  const warnings: CompilerWarning[] = [];
  const cards = board.cards;

  // (a) Drop links with missing endpoints.
  const validLinks: Link[] = [];
  for (const link of Object.values(board.links).sort(byCreatedThenId)) {
    if (cards[link.from] && cards[link.to]) {
      validLinks.push(link);
    } else {
      warnings.push({
        kind: "orphan_link",
        linkId: link.id,
        message: `Orphan link ${link.id} dropped: one or both endpoint cards are missing.`,
      });
    }
  }
  const linkById = new Map<ID, Link>(validLinks.map((l) => [l.id, l]));

  // (b) Per-card edge map, arrays sorted lexicographically.
  const cardList = Object.values(cards).sort(byCreatedThenId);
  const edges: OrderResult["edges"] = {};
  for (const c of cardList) {
    edges[c.id] = { dependsOn: [], inputs: [], relatedTo: [] };
  }
  for (const link of validLinks) {
    if (link.type === "depends_on") {
      edges[link.from].dependsOn.push(link.to);
    } else if (link.type === "input_to") {
      edges[link.to].inputs.push(link.from);
    } else {
      edges[link.from].relatedTo.push(link.to);
      edges[link.to].relatedTo.push(link.from);
    }
  }
  for (const e of Object.values(edges)) {
    e.dependsOn.sort(cmpStr);
    e.inputs.sort(cmpStr);
    e.relatedTo.sort(cmpStr);
  }

  // Ordering edges: prerequisite → dependent (depends_on flips the arrow).
  const directed: DirectedEdge[] = validLinks
    .filter((l) => l.type !== "related_to")
    .map((l) =>
      l.type === "depends_on"
        ? { from: l.to, to: l.from, linkId: l.id, createdAt: l.createdAt }
        : { from: l.from, to: l.to, linkId: l.id, createdAt: l.createdAt },
    );

  // (c) Division ordering.
  const divisionList = Object.values(board.divisions).sort(byCreatedThenId);
  const divReadingIdx = new Map<ID, number>();
  readingOrder(divisionList).forEach((origIdx, pos) => {
    divReadingIdx.set(divisionList[origIdx].id, pos);
  });

  const divisionOf = (cardId: ID): ID | null => {
    const d = cards[cardId].divisionId;
    return d !== null && board.divisions[d] ? d : null;
  };

  const cardsByDivision = new Map<ID | null, Card[]>();
  for (const c of cardList) {
    const key = divisionOf(c.id);
    const list = cardsByDivision.get(key);
    if (list) list.push(c);
    else cardsByDivision.set(key, [c]);
  }

  const divEdges: Array<{ from: ID; to: ID }> = [];
  for (const e of directed) {
    const a = divisionOf(e.from);
    const b = divisionOf(e.to);
    if (a !== null && b !== null && a !== b) divEdges.push({ from: a, to: b });
  }

  const divCompare = (a: ID, b: ID): number =>
    (divReadingIdx.get(a) ?? 0) - (divReadingIdx.get(b) ?? 0);
  const divIds = divisionList.map((d) => d.id);
  const divOrder = runKahn(divIds, divEdges, divCompare);
  let orderedDivIds: ID[];
  if (divOrder.length === divIds.length) {
    orderedDivIds = divOrder;
  } else {
    const done = new Set(divOrder);
    const remaining = divIds.filter((id) => !done.has(id)).sort(divCompare);
    const names = remaining
      .map((id) => `"${board.divisions[id].name}"`)
      .join(", ");
    warnings.push({
      kind: "cycle_broken",
      message: `Cycle broken: divisions ${names} fall back to reading order.`,
    });
    orderedDivIds = [...divOrder, ...remaining];
  }

  const sectionSpecs: Array<{
    divisionId: ID | null;
    name: string;
    cards: Card[];
  }> = orderedDivIds.map((id) => ({
    divisionId: id,
    name: board.divisions[id].name,
    cards: cardsByDivision.get(id) ?? [],
  }));
  const ungrouped = cardsByDivision.get(null) ?? [];
  if (ungrouped.length > 0) {
    sectionSpecs.push({ divisionId: null, name: "Ungrouped", cards: ungrouped });
  }

  const warnedLinkIds = new Set<ID>();
  const onBreak = (edge: DirectedEdge): void => {
    if (warnedLinkIds.has(edge.linkId)) return;
    warnedLinkIds.add(edge.linkId);
    const link = linkById.get(edge.linkId) as Link;
    const fromTitle = cards[link.from].title || "Untitled";
    const toTitle = cards[link.to].title || "Untitled";
    warnings.push({
      kind: "cycle_broken",
      linkId: edge.linkId,
      message: `Cycle broken: ordering ignores "${fromTitle}" → "${toTitle}"`,
    });
  };

  // (d) Card ordering within each section.
  const readingIdxOf = new Map<ID, number>();
  const sectionIdxOf = new Map<ID, number>();
  const sections: OrderedSection[] = sectionSpecs.map((spec, sectionIdx) => {
    const members = spec.cards;
    readingOrder(members).forEach((origIdx, pos) => {
      readingIdxOf.set(members[origIdx].id, pos);
    });
    for (const c of members) sectionIdxOf.set(c.id, sectionIdx);

    const compare = (a: ID, b: ID): number =>
      (readingIdxOf.get(a) ?? 0) - (readingIdxOf.get(b) ?? 0) ||
      cards[a].createdAt - cards[b].createdAt ||
      cmpStr(a, b);

    const memberIds = new Set(members.map((c) => c.id));
    const sectionEdges = directed.filter(
      (e) => memberIds.has(e.from) && memberIds.has(e.to),
    );
    const orderedIds = topoWithCycleBreaking(
      members.map((c) => c.id),
      sectionEdges,
      compare,
      onBreak,
    );
    return {
      divisionId: spec.divisionId,
      name: spec.name,
      cards: orderedIds.map((id) => cards[id]),
    };
  });

  // (e) Global execution order across all directed edges.
  const globalCompare = (a: ID, b: ID): number =>
    (sectionIdxOf.get(a) ?? 0) - (sectionIdxOf.get(b) ?? 0) ||
    (readingIdxOf.get(a) ?? 0) - (readingIdxOf.get(b) ?? 0) ||
    cards[a].createdAt - cards[b].createdAt ||
    cmpStr(a, b);
  const execIds = topoWithCycleBreaking(
    cardList.map((c) => c.id),
    directed,
    globalCompare,
    onBreak,
  );
  const executionOrder = execIds.map((id) => ({
    card: cards[id],
    sectionName: sections[sectionIdxOf.get(id) ?? 0].name,
  }));

  return { sections, executionOrder, warnings, edges };
}
