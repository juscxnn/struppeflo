import { CARD_W } from "@/lib/constants";
import { newBoard } from "@/lib/store/boardStore";
import type {
  Board,
  Card,
  CardColor,
  CardType,
  Division,
  ID,
  Link,
  LinkType,
  Workspace,
} from "@/lib/types";

/**
 * Landing-page hero board. Everything lives inside the DEMO_POLICY bounds
 * (980×560 world rect) with ≥16px margins — cards stay draggable but clamped.
 */
export function demoWorkspace(): Workspace {
  const board = buildLaunchPlan();
  return {
    version: 1,
    boards: { [board.id]: board },
    boardOrder: [board.id],
    activeBoardId: board.id,
  };
}

function buildLaunchPlan(): Board {
  const board = newBoard("Launch plan");
  const now = board.createdAt;
  let z = 0;

  function division(name: string, x: number, y: number, w: number, h: number): Division {
    const d: Division = {
      id: crypto.randomUUID(),
      name,
      x,
      y,
      w,
      h,
      color: "default",
      z: ++z,
      createdAt: now,
    };
    board.divisions[d.id] = d;
    return d;
  }

  function card(
    type: CardType,
    title: string,
    body: string,
    x: number,
    y: number,
    h: number,
    divisionId: ID | null,
    color: CardColor = "default",
  ): Card {
    const c: Card = {
      id: crypto.randomUUID(),
      type,
      title,
      body,
      x,
      y,
      w: CARD_W,
      h,
      z: ++z,
      divisionId,
      color,
      createdAt: now,
      updatedAt: now,
    };
    board.cards[c.id] = c;
    return c;
  }

  function link(from: Card, to: Card, type: LinkType): void {
    const l: Link = {
      id: crypto.randomUUID(),
      from: from.id,
      to: to.id,
      type,
      auto: false,
      createdAt: now,
    };
    board.links[l.id] = l;
  }

  const idea = division("Idea", 16, 16, 460, 528);
  const execution = division("Execution", 504, 16, 460, 528);

  card(
    "insight",
    "Drag, don't draft",
    "Move a card and watch the compiled prompt rewrite itself.",
    60, 84, 96, idea.id, "amber",
  );
  const audience = card(
    "note",
    "Audience: solo founders",
    "People who plan alone and think out loud.",
    180, 220, 92, idea.id,
  );

  const landing = card(
    "task",
    "Build the landing page",
    "Promise, live demo, waitlist form.",
    540, 84, 92, execution.id,
  );
  const outreach = card(
    "task",
    "DM 20 beta users",
    "Personal notes, no blast. Ask for one hour of feedback.",
    600, 220, 96, execution.id,
  );
  card(
    "question",
    "Ship when?",
    "Two weeks out — or when 50 people join the waitlist?",
    560, 400, 104, execution.id,
  );

  link(audience, landing, "input_to");
  link(outreach, landing, "depends_on");

  board.maxZ = z;
  return board;
}
