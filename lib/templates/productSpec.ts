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
  const board = newBoard("Product spec");
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

  const problem = division("Problem", 40, 40, 300, 360);
  const solution = division("Solution", 380, 40, 300, 500);
  const scope = division("Scope", 720, 40, 300, 584);
  const risks = division("Risks", 1060, 40, 300, 360);

  const statement = card(
    "note",
    "Problem statement",
    "Ideas are captured in five tools and planned in none. The cost is re-reading, re-deciding, and dropped commitments.",
    70, 104, 124, problem.id,
  );
  card(
    "note",
    "Who hurts most",
    "Solo builders juggling product, marketing, and support — no PM to consolidate, so the canvas must do it.",
    70, 244, 116, problem.id,
  );

  const storyDump = card(
    "note",
    "Story: dump, then structure",
    "As a builder, I paste a brain dump and get typed cards I can drag into zones — planning starts from what's already in my head.",
    410, 104, 128, solution.id,
  );
  card(
    "note",
    "Story: compile to prompt",
    "As a builder, I hit Compile and get a prompt that mirrors the board's spatial order, so my AI executes my plan, not a guess.",
    410, 248, 128, solution.id,
  );
  card(
    "insight",
    "The board IS the spec",
    "No separate doc to keep in sync: positions, zones, and links carry the semantics. Editing the canvas edits the plan.",
    410, 392, 124, solution.id, "amber",
  );

  card(
    "note",
    "Non-goals (v1)",
    "No realtime collaboration, no mobile editing, no plugin API. Ship the single-player loop first.",
    750, 104, 112, scope.id,
  );
  const crud = card(
    "task",
    "MVP 1: canvas CRUD",
    "Cards, zones, links, undo. Every other slice builds on this one.",
    750, 232, 104, scope.id,
  );
  const compiler = card(
    "task",
    "MVP 2: deterministic compiler",
    "Same board in, same prompt out — byte for byte. Order comes from spatial reading order plus dependency edges.",
    750, 352, 120, scope.id,
  );
  const dumpImport = card(
    "task",
    "MVP 3: brain-dump import",
    "Paste text, get typed cards scattered on the canvas. One regex pass, no AI required.",
    750, 488, 112, scope.id,
  );

  const tenX = card(
    "question",
    "What breaks at 10x usage?",
    "2,000 cards on one board: does spatial banding still read sanely? Does undo history blow the storage budget?",
    1090, 104, 124, risks.id, "rose",
  );
  card(
    "note",
    "Risk: prompts outgrow context",
    "Big boards may compile past model limits. Mitigation: per-zone compile plus a token estimate in the UI.",
    1090, 244, 116, risks.id,
  );

  link(compiler, crud, "depends_on");
  link(dumpImport, crud, "depends_on");
  link(statement, storyDump, "input_to");
  link(storyDump, dumpImport, "input_to");
  link(tenX, compiler, "related_to");

  board.maxZ = z;
  return board;
}
