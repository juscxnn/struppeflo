import type { AIProvider } from "@/lib/types";
import { ApiAIProvider } from "./apiProvider";
import { MockAIProvider } from "./mockProvider";

export function getProvider(): AIProvider {
  return process.env.NEXT_PUBLIC_AI_PROVIDER === "api"
    ? new ApiAIProvider()
    : new MockAIProvider();
}
