import { CARD_W } from "@/lib/constants";
import { newBoard } from "@/lib/store/boardStore";
import type { Board, Card, CardColor, CardType } from "@/lib/types";

/**
 * Deliberately messy: no divisions, no links, topics interleaved so that
 * AI Organize has three obvious clusters to find (household, work, health).
 */
export function instantiate(): Board {
  const board = newBoard("Brain-dump triage");
  const now = board.createdAt;
  let z = 0;

  function card(
    type: CardType,
    title: string,
    body: string,
    x: number,
    y: number,
    h: number,
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
      divisionId: null,
      color,
      createdAt: now,
      updatedAt: now,
    };
    board.cards[c.id] = c;
    return c;
  }

  card(
    "task",
    "Renew car insurance",
    "Policy lapses on the 15th. Get two quotes before letting it auto-renew.",
    60, 80, 104,
  );
  card(
    "task",
    "Fix the leaking kitchen tap",
    "Washer kit is already in the garage. Twenty-minute job, avoided for a month.",
    620, 40, 104,
  );
  card(
    "note",
    "Q3 kickoff is a mess",
    "No agenda, no owner for the data migration, and design still hasn't seen the brief.",
    340, 190, 112,
  );
  card(
    "task",
    "Book dentist appointment",
    "Overdue by a year. Ask about the night guard while there.",
    900, 150, 104,
  );
  card(
    "insight",
    "Maybe migration ships first",
    "Everything in Q3 blocks on clean data. If that's true, the kickoff agenda writes itself.",
    80, 380, 112, "amber",
  );
  card(
    "task",
    "Email Priya the design brief",
    "She needs the user flows before Thursday or the sprint slips.",
    700, 330, 104,
  );
  card(
    "question",
    "Can we cut the reporting feature?",
    "Nobody mentioned it in the last five customer calls. Who owns this decision?",
    420, 480, 112,
  );
  card(
    "note",
    "Sleep has been terrible lately",
    "Averaging six hours. Probably late-night screens — try a 22:30 cutoff for two weeks.",
    950, 470, 112,
  );
  card(
    "task",
    "Buy groceries + prep Sunday lunches",
    "Plan five lunches. Cooking once beats deciding five times.",
    180, 620, 104,
  );
  card(
    "task",
    "Start morning runs again",
    "Twenty minutes, three days a week. Shoes by the door tonight.",
    640, 640, 104,
  );

  board.maxZ = z;
  return board;
}
