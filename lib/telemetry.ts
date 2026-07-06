"use client";

/**
 * Tier-2 opt-in structural telemetry.
 *
 * Off by default. When the user flips the toggle in Help → Help improve
 * Struppëflo, board STRUCTURE and run OUTCOMES start flowing to /api/telemetry.
 * Card titles, bodies, prompt text, output text, and API keys are NEVER sent
 * at any tier. The privacy page enumerates exactly what is sent.
 */

const STORAGE_KEY = "struppeflo-telemetry-opt-in";

let cached: boolean | null = null;
const listeners = new Set<() => void>();

function load(): boolean {
  if (cached !== null) return cached;
  try {
    cached = localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    cached = false;
  }
  return cached;
}

function persist(value: boolean): void {
  cached = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Session-only when storage is unavailable.
  }
  listeners.forEach((l) => l());
}

export function telemetryEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return load();
}

export function setTelemetryEnabled(value: boolean): void {
  persist(value);
}

export function subscribeTelemetry(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Card-type histogram only — no titles, no bodies. */
export type CardTypeHistogram = Partial<
  Record<"note" | "task" | "question" | "insight" | "resource", number>
>;

export interface BoardStructurePayload {
  cards: number;
  divisions: number;
  links: number;
  cardTypes: CardTypeHistogram;
  linkTypes: Partial<Record<"related_to" | "depends_on" | "input_to", number>>;
  /** Longest depends_on chain length (0 if none). */
  maxDependencyDepth: number;
}

export interface RunOutcomePayload {
  provider: string;
  model: string;
  /** SHA-256 hex of the compiled markdown. Never the markdown itself. */
  promptFingerprint: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  status: "ok" | "error" | "aborted";
  /** 1 for thumbs up, -1 for thumbs down, undefined for unrated. */
  rating?: 1 | -1;
  /** Cards on the board at the moment the run started. */
  cards: number;
}

/** Subset of TelemetryPayload the server route accepts. Hard-capped by zod. */
export interface TelemetryPayload {
  structure?: BoardStructurePayload;
  run?: RunOutcomePayload;
}

export async function sendTelemetry(payload: TelemetryPayload): Promise<void> {
  if (!telemetryEnabled()) return;
  try {
    await fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Telemetry must never break the product.
  }
}