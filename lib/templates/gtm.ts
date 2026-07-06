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
  const board = newBoard("Go-to-market plan");
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

  // Four columns, left→right = time order. Cards sit at division.x + 30.
  const research = division("Research", 40, 40, 300, 500);
  const positioning = division("Positioning", 380, 40, 300, 500);
  const channels = division("Channels", 720, 40, 300, 500);
  const launch = division("Launch", 1060, 40, 300, 500);

  const icp = card(
    "note",
    "Ideal customer profile",
    "Seed-stage B2B founders, 2–20 person teams, already paying for 3+ tools. They plan alone, in bursts, usually the night before something ships.",
    70, 104, 124, research.id,
  );
  card(
    "resource",
    "Competitor teardown: Linear's launch",
    "https://linear.app/method — they seeded a waitlist with a strong opinion, not a feature list. Steal the shape, not the words.",
    70, 244, 124, research.id,
  );
  const segmentQ = card(
    "question",
    "Which segment do we win first?",
    "Agencies buy fast but churn fast; startups are loyal but slow to decide. Pick one lane for the first 90 days.",
    70, 384, 116, research.id,
  );

  const valueProp = card(
    "insight",
    "Value prop: minutes to clarity",
    "We don't sell features — we sell the moment a messy board becomes a plan. Every asset should show that transformation.",
    410, 104, 124, positioning.id, "amber",
  );
  const statement = card(
    "note",
    "Positioning statement (draft)",
    "For founders drowning in scattered notes, Struppëflo is the thinking canvas that compiles itself into an actionable brief.",
    410, 244, 124, positioning.id,
  );
  const landingCopy = card(
    "task",
    "Write landing page copy",
    "One headline, three benefit bullets, one CTA. Lead with the pilot case study; end on the value-prop line.",
    410, 384, 116, positioning.id,
  );

  const newsletter = card(
    "task",
    "Launch the founder newsletter",
    "Weekly, 300 words, one board template per issue. Target: 500 subscribers before launch week.",
    750, 104, 116, channels.id,
  );
  card(
    "task",
    "Post 3 before/after threads",
    "Screenshot a real messy board, run AI Organize, show the result. One thread per week on X and LinkedIn.",
    750, 236, 116, channels.id,
  );
  const caseStudy = card(
    "resource",
    "Pilot case study: Beacon & Co",
    "Interview notes from the agency pilot — kickoffs went from 3 days to 1. Directly feeds the landing page copy.",
    750, 368, 116, channels.id, "teal",
  );

  card(
    "task",
    "Set launch date + freeze scope",
    "Pick a Tuesday six weeks out. Nothing new ships in the final fortnight except fixes.",
    1090, 104, 112, launch.id,
  );
  const phChecklist = card(
    "task",
    "Product Hunt checklist",
    "Hunter confirmed, first comment drafted, 10 supporters briefed, gallery images exported at 2x.",
    1090, 232, 116, launch.id,
  );
  card(
    "question",
    "What does week-one success mean?",
    "Agree one activation number now so the retro isn't vibes. Proposal: 200 boards created by day 7.",
    1090, 364, 116, launch.id,
  );

  // from NEEDS to: each stage depends on the one to its left.
  link(statement, icp, "depends_on");
  link(newsletter, valueProp, "depends_on");
  link(phChecklist, newsletter, "depends_on");
  link(caseStudy, landingCopy, "input_to");
  link(segmentQ, icp, "related_to");

  board.maxZ = z;
  return board;
}
