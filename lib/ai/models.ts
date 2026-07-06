/**
 * Model registry. One source of truth for pickers, system prompts, and handoffs.
 *
 * Add a new model: drop a row. Add a new provider: also implement a class in
 * lib/ai/, register it in `PROVIDERS` below, and add a key entry in
 * `lib/aiConfig.ts`. CSP `connect-src` must whitelist the new origin in
 * `next.config.ts`.
 */

export type ProviderId =
  | "anthropic"
  | "openai"
  | "gemini"
  | "minimax"
  | "kimi";

export interface ModelSpec {
  id: string;
  provider: ProviderId;
  label: string;
  blurb: string;
  /** Approximate context window in tokens. */
  contextWindow: number;
  /** Approximate USD per 1M tokens. Used for the in-app cost estimate. */
  pricePerMTokInput: number;
  pricePerMTokOutput: number;
}

export const MODELS: readonly ModelSpec[] = [
  {
    id: "claude-opus-4-8",
    provider: "anthropic",
    label: "Claude Opus 4.8",
    blurb: "Most capable — best organizing and runs",
    contextWindow: 200_000,
    pricePerMTokInput: 15,
    pricePerMTokOutput: 75,
  },
  {
    id: "claude-sonnet-5",
    provider: "anthropic",
    label: "Claude Sonnet 5",
    blurb: "Near-Opus quality, faster and cheaper",
    contextWindow: 200_000,
    pricePerMTokInput: 3,
    pricePerMTokOutput: 15,
  },
  {
    id: "claude-haiku-4-5",
    provider: "anthropic",
    label: "Claude Haiku 4.5",
    blurb: "Fastest and cheapest",
    contextWindow: 200_000,
    pricePerMTokInput: 0.8,
    pricePerMTokOutput: 4,
  },
  {
    id: "gpt-5",
    provider: "openai",
    label: "GPT-5",
    blurb: "Strong general planning and code",
    contextWindow: 400_000,
    pricePerMTokInput: 2.5,
    pricePerMTokOutput: 10,
  },
  {
    id: "gpt-5-mini",
    provider: "openai",
    label: "GPT-5 mini",
    blurb: "Cheaper, faster GPT-5",
    contextWindow: 400_000,
    pricePerMTokInput: 0.25,
    pricePerMTokOutput: 2,
  },
  {
    id: "gpt-4.1",
    provider: "openai",
    label: "GPT-4.1",
    blurb: "Workhorse — large context, reliable",
    contextWindow: 1_000_000,
    pricePerMTokInput: 2,
    pricePerMTokOutput: 8,
  },
  {
    id: "gemini-2.5-pro",
    provider: "gemini",
    label: "Gemini 2.5 Pro",
    blurb: "Deep reasoning, large context",
    contextWindow: 1_000_000,
    pricePerMTokInput: 1.25,
    pricePerMTokOutput: 5,
  },
  {
    id: "gemini-2.5-flash",
    provider: "gemini",
    label: "Gemini 2.5 Flash",
    blurb: "Fast, cheap, very long context",
    contextWindow: 1_000_000,
    pricePerMTokInput: 0.075,
    pricePerMTokOutput: 0.3,
  },
  {
    id: "minimax-text-01",
    provider: "minimax",
    label: "MiniMax-Text-01",
    blurb: "Long context, bilingual",
    contextWindow: 1_000_000,
    pricePerMTokInput: 0.2,
    pricePerMTokOutput: 0.2,
  },
  {
    id: "kimi-k2",
    provider: "kimi",
    label: "Kimi K2",
    blurb: "Long documents, Chinese + English",
    contextWindow: 128_000,
    pricePerMTokInput: 0.6,
    pricePerMTokOutput: 2.5,
  },
];

export const MODEL_BY_ID: Record<string, ModelSpec> = Object.fromEntries(
  MODELS.map((m) => [m.id, m]),
);

export function getModel(id: string): ModelSpec | undefined {
  return MODEL_BY_ID[id];
}

export const DEFAULT_MODEL = "claude-opus-4-8";

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Google Gemini",
  minimax: "MiniMax",
  kimi: "Moonshot (Kimi)",
};

export const PROVIDER_HINTS: Record<ProviderId, string> = {
  anthropic: "sk-ant-…",
  openai: "sk-…",
  gemini: "AIza…",
  minimax: "ey…",
  kimi: "sk-…",
};

export const PROVIDER_API_HOSTS: Record<ProviderId, string> = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com",
  gemini: "https://generativelanguage.googleapis.com",
  minimax: "https://api.MiniMax.io",
  kimi: "https://api.moonshot.cn",
};