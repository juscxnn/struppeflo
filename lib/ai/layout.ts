import { CARD_W, DIVISION_MIN_H, DIVISION_MIN_W } from "../constants";
import { boundsOfRects } from "../geometry";
import type { Board, CardColor, ID, OrganizePlan } from "../types";

const PAD = 24;
const TITLE_H = 56;
const GUTTER = 16;
const GROUP_GAP = 40;
const COLORS: CardColor[] = ["blue", "violet", "teal", "amber", "rose"];

/**
 * Turn named card groupings (from any organizer — heuristic or LLM) into a
 * concrete OrganizePlan: division rects in a 2-per-row grid placed right of
 * existing content, cards flowing in two columns inside each.
 */
export function layoutOrganizePlan(
  board: Board,
  groups: Array<{ name: string; cardIds: ID[] }>,
): OrganizePlan {
  const content = boundsOfRects([
    ...Object.values(board.cards),
    ...Object.values(board.divisions),
  ]);
  const originX = content ? content.x + content.w + 80 : 0;
  const originY = content ? content.y : 0;

  const divisionW = Math.max(DIVISION_MIN_W, PAD * 2 + CARD_W * 2 + GUTTER);

  const plan: OrganizePlan = { divisions: [], assignments: {}, positions: {} };

  // Pre-compute each group's height from member card heights (2-column flow).
  const sized = groups
    .map((g) => ({
      ...g,
      cardIds: g.cardIds.filter((id) => board.cards[id]),
    }))
    .filter((g) => g.cardIds.length > 0)
    .map((g) => {
      const cols = [0, 0];
      const slots = g.cardIds.map((id) => {
        const h = Math.max(48, board.cards[id].h);
        const col = cols[0] <= cols[1] ? 0 : 1;
        const y = cols[col];
        cols[col] += h + GUTTER;
        return { id, col, y };
      });
      const height = Math.max(
        DIVISION_MIN_H,
        TITLE_H + Math.max(cols[0], cols[1]) - GUTTER + PAD,
      );
      return { ...g, slots, height };
    });

  let rowY = originY;
  for (let i = 0; i < sized.length; i += 2) {
    const row = sized.slice(i, i + 2);
    row.forEach((group, j) => {
      const idx = i + j;
      const rect = {
        x: originX + j * (divisionW + GROUP_GAP),
        y: rowY,
        w: divisionW,
        h: group.height,
      };
      plan.divisions.push({
        name: group.name,
        color: COLORS[idx % COLORS.length],
        rect,
      });
      for (const slot of group.slots) {
        plan.assignments[slot.id] = idx;
        plan.positions[slot.id] = {
          x: Math.round(rect.x + PAD + slot.col * (CARD_W + GUTTER)),
          y: Math.round(rect.y + TITLE_H + slot.y),
        };
      }
    });
    rowY += Math.max(...row.map((g) => g.height)) + GROUP_GAP;
  }

  return plan;
}
