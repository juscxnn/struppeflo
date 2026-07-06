"use client";

/**
 * Bring-your-own-key AI configuration.
 *
 * Storage shape:
 *   { keys: { anthropic?: string, openai?: string, gemini?: string,
 *             minimax?: string, kimi?: string },
 *     model: string }   // model id from MODELS
 *
 * Keys live in localStorage only. They are sent only to the provider that
 * owns them (CSP enforces this).
 *
 * Legacy shape `{ apiKey, model }` from v0.x is migrated on first read.
 */

import {
  DEFAULT_MODEL,
  MODEL_BY_ID,
  type ProviderId,
} from "./ai/models";

export interface AIConfig {
  keys: Partial<Record<ProviderId, string>>;
  model: string;
}

const STORAGE_KEY = "struppeflo-ai";

const DEFAULTS: AIConfig = { keys: {}, model: DEFAULT_MODEL };

let cached: AIConfig | null = null;
const listeners = new Set<() => void>();

function migrate(raw: unknown): AIConfig | null {
  if (!raw) return null;
  if (typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.keys && typeof obj.keys === "object" && typeof obj.model === "string") {
    const keys: Partial<Record<ProviderId, string>> = {};
    for (const [k, v] of Object.entries(obj.keys as Record<string, unknown>)) {
      if (typeof v === "string" && v.length > 0) {
        keys[k as ProviderId] = v;
      }
    }
    const modelId =
      typeof obj.model === "string" && MODEL_BY_ID[obj.model]
        ? obj.model
        : DEFAULT_MODEL;
    return { keys, model: modelId };
  }
  if (typeof obj.apiKey === "string" && obj.apiKey.length > 0) {
    const modelId =
      typeof obj.model === "string" && MODEL_BY_ID[obj.model]
        ? obj.model
        : DEFAULT_MODEL;
    return { keys: { anthropic: obj.apiKey }, model: modelId };
  }
  return null;
}

function load(): AIConfig {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      const migrated = migrate(parsed);
      if (migrated) {
        cached = migrated;
        return cached;
      }
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

export function modelProvider(model: string): ProviderId {
  return MODEL_BY_ID[model]?.provider ?? "anthropic";
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

export function setProviderKey(provider: ProviderId, key: string | null): void {
  const current = load();
  const keys = { ...current.keys };
  if (key && key.length > 0) keys[provider] = key;
  else delete keys[provider];
  setAIConfig({ keys });
}

export function getProviderKey(provider: ProviderId): string | null {
  return load().keys[provider] ?? null;
}

export function hasAIKey(): boolean {
  const c = load();
  return !!c.keys[modelProvider(c.model)];
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