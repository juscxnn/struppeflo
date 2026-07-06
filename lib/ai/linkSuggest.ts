import type { Board, Card, ID, LinkSuggestion, LinkType } from "@/lib/types";
import { buildVectors, cosine, rareTerms, tokenize } from "./text";

const MIN_SCORE = 0.35;
const MAX_SUGGESTIONS = 7;
const RARE_TERM_WEIGHT = 0.15;
const DEPENDENCY_CUE = /(after|once|then|requires|needs|blocked by)/i;

function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function pairKey(a: ID, b: ID): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** First raw word that produced each stem, for human-readable reasons. */
function displayWords(texts: readonly string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const text of texts) {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!cleaned) continue;
    for (const word of cleaned.split(/\s+/)) {
      const [term] = tokenize(word);
      if (term && !map.has(term)) map.set(term, word);
    }
  }
  return map;
}

interface Candidate {
  a: Card;
  b: Card;
  key: string;
  score: number;
  sharedRare: string[];
}

export function suggestLinks(board: Board): LinkSuggestion[] {
  const cards = Object.values(board.cards).sort((p, q) => cmpStr(p.id, q.id));
  if (cards.length < 2) return [];

  const docs = cards.map((c) => ({
    id: c.id,
    text: `${c.title} ${c.title} ${c.body}`,
  }));
  const vectors = buildVectors(docs);
  const rare = rareTerms(docs, 2);
  const display = displayWords(docs.map((d) => d.text));

  const linked = new Set<string>();
  for (const link of Object.values(board.links)) {
    linked.add(pairKey(link.from, link.to));
  }

  const candidates: Candidate[] = [];
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i];
      const b = cards[j];
      const key = pairKey(a.id, b.id);
      if (linked.has(key)) continue;
      const va = vectors.get(a.id) as Map<string, number>;
      const vb = vectors.get(b.id) as Map<string, number>;
      const sharedRare: string[] = [];
      for (const term of va.keys()) {
        if (rare.has(term) && vb.has(term)) sharedRare.push(term);
      }
      const score = cosine(va, vb) + RARE_TERM_WEIGHT * sharedRare.length;
      if (score < MIN_SCORE) continue;
      candidates.push({ a, b, key, score, sharedRare });
    }
  }

  candidates.sort((p, q) => q.score - p.score || cmpStr(p.key, q.key));

  return candidates.slice(0, MAX_SUGGESTIONS).map((c) => {
    const { from, to, type } = classify(c);
    return {
      from: from.id,
      to: to.id,
      type,
      score: c.score,
      reason: reasonFor(c, vectors, display),
    };
  });
}

/** First matching rule wins; within a rule the lower card id is tried first. */
function classify(c: Candidate): { from: Card; to: Card; type: LinkType } {
  const { a, b } = c;
  // (a) resource feeds task.
  if (a.type === "resource" && b.type === "task") return { from: a, to: b, type: "input_to" };
  if (b.type === "resource" && a.type === "task") return { from: b, to: a, type: "input_to" };
  // (b) sequencing language + shared distinctive vocabulary → dependency.
  if (c.sharedRare.length >= 1) {
    if (DEPENDENCY_CUE.test(`${a.title} ${a.body}`)) return { from: a, to: b, type: "depends_on" };
    if (DEPENDENCY_CUE.test(`${b.title} ${b.body}`)) return { from: b, to: a, type: "depends_on" };
  }
  // (c) question ↔ insight, (d) default: undirected cross-reference.
  return { from: a, to: b, type: "related_to" };
}

function reasonFor(
  c: Candidate,
  vectors: Map<string, Map<string, number>>,
  display: Map<string, string>,
): string {
  const va = vectors.get(c.a.id) as Map<string, number>;
  const vb = vectors.get(c.b.id) as Map<string, number>;
  const shared: Array<{ term: string; weight: number }> = [];
  for (const [term, w] of va) {
    const w2 = vb.get(term);
    if (w2 !== undefined) shared.push({ term, weight: w + w2 });
  }
  shared.sort((p, q) => q.weight - p.weight || cmpStr(p.term, q.term));
  const words = shared.slice(0, 2).map((s) => display.get(s.term) ?? s.term);
  if (words.length === 0) return "These cards look closely related";
  if (words.length === 1) return `Both mention "${words[0]}"`;
  return `Both mention "${words[0]}" and "${words[1]}"`;
}
