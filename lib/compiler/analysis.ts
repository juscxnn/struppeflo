import type { Board, CompileResult, ID } from "../types";

export interface SectionTokens {
  name: string;
  /** Heading + opening tag + cards. Matches what's in the markdown. */
  text: string;
  tokens: number;
}

export interface PromptAnalysis {
  totalTokens: number;
  sections: SectionTokens[];
  /** Boards have sections ordered by dependency. */
  firstSection: { name: string; text: string } | null;
  lastSection: { name: string; text: string } | null;
}

const TOKENS_PER_CHAR = 0.25; // 1 token ≈ 4 chars; matches compile.ts estimateTokens.

function splitSections(markdown: string): SectionTokens[] {
  const out: SectionTokens[] = [];
  const lines = markdown.split("\n");
  let current: { name: string; lines: string[] } | null = null;
  for (const line of lines) {
    const heading = line.match(/^##\s+(?:\d+\.\s+)?(.+)$/);
    if (heading) {
      if (current) {
        const text = current.lines.join("\n");
        out.push({
          name: current.name,
          text,
          tokens: Math.ceil(text.length * TOKENS_PER_CHAR),
        });
      }
      current = { name: heading[1].trim(), lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) {
    const text = current.lines.join("\n");
    out.push({
      name: current.name,
      text,
      tokens: Math.ceil(text.length * TOKENS_PER_CHAR),
    });
  }
  return out;
}

export function analyzePrompt(result: CompileResult): PromptAnalysis {
  const sections = splitSections(result.markdown);
  const totalTokens = sections.reduce((acc, s) => acc + s.tokens, 0);
  return {
    totalTokens,
    sections,
    firstSection: sections[0]
      ? { name: sections[0].name, text: sections[0].text }
      : null,
    lastSection:
      sections.length > 0
        ? {
            name: sections[sections.length - 1].name,
            text: sections[sections.length - 1].text,
          }
        : null,
  };
}

export interface LintIssue {
  kind:
    | "empty_body"
    | "deep_dependency"
    | "section_without_task"
    | "untitled_card"
    | "missing_type";
  message: string;
  cardIds: ID[];
}

/**
 * Static lint of the compiled structure. Returns issues with the card IDs they
 * reference, so the X-Ray can render clickable chips.
 */
export function lintBoard(board: Board): LintIssue[] {
  const issues: LintIssue[] = [];
  const cards = Object.values(board.cards);

  // Empty body on a task or insight card → not useful.
  const empty = cards.filter(
    (c) => (c.type === "task" || c.type === "insight") && c.body.length === 0,
  );
  if (empty.length > 0) {
    issues.push({
      kind: "empty_body",
      message: `${empty.length} task/insight card${empty.length === 1 ? "" : "s"} ${empty.length === 1 ? "has" : "have"} no body — the model will guess what you meant.`,
      cardIds: empty.map((c) => c.id),
    });
  }

  // Untitled cards (none yet — titles default to "" which compiles as "Untitled").
  const untitled = cards.filter((c) => c.title.trim().length === 0);
  if (untitled.length > 0) {
    issues.push({
      kind: "untitled_card",
      message: `${untitled.length} card${untitled.length === 1 ? "" : "s"} ${untitled.length === 1 ? "is" : "are"} untitled.`,
      cardIds: untitled.map((c) => c.id),
    });
  }

  // Section without any task card.
  for (const div of Object.values(board.divisions)) {
    const memberIds = Object.values(board.cards).filter(
      (c) => c.divisionId === div.id,
    );
    const hasTask = memberIds.some((c) => c.type === "task");
    if (memberIds.length > 0 && !hasTask) {
      issues.push({
        kind: "section_without_task",
        message: `Zone "${div.name}" has no task cards — it's all context.`,
        cardIds: memberIds.map((c) => c.id),
      });
    }
  }

  // Deep dependency chains.
  const depth = new Map<ID, number>();
  const edges = new Map<ID, ID[]>();
  for (const l of Object.values(board.links)) {
    if (l.type !== "depends_on") continue;
    if (!board.cards[l.from] || !board.cards[l.to]) continue;
    if (!edges.has(l.to)) edges.set(l.to, []);
    edges.get(l.to)!.push(l.from);
  }
  const visit = (id: ID): number => {
    if (depth.has(id)) return depth.get(id)!;
    const parents = edges.get(id) ?? [];
    const d = parents.length === 0 ? 0 : 1 + Math.max(...parents.map(visit));
    depth.set(id, d);
    return d;
  };
  for (const c of cards) visit(c.id);
  const deep = [...depth.entries()]
    .filter(([, d]) => d >= 4)
    .map(([id]) => id);
  if (deep.length > 0) {
    issues.push({
      kind: "deep_dependency",
      message: `${deep.length} card${deep.length === 1 ? "" : "s"} sit${deep.length === 1 ? "s" : ""} on a dependency chain of 4 or more — long chains often lose coherence.`,
      cardIds: deep,
    });
  }

  return issues;
}

export function estimateCost(
  result: CompileResult,
  pricePerMTokInput: number,
): number {
  // Output tokens depend on the model response; we only have input tokens here.
  return (result.markdown.length / 4 / 1_000_000) * pricePerMTokInput;
}