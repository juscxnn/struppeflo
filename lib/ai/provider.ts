import type { AIProvider } from "@/lib/types";
import { getAIConfig, hasAIKey, modelProvider } from "@/lib/aiConfig";
import { AnthropicProvider } from "./anthropicProvider";
import { ApiAIProvider } from "./apiProvider";
import { MockAIProvider } from "./mockProvider";
import { GeminiProvider } from "./geminiProvider";
import { OpenAICompatProvider } from "./openaiCompat";

/**
 * Provider resolution (v1, browser-direct BYOK):
 *
 *   1. NEXT_PUBLIC_AI_PROVIDER=api → ApiAIProvider (hosted backend seam).
 *   2. Otherwise pick the provider class for the current model. If the user
 *      has a key for that provider, real AI. Else MockAIProvider (local
 *      heuristics) — so missing a key never breaks a feature.
 */
export function getProvider(): AIProvider {
  if (process.env.NEXT_PUBLIC_AI_PROVIDER === "api") {
    return new ApiAIProvider();
  }
  if (typeof window === "undefined") {
    return new ApiAIProvider();
  }
  const cfg = getAIConfig();
  const provider = modelProvider(cfg.model);
  if (!hasAIKey()) return new MockAIProvider();

  switch (provider) {
    case "anthropic":
      return new AnthropicProvider();
    case "gemini":
      return new GeminiProvider();
    case "openai":
      return new OpenAICompatProvider({
        apiUrl: "https://api.openai.com/v1/chat/completions",
        provider: "openai",
        supportsJsonSchema: true,
      });
    case "minimax":
      return new OpenAICompatProvider({
        apiUrl: "https://api.MiniMax.io/v1/chat/completions",
        provider: "minimax",
        supportsJsonSchema: true,
      });
    case "kimi":
      return new OpenAICompatProvider({
        apiUrl: "https://api.moonshot.cn/v1/chat/completions",
        provider: "kimi",
        supportsJsonSchema: true,
      });
  }
}