"use client";

import { compileBoard } from "./compiler/compile";
import { anthropicClient, thinkingFor } from "./ai/anthropicProvider";
import { getAIConfig } from "./aiConfig";
import { copyText } from "./clipboard";
import type { Board } from "./types";

export const DEFAULT_RUN_INSTRUCTION =
  "Execute this plan: work through the sections in the suggested order and " +
  "produce the deliverable this board describes. Where an open question " +
  "blocks you, make a sensible assumption and state it explicitly.";

export function buildRunPrompt(board: Board, instruction: string): string {
  const { markdown } = compileBoard(board);
  return `${markdown}\n\n---\n\n${instruction.trim() || DEFAULT_RUN_INSTRUCTION}`;
}

/** claude.ai chokes on very long ?q= URLs — past this we copy + open instead. */
const MAX_URL_PROMPT = 6000;

export async function openInClaude(
  prompt: string,
): Promise<"opened" | "copied"> {
  if (prompt.length <= MAX_URL_PROMPT) {
    window.open(
      `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
      "_blank",
      "noopener",
    );
    return "opened";
  }
  await copyText(prompt);
  window.open("https://claude.ai/new", "_blank", "noopener");
  return "copied";
}

/**
 * Stream a run with the user's own key. Yields text deltas; throws on setup
 * or API errors (the Run panel surfaces them).
 */
export async function* streamRun(
  prompt: string,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const client = await anthropicClient();
  if (!client) throw new Error("No Anthropic API key configured.");
  const { model } = getAIConfig();

  const stream = client.messages.stream(
    {
      model,
      max_tokens: 64000,
      ...thinkingFor(model),
      messages: [{ role: "user", content: prompt }],
    },
    { signal },
  );

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

/** Cheap key validation: fetch model metadata (no tokens billed). */
export async function testAIKey(): Promise<{ ok: boolean; error?: string }> {
  const client = await anthropicClient();
  if (!client) return { ok: false, error: "No key entered." };
  try {
    await client.models.retrieve(getAIConfig().model);
    return { ok: true };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not reach the Anthropic API.";
    return { ok: false, error: message.slice(0, 200) };
  }
}
