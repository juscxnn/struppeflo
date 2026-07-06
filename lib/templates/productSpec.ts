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
} from "@/lib/types";

export function instantiate(): Board {
  const board = newBoard("Product spec (PRD)");
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
      to: from.id,
      type,
      auto: false,
      createdAt: now,
    };
    board.links[l.id] = l;
  }

  // Five sections: Problem, Users, Requirements, Acceptance Criteria, Open Questions.
  const problem = division("Problem", 40, 40, 300, 380);
  const users = division("Users", 380, 40, 300, 380);
  const reqs = division("Requirements", 720, 40, 300, 460);
  const acceptance = division("Acceptance Criteria", 1060, 40, 300, 460);
  const open = division("Open Questions", 720, 540, 640, 220);

  const problemCard = card(
    "insight",
    "Core pain",
    "Today users hit a wall at X — it costs them Y minutes per session and forces them to do Z manually.",
    70, 104, 116, problem.id, "amber",
  );
  card(
    "resource",
    "Supporting evidence",
    "Quote, ticket log, or research finding that grounds the pain in something measurable.",
    70, 240, 132, problem.id,
  );

  const personaCard = card(
    "note",
    "Primary persona",
    "Engineering lead at a 50-person startup. Hands-on, time-poor, allergic to process theater.",
    410, 104, 124, users.id,
  );
  card(
    "question",
    "Edge case persona",
    "Who else hits this pain, but with different constraints?",
    410, 244, 132, users.id,
  );

  const req1 = card(
    "task",
    "MUST: solve the core flow end-to-end",
    "Anything less than the full path doesn't ship.",
    750, 104, 112, reqs.id,
  );
  const req2 = card(
    "task",
    "MUST: work offline at minimum 24 hours",
    "Users are on planes.",
    750, 232, 100, reqs.id,
  );
  card(
    "task",
    "SHOULD: integrate with the existing export pipeline",
    "Avoids the second-system effect.",
    750, 348, 100, reqs.id,
  );

  const ac1 = card(
    "task",
    "AC: user can complete the flow without a tutorial",
    "Measure with first-task success rate on 5 unmoderated tests.",
    1090, 104, 124, acceptance.id,
  );
  card(
    "task",
    "AC: 95th-percentile load time under 800 ms",
    "On a mid-range Android device over 4G.",
    1090, 244, 132, acceptance.id,
  );

  card(
    "question",
    "Open: do we ship to one persona first, or both?",
    "Affects scope, timeline, and the rollout plan.",
    750, 580, 92, open.id,
  );
  card(
    "question",
    "Open: what's the cut-line if we slip by 2 weeks?",
    "Have this conversation before the sprint starts.",
    1010, 580, 92, open.id,
  );

  link(req1, problemCard, "depends_on");
  link(req2, problemCard, "depends_on");
  link(ac1, req1, "depends_on");

  board.maxZ = z;
  return board;
}