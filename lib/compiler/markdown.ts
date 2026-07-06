import { CARD_TYPE_META } from "../constants";
import type { Board, Card, ID } from "../types";
import type { OrderResult } from "./order";

const CONTEXT_TEXT = `Compiled from a spatial planning board. Sections are ordered by dependency
flow, then by board reading order. Within sections, prerequisite items come
first. Tags: <task> actionable work, <insight> a conclusion to build on,
<note> background context, <open_question> unresolved decision,
<resource> reference material.`;

function escapeAttr(s: string): string {
  return s.replace(/"/g, "'");
}

export function emitMarkdown(board: Board, order: OrderResult): string {
  // Short aliases c1, c2… assigned by execution order, stable document-wide.
  const alias = new Map<ID, string>();
  const aliasIdx = new Map<ID, number>();
  order.executionOrder.forEach((entry, i) => {
    alias.set(entry.card.id, `c${i + 1}`);
    aliasIdx.set(entry.card.id, i);
  });
  const aliasOf = (id: ID): string => alias.get(id) ?? id;
  const byAlias = (a: ID, b: ID): number =>
    (aliasIdx.get(a) ?? 0) - (aliasIdx.get(b) ?? 0);
  const titleOf = (id: ID): string => board.cards[id]?.title || "Untitled";

  const cardBlock = (card: Card): string => {
    const tag = CARD_TYPE_META[card.type].tag;
    const e = order.edges[card.id] ?? { dependsOn: [], inputs: [], relatedTo: [] };
    const deps = [...e.dependsOn].sort(byAlias).map(aliasOf);
    const inputs = [...e.inputs].sort(byAlias).map(aliasOf);

    let open = `<${tag} id="${aliasOf(card.id)}" title="${escapeAttr(card.title)}"`;
    if (deps.length > 0) open += ` depends_on="${deps.join(",")}"`;
    if (inputs.length > 0) open += ` inputs="${inputs.join(",")}"`;
    open += ">";

    const lines = [open];
    if (card.body.length > 0) lines.push(card.body);
    if (e.relatedTo.length > 0) {
      const refs = [...e.relatedTo]
        .sort(byAlias)
        .map((id) => `"${titleOf(id)}" (${aliasOf(id)})`)
        .join(", ");
      lines.push(`See also: ${refs}.`);
    }
    lines.push(`</${tag}>`);
    return lines.join("\n");
  };

  const blocks: string[] = [];
  const cardCount = Object.keys(board.cards).length;
  const linkCount = Object.keys(board.links).length;
  blocks.push(
    `<board name="${escapeAttr(board.name)}" cards="${cardCount}" sections="${order.sections.length}" links="${linkCount}">`,
  );
  blocks.push(`<context>\n${CONTEXT_TEXT}\n</context>`);

  if (order.warnings.length > 0) {
    const lines = order.warnings.map((w) => `- ${w.message}`).join("\n");
    blocks.push(`<warnings>\n${lines}\n</warnings>`);
  }

  order.sections.forEach((section, i) => {
    blocks.push(`## ${i + 1}. ${section.name}`);
    blocks.push(`<section name="${escapeAttr(section.name)}">`);
    for (const card of section.cards) blocks.push(cardBlock(card));
    blocks.push("</section>");
  });

  const directedLinks = Object.values(board.links)
    .filter(
      (l) => l.type !== "related_to" && board.cards[l.from] && board.cards[l.to],
    )
    .sort(
      (a, b) =>
        byAlias(a.from, b.from) ||
        byAlias(a.to, b.to) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  if (directedLinks.length > 0) {
    blocks.push("## Dependencies");
    const lines = directedLinks
      .map(
        (l) =>
          `- "${titleOf(l.from)}" (${aliasOf(l.from)}) ${l.type} "${titleOf(l.to)}" (${aliasOf(l.to)})`,
      )
      .join("\n");
    blocks.push(`<dependencies>\n${lines}\n</dependencies>`);
  }

  blocks.push("## Suggested execution order");
  const execLines = order.executionOrder.map(
    (entry, i) => `${i + 1}. ${entry.card.title || "Untitled"} (${entry.sectionName})`,
  );
  blocks.push(
    execLines.length > 0
      ? `<execution_order>\n${execLines.join("\n")}\n</execution_order>`
      : "<execution_order>\n</execution_order>",
  );

  const questionLines = order.sections.flatMap((section) =>
    section.cards
      .filter((c) => c.type === "question")
      .map((c) => `- ${c.title || "Untitled"} (${section.name})`),
  );
  if (questionLines.length > 0) {
    blocks.push(`<open_questions>\n${questionLines.join("\n")}\n</open_questions>`);
  }

  blocks.push("</board>");
  return blocks.join("\n\n") + "\n";
}
