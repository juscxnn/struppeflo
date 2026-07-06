import { z } from "zod";
import {
  CARD_DEFAULT_H,
  CARD_W,
  DIVISION_MIN_H,
  DIVISION_MIN_W,
  MAX_BOARDS,
  MAX_BODY,
  MAX_CARDS_PER_BOARD,
  MAX_COORD,
  MAX_DIVISIONS_PER_BOARD,
  MAX_LINKS_PER_BOARD,
  MAX_NAME,
  MAX_SIZE,
  MAX_TITLE,
} from "./constants";
import { clamp } from "./geometry";
import {
  CARD_COLORS,
  CARD_TYPES,
  LINK_TYPES,
  type Board,
  type Card,
  type Division,
  type ID,
  type Link,
  type Workspace,
} from "./types";

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

/* -------------------------------- Export --------------------------------- */

export function exportWorkspace(ws: Workspace): void {
  const payload = {
    version: ws.version,
    boards: ws.boards,
    boardOrder: ws.boardOrder,
    activeBoardId: ws.activeBoardId,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `struppeflo-${localDateStamp()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function localDateStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* ----------------------------- Import schemas ---------------------------- */

// Transforms (not refinements) throughout: hostile values clamp instead of
// rejecting; `.catch` absorbs wrong-typed scalars so one bad field never
// discards an otherwise-usable entity. Enum fields have no catch — an invalid
// enum drops that single entity via per-entity safeParse.

const cappedString = (max: number) =>
  z
    .string()
    .catch("")
    .transform((s) => s.slice(0, max));

const coordNum = z
  .number()
  .catch(0)
  .transform((n) => clamp(n, -MAX_COORD, MAX_COORD));

const sizeNum = (fallback: number) =>
  z
    .number()
    .catch(fallback)
    .transform((n) => (Number.isFinite(n) ? clamp(n, 1, MAX_SIZE) : fallback));

// Non-finite z/timestamps map to 0 — Infinity would poison maxZ arithmetic.
const nonNegNum = z
  .number()
  .catch(0)
  .transform((n) => (Number.isFinite(n) ? Math.max(0, n) : 0));

const cardSchema = z.object({
  type: z.enum(CARD_TYPES),
  title: cappedString(MAX_TITLE),
  body: cappedString(MAX_BODY),
  x: coordNum,
  y: coordNum,
  w: sizeNum(CARD_W),
  h: sizeNum(CARD_DEFAULT_H),
  z: nonNegNum,
  divisionId: z.string().nullable().catch(null),
  color: z.enum(CARD_COLORS),
  createdAt: nonNegNum,
  updatedAt: nonNegNum,
});

const divisionSchema = z.object({
  name: cappedString(MAX_NAME),
  x: coordNum,
  y: coordNum,
  w: sizeNum(DIVISION_MIN_W),
  h: sizeNum(DIVISION_MIN_H),
  color: z.enum(CARD_COLORS),
  z: nonNegNum,
  createdAt: nonNegNum,
});

const linkSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.enum(LINK_TYPES),
  auto: z.boolean().catch(false),
  createdAt: nonNegNum,
});

// Entity records stay z.unknown(): each value is safeParsed individually so a
// single malformed card/division/link/board never rejects the whole file.
const boardSchema = z.object({
  name: cappedString(MAX_NAME),
  cards: z.record(z.string(), z.unknown()).catch({}),
  divisions: z.record(z.string(), z.unknown()).catch({}),
  links: z.record(z.string(), z.unknown()).catch({}),
  createdAt: nonNegNum,
});

const shellSchema = z.object({
  boards: z.record(z.string(), z.unknown()).catch({}),
  boardOrder: z
    .array(z.unknown())
    .catch([])
    .transform((a) => a.filter((v): v is string => typeof v === "string")),
  activeBoardId: z.string().catch(""),
});

/* --------------------------------- Import -------------------------------- */

export type ImportResult =
  | { ok: true; workspace: Workspace }
  | { ok: false; error: string };

export function parseWorkspaceJson(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Not valid JSON." };
  }
  try {
    return buildWorkspace(raw);
  } catch {
    return { ok: false, error: "Could not import this file." };
  }
}

function buildWorkspace(raw: unknown): ImportResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "Not a Struppëflo workspace file." };
  }
  if ((raw as Record<string, unknown>).version !== 1) {
    return {
      ok: false,
      error: "Unsupported workspace version — this app reads version 1 files.",
    };
  }

  const shell = shellSchema.parse(raw); // cannot fail: every field catches

  const parsedBoards = new Map<ID, { board: Board; createdAt: number }>();
  for (const [oldBoardId, rawBoard] of Object.entries(shell.boards)) {
    const built = buildBoard(rawBoard);
    if (built) parsedBoards.set(oldBoardId, built);
  }

  // Keep priority: boardOrder position first, then leftovers by createdAt/id.
  const seen = new Set<ID>();
  const orderedOldIds: ID[] = [];
  for (const oldId of shell.boardOrder) {
    if (parsedBoards.has(oldId) && !seen.has(oldId)) {
      seen.add(oldId);
      orderedOldIds.push(oldId);
    }
  }
  const leftovers = [...parsedBoards.keys()]
    .filter((oldId) => !seen.has(oldId))
    .sort((a, b) => {
      const byTime = parsedBoards.get(a)!.createdAt - parsedBoards.get(b)!.createdAt;
      return byTime !== 0 ? byTime : a < b ? -1 : a > b ? 1 : 0;
    });
  const keptOldIds = [...orderedOldIds, ...leftovers].slice(0, MAX_BOARDS);

  if (keptOldIds.length === 0) {
    return { ok: false, error: "No usable boards in this file." };
  }

  const boards: Record<ID, Board> = {};
  const boardOrder: ID[] = [];
  const boardIdMap = new Map<ID, ID>();
  for (const oldId of keptOldIds) {
    const board = parsedBoards.get(oldId)!.board;
    boards[board.id] = board;
    boardOrder.push(board.id);
    boardIdMap.set(oldId, board.id);
  }

  const activeBoardId = boardIdMap.get(shell.activeBoardId) ?? boardOrder[0];

  return {
    ok: true,
    workspace: { version: 1, boards, boardOrder, activeBoardId },
  };
}

function buildBoard(raw: unknown): { board: Board; createdAt: number } | null {
  const parsed = boardSchema.safeParse(raw);
  if (!parsed.success) return null;
  const shell = parsed.data;

  const cards = parseEntities(shell.cards, cardSchema, MAX_CARDS_PER_BOARD);
  const divisions = parseEntities(
    shell.divisions,
    divisionSchema,
    MAX_DIVISIONS_PER_BOARD,
  );

  // Links: integrity + pair-dedupe before the count cap so the cap never
  // spends slots on links that would be dropped anyway.
  const cardOldIds = new Set(cards.map(([oldId]) => oldId));
  const rawLinks = parseEntities(shell.links, linkSchema, Infinity).filter(
    ([, link]) =>
      link.from !== link.to &&
      cardOldIds.has(link.from) &&
      cardOldIds.has(link.to),
  );
  const seenPairs = new Set<string>();
  const links: Array<[ID, z.infer<typeof linkSchema>]> = [];
  for (const entry of rawLinks) {
    const [, link] = entry;
    const key =
      link.from < link.to
        ? `${link.from}|${link.to}`
        : `${link.to}|${link.from}`;
    if (seenPairs.has(key)) continue; // rawLinks is oldest-first: keep oldest
    seenPairs.add(key);
    links.push(entry);
    if (links.length >= MAX_LINKS_PER_BOARD) break;
  }

  const divisionIdMap = new Map<ID, ID>();
  const newDivisions: Record<ID, Division> = {};
  for (const [oldId, d] of divisions) {
    const id = crypto.randomUUID();
    divisionIdMap.set(oldId, id);
    newDivisions[id] = { id, ...d };
  }

  const cardIdMap = new Map<ID, ID>();
  const newCards: Record<ID, Card> = {};
  for (const [oldId, c] of cards) {
    const id = crypto.randomUUID();
    cardIdMap.set(oldId, id);
    newCards[id] = {
      id,
      ...c,
      divisionId:
        c.divisionId !== null ? (divisionIdMap.get(c.divisionId) ?? null) : null,
    };
  }

  const newLinks: Record<ID, Link> = {};
  for (const [, l] of links) {
    const id = crypto.randomUUID();
    newLinks[id] = {
      id,
      ...l,
      from: cardIdMap.get(l.from)!,
      to: cardIdMap.get(l.to)!,
    };
  }

  let maxZ = 0;
  for (const c of Object.values(newCards)) maxZ = Math.max(maxZ, c.z);
  for (const d of Object.values(newDivisions)) maxZ = Math.max(maxZ, d.z);

  const board: Board = {
    id: crypto.randomUUID(),
    name: shell.name || "Imported board",
    cards: newCards,
    divisions: newDivisions,
    links: newLinks,
    maxZ,
    createdAt: shell.createdAt,
  };
  return { board, createdAt: shell.createdAt };
}

/**
 * safeParse each record value (bad entities dropped, never the file), then
 * cap deterministically: keep oldest by createdAt, ties broken by old id.
 */
function parseEntities<S extends z.ZodTypeAny>(
  record: Record<string, unknown>,
  schema: S,
  max: number,
): Array<[ID, z.infer<S> & { createdAt: number }]> {
  const kept: Array<[ID, z.infer<S> & { createdAt: number }]> = [];
  for (const [oldId, value] of Object.entries(record)) {
    const parsed = schema.safeParse(value);
    if (parsed.success) kept.push([oldId, parsed.data]);
  }
  kept.sort(([aId, a], [bId, b]) => {
    const byTime = a.createdAt - b.createdAt;
    return byTime !== 0 ? byTime : aId < bId ? -1 : aId > bId ? 1 : 0;
  });
  return kept.length > max ? kept.slice(0, max) : kept;
}

/* ------------------------------ File reading ------------------------------ */

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_IMPORT_BYTES) {
      reject(new Error("File is too large to import (max 10 MB)."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsText(file);
  });
}
