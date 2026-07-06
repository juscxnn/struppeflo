import { orderBoard } from "@/lib/compiler/order";
import { CARD_DEFAULT_H, CARD_W, DIVISION_MIN_H } from "@/lib/constants";
import { newBoard } from "@/lib/store/boardStore";
import type { Card, Board, Division, ID, Link, WorkflowPlan } from "@/lib/types";

const LANE_STRIDE = 360;
const LANE_W = 320;
const PAD = 24;
const TOP_PAD = 56;
const GAP = 16;

function pairKey(a: ID, b: ID): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function planWorkflow(board: Board): WorkflowPlan {
  const order = orderBoard(board);
  const nb = newBoard(`${board.name} — Workflow`);
  const now = nb.createdAt;
  const idMap = new Map<ID, ID>();
  let z = 0;

  order.sections.forEach((section, laneIdx) => {
    const laneX = laneIdx * LANE_STRIDE;
    const divisionId = crypto.randomUUID();

    // Context (non-task) cards on top, then tasks in the section's topo order.
    const laneCards = [
      ...section.cards.filter((c) => c.type !== "task"),
      ...section.cards.filter((c) => c.type === "task"),
    ];

    let y = TOP_PAD;
    for (const c of laneCards) {
      const h = c.h > 0 ? c.h : CARD_DEFAULT_H;
      const copy: Card = {
        id: crypto.randomUUID(),
        type: c.type,
        title: c.title,
        body: c.body,
        x: laneX + (LANE_W - CARD_W) / 2,
        y,
        w: CARD_W,
        h,
        z: ++z,
        divisionId,
        color: c.color,
        createdAt: now,
        updatedAt: now,
      };
      idMap.set(c.id, copy.id);
      nb.cards[copy.id] = copy;
      y += h + GAP;
    }

    const contentBottom = laneCards.length > 0 ? y - GAP : TOP_PAD;
    const division: Division = {
      id: divisionId,
      name: section.name,
      x: laneX,
      y: 0,
      w: LANE_W,
      h: Math.max(DIVISION_MIN_H, contentBottom + PAD),
      color: "default",
      z: ++z,
      createdAt: now,
    };
    nb.divisions[division.id] = division;
  });

  // Directed links carry over; related_to is dropped — this view is about flow.
  const sourceLinks = Object.values(board.links).sort(
    (a, b) => a.createdAt - b.createdAt || cmpStr(a.id, b.id),
  );
  for (const link of sourceLinks) {
    if (link.type === "related_to") continue;
    const from = idMap.get(link.from);
    const to = idMap.get(link.to);
    if (!from || !to) continue;
    const copy: Link = {
      id: crypto.randomUUID(),
      from,
      to,
      type: link.type,
      auto: link.auto,
      createdAt: now,
    };
    nb.links[copy.id] = copy;
  }

  // Chain consecutive tasks in the global execution order that aren't
  // already directly connected: later NEEDS earlier.
  const linkedPairs = new Set<string>();
  for (const link of Object.values(nb.links)) {
    linkedPairs.add(pairKey(link.from, link.to));
  }
  const taskExec = order.executionOrder.filter((e) => e.card.type === "task");
  for (let i = 0; i + 1 < taskExec.length; i++) {
    const earlier = idMap.get(taskExec[i].card.id);
    const later = idMap.get(taskExec[i + 1].card.id);
    if (!earlier || !later) continue;
    const key = pairKey(earlier, later);
    if (linkedPairs.has(key)) continue;
    linkedPairs.add(key);
    const chain: Link = {
      id: crypto.randomUUID(),
      from: later,
      to: earlier,
      type: "depends_on",
      auto: true,
      createdAt: now,
    };
    nb.links[chain.id] = chain;
  }

  nb.maxZ = z;
  return { board: nb };
}
