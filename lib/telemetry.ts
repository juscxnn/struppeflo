"use client";

/**
 * Structural telemetry — the dataset an acquirer (or we) can use to see what
 * good prompt structure looks like at scale. ON by default with a first-run
 * disclosure and a one-click opt-out (Help menu / privacy page): it is
 * content-free by construction, so default-on is defensible — and a dataset
 * that's off by default is no dataset at all.
 *
 * What gets sent (when the toggle is on):
 *
 *   - structure      — board shape (card counts, link counts, dependency depth)
 *   - structure_fp   — fingerprint of the board structure only (not the prompt)
 *   - edit           — add/edit/remove events on cards, links, divisions
 *   - run            — per-run provider, model, duration, rating, prompt fingerprint
 *   - run_quality    — what happened after the run (re-runs, edits, added-to-board)
 *   - session        — start/end and session duration in seconds
 *   - consent        — when the first-run disclosure was shown and the choice
 *   - first_run      — fired once per user on their first successful run
 *
 * What NEVER gets sent at any tier: card titles, card bodies, prompt text,
 * AI output text, or API keys. The server route's zod schema forbids it.
 */

import type { Board, CardType, Division, LinkType, Persona } from "./types";

const STORAGE_KEY = "struppeflo-telemetry-opt-in";
const USER_ID_KEY = "struppeflo-anon-user";

let cachedEnabled: boolean | null = null;
let cachedUserId: string | null = null;
const listeners = new Set<() => void>();

function loadEnabled(): boolean {
  if (cachedEnabled !== null) return cachedEnabled;
  try {
    // Default ON; only an explicit "0" (user opted out) disables.
    cachedEnabled = localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    cachedEnabled = false;
  }
  return cachedEnabled;
}

function persistEnabled(value: boolean): void {
  cachedEnabled = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Session-only when storage is unavailable.
  }
  listeners.forEach((l) => l());
}

/**
 * Anonymous, opaque per-browser user id. Used to compute repeat-session
 * metrics without identifying the user. Stored in localStorage; resets when
 * the user clears site data.
 */
export function getAnonUserId(): string {
  if (cachedUserId) return cachedUserId;
  try {
    const existing = localStorage.getItem(USER_ID_KEY);
    if (existing && /^[a-f0-9]{16,32}$/.test(existing)) {
      cachedUserId = existing;
      return existing;
    }
    const fresh = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    localStorage.setItem(USER_ID_KEY, fresh);
    cachedUserId = fresh;
    return fresh;
  } catch {
    cachedUserId = "anon";
    return cachedUserId;
  }
}

export function telemetryEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return loadEnabled();
}

export function setTelemetryEnabled(value: boolean): void {
  persistEnabled(value);
}

export function subscribeTelemetry(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/* ---------- payload types ---------- */

export type CardTypeName = CardType;
export type LinkTypeName = LinkType;

export type EditAction =
  | "card_added"
  | "card_edited"
  | "card_deleted"
  | "link_added"
  | "link_removed"
  | "division_added"
  | "division_resized"
  | "division_removed"
  | "board_created"
  | "board_opened"
  | "template_used"
  | "organize"
  | "suggest_links"
  | "workflow_generated";

export interface CardTypeHistogram {
  note?: number;
  task?: number;
  question?: number;
  insight?: number;
  resource?: number;
}

export interface LinkTypeHistogram {
  related_to?: number;
  depends_on?: number;
  input_to?: number;
}

export interface BoardStructurePayload {
  cards: number;
  divisions: number;
  links: number;
  cardTypes: CardTypeHistogram;
  linkTypes: LinkTypeHistogram;
  maxDependencyDepth: number;
  /** sha256 hex of the structural shape only (cards+links+positions, no text). */
  structureFingerprint: string;
  /**
   * Which template the board was seeded from. Undefined for blank boards.
   * Lives on the board's UI-store mapping, not on the board itself.
   */
  templateId?: string;
  /**
   * Persona derived from the template (e.g. "founder", "pm"). Free-form
   * string so we can resolve it without coupling the telemetry layer to
   * the template registry.
   */
  persona?: string;
  /**
   * Per-division (zone) histograms. Tracks the kind of content the user is
   * dropping in each zone, which lets us answer "what gets put in the
   * Acceptance Criteria zone?" in aggregate.
   */
  zoneHistogram?: Record<string, { cards: number; cardTypes: CardTypeHistogram }>;
  /**
   * Distribution of link types. Useful for "are people using dependency
   * links or are they all related_to?".
   */
  linkRatio?: { dependsOn: number; inputTo: number; relatedTo: number };
}

export interface EditPayload {
  action: EditAction;
  /** Counts before the edit (so the server can compute deltas). */
  cardsBefore: number;
  divisionsBefore: number;
  linksBefore: number;
  /** Time since the previous edit, in milliseconds. */
  msSincePrevEdit: number;
  /** Optional card-type of the affected card. */
  cardType?: CardTypeName;
  /** Optional link-type of the affected link. */
  linkType?: LinkTypeName;
}

export interface RunOutcomePayload {
  provider: string;
  model: string;
  promptFingerprint: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  status: "ok" | "error" | "aborted";
  rating?: 1 | -1;
  cards: number;
  /** Number of edits before this run started. Captures "did the user struggle?" */
  editsBeforeRun: number;
}

export interface RunQualityPayload {
  promptFingerprint: string;
  /** Whether the user re-ran the same prompt. */
  reRun: boolean;
  /** Whether the user edited the board within 5 minutes after the run. */
  editedAfter: boolean;
  /** Whether the user clicked "Add result to board". */
  addedToBoard: boolean;
  /** Whether the user clicked "Split into cards". */
  splitIntoCards: boolean;
}

export interface SessionPayload {
  kind: "session_start" | "session_end";
  /** Set on session_end. */
  durationMs?: number;
  /** Total edits in the session. */
  edits?: number;
  /** Total runs started. */
  runs?: number;
  /** Total thumbs-up/down. */
  ratings?: { up: number; down: number };
  /** Final board stats when the session ended. */
  finalStructure?: BoardStructurePayload;
}

export interface ConsentPayload {
  shown: boolean;
  optedIn: boolean;
}

export interface FirstRunPayload {
  /** Provider used on the user's first successful run. */
  provider: string;
  /** Model used on the user's first successful run. */
  model: string;
  /** Prompt fingerprint of the first successful run. */
  promptFingerprint: string;
  /** Duration of the first successful run, in milliseconds. */
  durationMs: number;
  /** How many cards were on the board when the first run completed. */
  cards: number;
}

export type TelemetryEventKind =
  | "structure"
  | "edit"
  | "run"
  | "run_quality"
  | "session"
  | "consent"
  | "first_run";

export interface TelemetryEvent {
  kind: TelemetryEventKind;
  at: string; // ISO timestamp
  userId: string;
  structure?: BoardStructurePayload;
  edit?: EditPayload;
  run?: RunOutcomePayload;
  runQuality?: RunQualityPayload;
  session?: SessionPayload;
  consent?: ConsentPayload;
  firstRun?: FirstRunPayload;
}

/* ---------- send ---------- */

export async function sendTelemetry(
  payload: Omit<TelemetryEvent, "at" | "userId">,
): Promise<void> {
  if (!telemetryEnabled()) return;
  const event: TelemetryEvent = {
    ...payload,
    at: new Date().toISOString(),
    userId: getAnonUserId(),
  };
  try {
    await fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    });
  } catch {
    // Telemetry must never break the product.
  }
}

/* ---------- helpers used by callers ---------- */

export async function buildRunOutcomePayload(args: {
  board: Board;
  provider: string;
  model: string;
  prompt: string;
  outputTokens: number;
  durationMs: number;
  status: RunOutcomePayload["status"];
  rating?: 1 | -1;
  editsBeforeRun?: number;
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
    ...(args.rating !== undefined ? { rating: args.rating } : {}),
    cards: Object.keys(args.board.cards).length,
    editsBeforeRun: args.editsBeforeRun ?? 0,
  };
}

/**
 * Structural fingerprint (NOT the markdown hash). Hashes the sorted
 * (id, type, divisionId) of each card and the sorted (from, to, type) of each
 * link. Two boards with the same shape but different text collide here; that's
 * the point — it lets us cluster boards by structure in the dataset.
 */
export async function structureFingerprint(board: Board): Promise<string> {
  const cards = Object.values(board.cards)
    .map((c) => `${c.id}|${c.type}|${c.divisionId ?? ""}`)
    .sort()
    .join(",");
  const links = Object.values(board.links)
    .map((l) => `${l.from}|${l.type}|${l.to}`)
    .sort()
    .join(",");
  const text = `cards:${cards};links:${links}`;
  return sha256Hex(text);
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function computeBoardStructure(
  board: Board,
  fingerprint?: string,
): Omit<BoardStructurePayload, "structureFingerprint" | "templateId" | "persona" | "zoneHistogram"> & {
  structureFingerprint: string;
  linkRatio: { dependsOn: number; inputTo: number; relatedTo: number };
} {
  const cardTypes: CardTypeHistogram = {};
  const linkTypes: LinkTypeHistogram = {};
  for (const c of Object.values(board.cards)) {
    cardTypes[c.type] = (cardTypes[c.type] ?? 0) + 1;
  }
  for (const l of Object.values(board.links)) {
    if (l.type === "related_to" || l.type === "depends_on" || l.type === "input_to") {
      linkTypes[l.type] = (linkTypes[l.type] ?? 0) + 1;
    }
  }
  const depth = dependencyDepth(board);
  const linkRatio = {
    dependsOn: linkTypes.depends_on ?? 0,
    inputTo: linkTypes.input_to ?? 0,
    relatedTo: linkTypes.related_to ?? 0,
  };
  return {
    cards: Object.keys(board.cards).length,
    divisions: Object.keys(board.divisions).length,
    links: Object.keys(board.links).length,
    cardTypes,
    linkTypes,
    maxDependencyDepth: depth,
    structureFingerprint: fingerprint ?? "",
    linkRatio,
  };
}

/**
 * Build a full BoardStructurePayload from a Board, including the per-zone
 * histogram and the optional template / persona context. Use this from
 * RunPanel right before a run is dispatched so the structure telemetry is
 * self-describing (no client-side stitching required to know which template
 * the user was working from).
 */
export async function buildBoardStructure(
  board: Board,
  templateId?: string | null,
  persona?: Persona | string | null,
): Promise<BoardStructurePayload> {
  const fp = await structureFingerprint(board);
  const base = computeBoardStructure(board, fp);

  // Per-division histogram. The structural shape of a template (which zones
  // exist) is a strong signal of "what is this board for" — we count
  // membership, not pixel position.
  const zoneHistogram: Record<string, { cards: number; cardTypes: CardTypeHistogram }> = {};
  const divisions = Object.values(board.divisions) as Division[];
  // Initialize each zone with an empty histogram so it shows up as 0/0 even
  // when the user hasn't dropped anything in it yet — better than missing keys
  // in the SQL.
  for (const d of divisions) {
    zoneHistogram[d.name] = { cards: 0, cardTypes: {} };
  }
  for (const c of Object.values(board.cards)) {
    const divId = c.divisionId;
    if (!divId) continue;
    const div = board.divisions[divId];
    if (!div) continue;
    if (!zoneHistogram[div.name]) {
      zoneHistogram[div.name] = { cards: 0, cardTypes: {} };
    }
    zoneHistogram[div.name].cards += 1;
    zoneHistogram[div.name].cardTypes[c.type] =
      (zoneHistogram[div.name].cardTypes[c.type] ?? 0) + 1;
  }

  return {
    ...base,
    ...(templateId ? { templateId } : {}),
    ...(persona ? { persona } : {}),
    zoneHistogram,
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
  const visiting = new Set<string>();
  const visit = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    // Dependency cycles are legal on the board — treat a back-edge as depth 0
    // instead of recursing forever.
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const parents = edges.get(id) ?? [];
    const d = parents.length === 0 ? 0 : 1 + Math.max(...parents.map(visit));
    visiting.delete(id);
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
