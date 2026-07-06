import type { Board, LinkType } from "./types";
import {
  type BoardStructurePayload,
  type RunOutcomePayload,
} from "./telemetry";

const CARD_TYPES = [
  "note",
  "task",
  "question",
  "insight",
  "resource",
] as const;
const LINK_TYPES = ["related_to", "depends_on", "input_to"] as const;

function increment<K extends string>(
  map: Partial<Record<K, number>>,
  key: K,
): void {
  map[key] = (map[key] ?? 0) + 1;
}

export function computeBoardStructure(board: Board): BoardStructurePayload {
  const cardTypes: BoardStructurePayload["cardTypes"] = {};
  const linkTypes: BoardStructurePayload["linkTypes"] = {};
  for (const c of Object.values(board.cards)) {
    increment(cardTypes, c.type as (typeof CARD_TYPES)[number]);
  }
  for (const l of Object.values(board.links)) {
    if (LINK_TYPES.includes(l.type as LinkType)) {
      increment(linkTypes, l.type as (typeof LINK_TYPES)[number]);
    }
  }
  const depth = dependencyDepth(board);
  return {
    cards: Object.keys(board.cards).length,
    divisions: Object.keys(board.divisions).length,
    links: Object.keys(board.links).length,
    cardTypes,
    linkTypes,
    maxDependencyDepth: depth,
  };
}

function dependencyDepth(board: Board): number {
  const edges = new Map<string, string[]>();
  for (const l of Object.values(board.links)) {
    if (l.type !== "depends_on") continue;
    if (!board.cards[l.from] || !board.cards[l.to]) continue;
    if (!edges.has(l.to)) edges.set(l.to, []);
    edges.get(l.to)!.push(l.from);
  }
  const memo = new Map<string, number>();
  const visit = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    const parents = edges.get(id) ?? [];
    const d = parents.length === 0 ? 0 : 1 + Math.max(...parents.map(visit));
    memo.set(id, d);
    return d;
  };
  let max = 0;
  for (const id of Object.keys(board.cards)) {
    const d = visit(id);
    if (d > max) max = d;
  }
  return max;
}

/**
 * SHA-256 hex of `s` via the browser's Web Crypto API. Throws in non-browser
 * environments; callers should gate on `typeof window`.
 */
export async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildRunOutcomePayload(args: {
  board: Board;
  provider: string;
  model: string;
  prompt: string;
  outputTokens: number;
  durationMs: number;
  status: RunOutcomePayload["status"];
  rating?: 1 | -1;
}): Promise<RunOutcomePayload> {
  const promptFingerprint = await sha256Hex(args.prompt);
  return {
    provider: args.provider,
    model: args.model,
    promptFingerprint,
    inputTokens: Math.ceil(args.prompt.length / 4),
    outputTokens: args.outputTokens,
    durationMs: args.durationMs,
    status: args.status,
    rating: args.rating,
    cards: Object.keys(args.board.cards).length,
  };
}