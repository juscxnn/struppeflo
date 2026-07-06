export type ID = string;

export const CARD_TYPES = ["note", "task", "question", "insight", "resource"] as const;
export type CardType = (typeof CARD_TYPES)[number];

export const LINK_TYPES = ["related_to", "depends_on", "input_to"] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export const CARD_COLORS = ["default", "amber", "blue", "violet", "teal", "rose"] as const;
export type CardColor = (typeof CARD_COLORS)[number];

export interface Card {
  id: ID;
  type: CardType;
  title: string; // ≤ 200 chars
  body: string; // ≤ 5000 chars
  /** World coordinates, top-left corner. */
  x: number;
  y: number;
  /** Fixed 240 in v1; stored for future variable widths. */
  w: number;
  /** Measured height (ResizeObserver write-back, excluded from undo history). */
  h: number;
  /** Monotonic per-board z counter; drag commits bump to maxZ + 1. */
  z: number;
  divisionId: ID | null;
  color: CardColor;
  createdAt: number;
  updatedAt: number;
}

export interface Division {
  id: ID;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: CardColor;
  z: number;
  createdAt: number;
}

/**
 * Direction convention: `from` NEEDS `to`.
 *   A --depends_on--> B  reads "A depends on B" (B must come first).
 *   A --input_to-->   B  reads "A is input to B" (A feeds B).
 * related_to is undirected in meaning; from/to only matter for drawing.
 */
export interface Link {
  id: ID;
  from: ID;
  to: ID;
  type: LinkType;
  /** Created by proximity drop or accepted AI suggestion. */
  auto: boolean;
  createdAt: number;
}

/** A tab IS a board — 1:1, no separate tab entity. */
export interface Board {
  id: ID;
  name: string;
  cards: Record<ID, Card>;
  divisions: Record<ID, Division>;
  links: Record<ID, Link>;
  maxZ: number;
  createdAt: number;
  /** History of AI runs on this board. Metadata only — no full output bodies
   *  (storage-cheap). The current run output is shown live in the Run panel. */
  runs: BoardRun[];
}

/** Compact record of one AI run. */
export interface BoardRun {
  id: ID;
  at: number;
  provider: string;
  model: string;
  promptFingerprint: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  status: "ok" | "error" | "aborted";
  rating?: 1 | -1;
  cards: number;
  /** The model's full output text for this run (kept so the user can
   *  re-read and re-export past deliverables). Capped per-board to keep
   *  localStorage pressure manageable. */
  output?: string;
}

export interface Workspace {
  version: 1;
  boards: Record<ID, Board>;
  /** Tab order. */
  boardOrder: ID[];
  activeBoardId: ID;
}

export const PERSONAS = ["founder", "researcher", "pm", "student", "generalist"] as const;
export type Persona = (typeof PERSONAS)[number];

export interface OnboardingState {
  status: "unseen" | "in_progress" | "done" | "skipped";
  stepIndex: number;
  persona: Persona | null;
  tour: {
    createdCard: boolean;
    madeLink: boolean;
    openedXRay: boolean;
    copiedPrompt: boolean;
  };
}

export interface Camera {
  tx: number;
  ty: number;
  s: number;
}

/** Studio uses DEFAULT_POLICY; the landing demo board uses DEMO_POLICY. */
export interface InteractionPolicy {
  pan: boolean;
  zoom: boolean;
  createCards: boolean;
  createDivisions: boolean;
  createLinks: boolean;
  edit: boolean;
  delete: boolean;
  /** World-space rect card positions are clamped to (landing demo). */
  bounds: { x: number; y: number; w: number; h: number } | null;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/* ----------------------------- AI contracts ----------------------------- */

export interface OrganizePlan {
  divisions: Array<{ name: string; color: CardColor; rect: Rect }>;
  /** cardId → index into `divisions`. */
  assignments: Record<ID, number>;
  positions: Record<ID, { x: number; y: number }>;
}

export interface LinkSuggestion {
  from: ID;
  to: ID;
  type: LinkType;
  score: number;
  reason: string;
}

export interface WorkflowPlan {
  /** A fully-built new board (lanes layout) to insert as a new tab. */
  board: Board;
}

export interface SparkQuestion {
  id: string;
  question: string;
  /** Card type the answer becomes. */
  answerType: CardType;
  /** Division to place the answer near, if any. */
  divisionId: ID | null;
}

export interface AIProvider {
  organize(board: Board): Promise<OrganizePlan>;
  suggestLinks(board: Board): Promise<LinkSuggestion[]>;
  generateWorkflow(board: Board): Promise<WorkflowPlan>;
  sparkQuestions(
    board: Board,
    persona: Persona | null,
    templateId: string | null,
  ): Promise<SparkQuestion[]>;
}

/* --------------------------- Compiler contracts -------------------------- */

export interface CompilerWarning {
  kind: "cycle_broken" | "orphan_link";
  message: string;
  linkId?: ID;
}

export interface CompiledCard {
  id: ID;
  type: CardType;
  title: string;
  body: string;
  dependsOn: ID[];
  inputs: ID[];
  relatedTo: ID[];
}

export interface CompiledBoard {
  version: 1;
  board: {
    name: string;
    cardCount: number;
    sectionCount: number;
    linkCount: number;
  };
  sections: Array<{ name: string; order: number; cards: CompiledCard[] }>;
  executionOrder: Array<{ cardId: ID; title: string; section: string }>;
  warnings: CompilerWarning[];
}

export interface CompileResult {
  markdown: string;
  json: CompiledBoard;
  warnings: CompilerWarning[];
}
