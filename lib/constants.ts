import type { CardColor, CardType, InteractionPolicy, LinkType } from "./types";

/* ------------------------------- Geometry -------------------------------- */
export const CARD_W = 240;
export const CARD_DEFAULT_H = 96;
export const DIVISION_MIN_W = 160;
export const DIVISION_MIN_H = 120;

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 2.0;
export const ZOOM_WHEEL_FACTOR = 0.01;

export const DRAG_THRESHOLD_PX = 4;
export const PROXIMITY_THRESHOLD = 48; // world px, rect edge-gap
export const PROXIMITY_DWELL_MS = 150;
export const ANCHOR_CORNER_CLAMP = 16;

/** Snap engine. */
export const SNAP_GRID = 16;
export const SNAP_ALIGN_PX = 6; // edge / center alignment threshold
export const ZONE_FIT_PADDING = 28;

/* ------------------------------ Performance ------------------------------ */
export const PERF_CARD_LIMIT = 40; // blurred cards beyond this → perf mode
export const PERF_ZOOM_CUTOFF = 0.5;

/* -------------------------------- Limits --------------------------------- */
export const MAX_TITLE = 200;
export const MAX_BODY = 5000;
export const MAX_NAME = 80;
export const MAX_CARDS_PER_BOARD = 2000;
export const MAX_LINKS_PER_BOARD = 500;
export const MAX_DIVISIONS_PER_BOARD = 100;
export const MAX_BOARDS = 50;
export const MAX_COORD = 1_000_000;
export const MAX_SIZE = 4000;

/* -------------------------------- Storage -------------------------------- */
export const STORAGE_KEY_WORKSPACE = "struppeflo-workspace";
export const STORAGE_KEY_UI = "struppeflo-ui";
export const STORAGE_BUDGET_BYTES = 4.5 * 1024 * 1024;
export const STORAGE_WARN_RATIO = 0.8;
export const STORAGE_WRITE_THROTTLE_MS = 500;
export const UNDO_LIMIT = 100;

/* ------------------------------- Card meta ------------------------------- */
export const CARD_TYPE_META: Record<
  CardType,
  { label: string; tag: string; dot: string }
> = {
  note: { label: "Note", tag: "note", dot: "var(--ink-faint)" },
  task: { label: "Task", tag: "task", dot: "var(--accent)" },
  question: { label: "Question", tag: "open_question", dot: "var(--link-depends)" },
  insight: { label: "Insight", tag: "insight", dot: "var(--accent-2)" },
  resource: { label: "Resource", tag: "resource", dot: "var(--link-input)" },
};

export const CARD_COLOR_TINT: Record<CardColor, string> = {
  default: "var(--card-tint-default)",
  amber: "var(--card-tint-amber)",
  blue: "var(--card-tint-blue)",
  violet: "var(--card-tint-violet)",
  teal: "var(--card-tint-teal)",
  rose: "var(--card-tint-rose)",
};

export const LINK_TYPE_META: Record<
  LinkType,
  { label: string; verb: string; color: string; dashed: boolean }
> = {
  related_to: {
    label: "Related",
    verb: "related to",
    color: "var(--link-related)",
    dashed: true,
  },
  depends_on: {
    label: "Depends on",
    verb: "depends on",
    color: "var(--link-depends)",
    dashed: false,
  },
  input_to: {
    label: "Input to",
    verb: "input to",
    color: "var(--link-input)",
    dashed: false,
  },
};

/* -------------------------------- Policies ------------------------------- */
export const DEFAULT_POLICY: InteractionPolicy = {
  pan: true,
  zoom: true,
  createCards: true,
  createDivisions: true,
  createLinks: true,
  edit: true,
  delete: true,
  bounds: null,
};

export const DEMO_POLICY: InteractionPolicy = {
  pan: false,
  zoom: false,
  createCards: false,
  createDivisions: false,
  createLinks: true,
  edit: false,
  delete: false,
  bounds: { x: 0, y: 0, w: 980, h: 560 },
};
