import type { Board, ID, Persona, SparkQuestion } from "@/lib/types";

const TEMPLATE_LIBRARY: Record<string, readonly string[]> = {
  gtm: [
    "What's your pricing model, and what would make it a no-brainer?",
    "Which single channel will you saturate before adding a second?",
    "What's the most common objection, and what's your one-line answer?",
    "What does the first 'aha' moment look like for a new customer?",
    "Who loses budget or status if your product wins?",
    "What proof — case study, metric, demo — closes the deal fastest?",
    "What's the cost of doing nothing for your buyer?",
    "Which existing tool or habit are you replacing?",
    "What would make a happy customer tell a colleague this week?",
    "If you could only keep one acquisition experiment, which one?",
  ],
  research: [
    "What evidence would change your mind about the core hypothesis?",
    "What's your sampling method, and who does it silently exclude?",
    "Which prior work comes closest, and where exactly does it stop?",
    "What's the simplest experiment that could falsify this?",
    "Are you measuring the thing, or a proxy for the thing?",
    "What result would be interesting even if the hypothesis fails?",
    "Who disagrees with your framing, and what do they see?",
    "What confound worries you most, and how will you control for it?",
    "How will you know the effect size matters in practice?",
    "What data do you wish existed, and can you approximate it?",
  ],
  "product-spec": [
    "What is explicitly out of scope for v1?",
    "What's the failure mode users will hit first, and what happens then?",
    "Which metric tells you this feature actually worked?",
    "What's the smallest version that still tests the core assumption?",
    "What happens at the empty state, before there's any data?",
    "Which edge case will generate the most support tickets?",
    "What existing behavior does this change or break?",
    "Who has to sign off, and what will they push back on?",
    "How does this degrade under 10x the expected load or content?",
    "What would make you kill this feature after launch?",
  ],
  "content-pipeline": [
    "Where does each piece get distributed, and who owns that step?",
    "Which format can this be repurposed into with the least effort?",
    "What's the one metric that tells you a piece worked?",
    "What evergreen piece keeps paying off, and can you refresh it?",
    "Which stage of the pipeline is the actual bottleneck?",
    "Who is the one reader this piece is written for?",
    "What's your call to action, and is it the same everywhere?",
    "Which pieces can be batched and produced in one sitting?",
    "What content do customers ask for that you haven't made?",
    "How long after publishing do you keep promoting, and is that enough?",
  ],
  triage: [
    "Which task, done today, makes the rest easier or unnecessary?",
    "What's the hard deadline here, and what's merely aspirational?",
    "Which of these could someone else do 80% as well?",
    "What are you avoiding because it's uncomfortable, not unimportant?",
    "Which task matches your energy right now?",
    "What can be deleted outright instead of deferred?",
    "What's the two-minute version of the biggest task?",
    "Which item has been carried over the longest, and why?",
    "What breaks if nothing on this board happens this week?",
    "Which task is actually three tasks wearing a coat?",
  ],
};

const PERSONA_LIBRARY: Record<Persona, readonly string[]> = {
  founder: [
    "What's your runway in months, and what changes if it halves?",
    "Which customer conversation surprised you most recently?",
    "What are you doing that doesn't scale, on purpose?",
    "If you could only ship one thing this month, what and why?",
    "What would your sharpest competitor do with this board?",
    "Which assumption, if wrong, kills the company?",
  ],
  researcher: [
    "What does the null-result version of this project look like?",
    "Which citation are you leaning on without having reread it?",
    "What would a skeptical reviewer attack first?",
    "Is there a dataset that settles this faster than an experiment?",
    "What's the one figure that tells the whole story?",
    "Whose feedback would improve this most before you go further?",
  ],
  pm: [
    "What user problem does this solve, in the user's own words?",
    "What's the cost of delay if this slips a quarter?",
    "Which stakeholder hasn't weighed in yet but will?",
    "How does this ladder up to the current company goal?",
    "What's the riskiest assumption you can test this sprint?",
    "What will you say no to in order to say yes to this?",
  ],
  student: [
    "What's the deadline, and what's the minimum that earns full credit?",
    "Which topic do you understand least — and should tackle first?",
    "Can you explain the core idea out loud without notes?",
    "What would the exam-question version of this look like?",
    "Which resource is highest-yield for the time you have left?",
    "Who can you compare notes with before the deadline?",
  ],
  generalist: [
    "What does 'done' look like for this project?",
    "Which item here has the highest cost of getting wrong?",
    "What information are you missing to make the next decision?",
    "If you dropped half of this, which half keeps the value?",
    "What's the next physical action for the most important item?",
    "Who else cares about the outcome, and have you told them?",
  ],
};

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function slugOf(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateSparks(
  board: Board,
  persona: Persona | null,
  templateId: string | null,
): SparkQuestion[] {
  const cards = Object.values(board.cards).sort((a, b) => cmpStr(a.id, b.id));
  const divisions = Object.values(board.divisions).sort((a, b) => cmpStr(a.id, b.id));
  const out: SparkQuestion[] = [];
  const add = (
    question: string,
    answerType: SparkQuestion["answerType"],
    divisionId: ID | null,
  ): void => {
    out.push({ id: slugOf(question), question, answerType, divisionId });
  };

  // Gap detectors, priority order, at most one question each.
  if (cards.length < 3) {
    add("What's the outcome you're actually after?", "insight", null);
  }

  if (
    (templateId === "gtm" || templateId === "product-spec") &&
    !divisions.some((d) => /audience|customer|user|icp/i.test(d.name))
  ) {
    add("Who exactly is the first customer?", "insight", null);
  }

  const directedIds = new Set<ID>();
  for (const link of Object.values(board.links)) {
    if (link.type === "related_to") continue;
    directedIds.add(link.from);
    directedIds.add(link.to);
  }
  const lonelyTask = cards.find((c) => c.type === "task" && !directedIds.has(c.id));
  if (lonelyTask) {
    add(
      `What must happen before "${lonelyTask.title || "Untitled"}"?`,
      "task",
      lonelyTask.divisionId,
    );
  }

  const memberCount = new Map<ID, number>();
  for (const c of cards) {
    if (c.divisionId !== null) {
      memberCount.set(c.divisionId, (memberCount.get(c.divisionId) ?? 0) + 1);
    }
  }
  const singleton = divisions.find((d) => memberCount.get(d.id) === 1);
  if (singleton) {
    add(`What else belongs in "${singleton.name}"?`, "note", singleton.id);
  }

  if (cards.filter((c) => c.type === "question").length > 3) {
    add("Which open question blocks the most work?", "insight", null);
  }

  // Fill remaining slots from the static library, rotated deterministically.
  if (out.length < 3) {
    const library = [
      ...(templateId !== null ? TEMPLATE_LIBRARY[templateId] ?? [] : []),
      ...(persona !== null ? PERSONA_LIBRARY[persona] : []),
    ];
    if (library.length > 0) {
      const titles = new Set(cards.map((c) => c.title));
      const chosen = new Set(out.map((q) => q.question));
      let hash = 0;
      for (let i = 0; i < board.id.length; i++) {
        hash = (hash + board.id.charCodeAt(i)) % 1_000_003;
      }
      const start = (hash + cards.length) % library.length;
      for (let k = 0; k < library.length && out.length < 3; k++) {
        const question = library[(start + k) % library.length];
        if (titles.has(question) || chosen.has(question)) continue;
        chosen.add(question);
        add(question, "note", null);
      }
    }
  }

  return out.slice(0, 3);
}
