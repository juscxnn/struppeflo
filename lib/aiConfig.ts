"use client";

/**
 * Bring-your-own-key AI configuration. The key lives in this browser's
 * localStorage only and is sent to exactly one place: api.anthropic.com
 * (enforced by the CSP's connect-src). No Struppëflo server ever sees it.
 */

export interface AIConfig {
  apiKey: string | null;
  model: string;
}

export const AI_MODELS = [
  {
    id: "claude-opus-4-8",
    label: "Claude Opus 4.8",
    blurb: "Most capable — best organizing and runs",
  },
  {
    id: "claude-sonnet-5",
    label: "Claude Sonnet 5",
    blurb: "Near-Opus quality, faster and cheaper",
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    blurb: "Fastest and cheapest",
  },
] as const;

const STORAGE_KEY = "struppeflo-ai";
const DEFAULTS: AIConfig = { apiKey: null, model: "claude-opus-4-8" };

let cached: AIConfig | null = null;
const listeners = new Set<() => void>();

function load(): AIConfig {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AIConfig>;
      cached = {
        apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : null,
        model:
          typeof parsed.model === "string" &&
          AI_MODELS.some((m) => m.id === parsed.model)
            ? parsed.model
            : DEFAULTS.model,
      };
      return cached;
    }
  } catch {
    // Corrupt or unavailable storage — fall through to defaults.
  }
  cached = { ...DEFAULTS };
  return cached;
}

export function getAIConfig(): AIConfig {
  if (typeof window === "undefined") return DEFAULTS;
  return load();
}

export function setAIConfig(patch: Partial<AIConfig>): void {
  cached = { ...load(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // Session-only config when storage is unavailable.
  }
  listeners.forEach((l) => l());
}

export function hasAIKey(): boolean {
  return !!getAIConfig().apiKey;
}

/** For useSyncExternalStore. */
export function subscribeAIConfig(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function aiConfigSnapshot(): AIConfig {
  return getAIConfig();
}

export function aiConfigServerSnapshot(): AIConfig {
  return DEFAULTS;
}
