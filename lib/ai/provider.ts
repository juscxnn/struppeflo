import type { AIProvider } from "@/lib/types";
import { hasAIKey } from "@/lib/aiConfig";
import { AnthropicProvider } from "./anthropicProvider";
import { ApiAIProvider } from "./apiProvider";
import { MockAIProvider } from "./mockProvider";

/**
 * Provider resolution:
 * 1. User connected their own Anthropic key → real AI, straight from the
 *    browser (with silent fallback to the local heuristics on any failure).
 * 2. NEXT_PUBLIC_AI_PROVIDER=api → the future hosted-backend seam.
 * 3. Default → deterministic local heuristics. Everything works offline.
 */
export function getProvider(): AIProvider {
  if (typeof window !== "undefined" && hasAIKey()) {
    return new AnthropicProvider();
  }
  return process.env.NEXT_PUBLIC_AI_PROVIDER === "api"
    ? new ApiAIProvider()
    : new MockAIProvider();
}
