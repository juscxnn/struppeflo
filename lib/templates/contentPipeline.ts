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
  const board = newBoard("Content pipeline");
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

  const ideas = division("Ideas", 40, 40, 300, 480);
  const drafting = division("Drafting", 380, 40, 300, 480);
  const distribution = division("Distribution", 720, 40, 300, 480);

  const graphIdea = card(
    "insight",
    "Idea: your notes are a graph",
    "Most tools hide structure; a canvas makes it visible. Contrarian hook for the flagship long-form post.",
    70, 104, 116, ideas.id, "amber",
  );
  card(
    "insight",
    "Idea: monthly board teardown",
    "Dissect one real board in public — what AI Organize nailed, where it flopped. Honesty is the hook.",
    70, 236, 116, ideas.id,
  );
  const leadQ = card(
    "question",
    "Which idea leads the month?",
    "One becomes the flagship post, the other a thread. Deciding late stalls the whole pipeline.",
    70, 368, 116, ideas.id,
  );

  const outline = card(
    "task",
    "Write the flagship outline",
    "Hook, three sections, one screenshot each. Timebox: 45 minutes.",
    410, 104, 104, drafting.id,
  );
  const draft = card(
    "task",
    "Draft v1 — write ugly",
    "1,200 words max. The outline is the contract; polish is a later pass.",
    410, 224, 104, drafting.id,
  );
  const edit = card(
    "task",
    "Edit pass + pull quotes",
    "Cut 20%, bold one line per section, extract three quotable sentences for social.",
    410, 344, 112, drafting.id,
  );

  const publish = card(
    "task",
    "Publish blog + newsletter",
    "Same day. Newsletter intro is two personal sentences that link out.",
    750, 104, 104, distribution.id,
  );
  const thread = card(
    "task",
    "Thread the quotes on X",
    "Three posts over three days, one image each. Full link in replies only.",
    750, 224, 104, distribution.id,
  );

  link(draft, outline, "depends_on");
  link(edit, draft, "depends_on");
  link(edit, publish, "input_to");
  link(thread, publish, "depends_on");
  link(leadQ, graphIdea, "related_to");

  board.maxZ = z;
  return board;
}
