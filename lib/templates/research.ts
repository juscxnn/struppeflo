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
  const board = newBoard("Research synthesis");
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

  const question = division("Question", 40, 40, 300, 460);
  const evidence = division("Evidence", 380, 40, 300, 460);
  const themes = division("Themes", 720, 40, 300, 360);
  const synthesis = division("Synthesis", 1060, 40, 300, 480);

  const rq = card(
    "question",
    "Research question",
    "Does spaced repetition improve procedural skill retention? The literature is solid for facts. The open claim: does spacing transfer to hands-on skills like debugging or suturing?",
    70, 104, 128, question.id, "violet",
  );
  const h1 = card(
    "insight",
    "H1: the spacing effect transfers",
    "Prediction: spaced practice beats massed practice on procedural tests, with a smaller effect size than fact recall.",
    70, 248, 112, question.id,
  );
  const h2 = card(
    "insight",
    "H2: feedback timing dominates",
    "Rival explanation — with immediate feedback, spacing adds little. Any study design must separate these two.",
    70, 376, 92, question.id,
  );

  const meta = card(
    "resource",
    "Cepeda et al. 2006 meta-analysis",
    "https://doi.org/10.1037/0033-2909.132.3.354 — declarative-memory baseline. Every effect size gets compared to this anchor.",
    410, 104, 124, evidence.id,
  );
  const rct = card(
    "resource",
    "Suturing RCT, Moulton 2006",
    "Spaced vs massed microsurgery training. Small n, but the closest procedural analogue found so far.",
    410, 244, 116, evidence.id,
  );
  const disconfirm = card(
    "task",
    "Collect disconfirming evidence",
    "Search for null results and failed replications first. Find the three strongest sources that would kill H1 if true.",
    410, 376, 92, evidence.id,
  );

  const theme1 = card(
    "insight",
    "Theme: procedural transfer exists but is fragile",
    "Where it has been measured, the effect is smaller and more dependent on task design than for declarative memory.",
    750, 104, 112, themes.id,
  );
  card(
    "insight",
    "Theme: feedback timing is the confounder",
    "Most positive results hold only when feedback is delayed. With immediate feedback, the spacing benefit largely disappears.",
    750, 232, 132, themes.id,
  );

  const table = card(
    "task",
    "Build the evidence table",
    "One row per source: population, task type, spacing interval, effect size, risk of bias.",
    1090, 104, 116, synthesis.id,
  );
  const memo = card(
    "task",
    "Draft the synthesis memo",
    "Two pages: what the evidence supports, what stays open, and the single next experiment worth running.",
    1090, 236, 120, synthesis.id,
  );

  link(h1, rq, "depends_on");
  link(disconfirm, h1, "depends_on");
  link(meta, table, "input_to");
  link(memo, table, "depends_on");
  link(memo, disconfirm, "depends_on");
  link(h2, rct, "related_to");

  board.maxZ = z;
  return board;
}