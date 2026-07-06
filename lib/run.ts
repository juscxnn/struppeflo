"use client";

import { compileBoard } from "./compiler/compile";
import { anthropicClient, thinkingFor } from "./ai/anthropicProvider";
import { getAIConfig } from "./aiConfig";
import { copyText } from "./clipboard";
import type { Board } from "./types";

export const DEFAULT_RUN_INSTRUCTION =
  "Produce the deliverable this board describes, worked through to a " +
  "finished, usable state.";

/**
 * System prompt for in-app runs. Teaches the model the board format once,
 * sets the behavioral contract (deliverable, not a plan; assumptions over
 * stalling), and pins the output shape.
 */
export const RUN_SYSTEM_PROMPT = `You execute plans that arrive as compiled boards from a spatial planning tool.

How to read the board:
- <section> blocks are ordered by dependency, then by the author's spatial layout.
- <task> is work to do. <note> is context. <insight> is a conclusion to build on. <resource> is reference material. <open_question> is an unresolved decision.
- depends_on and inputs attributes plus <execution_order> give the intended sequence. Follow it unless it is clearly wrong.

How to work:
- Produce the deliverable itself, not a plan for producing it and not a restatement of the board.
- Work through tasks in execution order. Treat notes, insights and resources as real constraints, not decoration.
- For each <open_question>, make the most sensible assumption in one line and keep going. Never stall on missing information.
- Match depth to the work: substantive tasks get substance; do not pad thin ones to look thorough.

Output:
- Lead with the deliverable. No preamble about what you are going to do.
- Plain markdown, concrete and specific.
- If you made assumptions, list them briefly at the end under "Assumptions".`;

export function buildRunPrompt(board: Board, instruction: string): string {
  const { markdown } = compileBoard(board);
  return `${markdown}\n\n<instructions>\n${instruction.trim() || DEFAULT_RUN_INSTRUCTION}\n</instructions>`;
}

/**
 * The claude.ai handoff can't set a system prompt, so fold a one-line
 * version of the contract into the user message instead.
 */
export function buildHandoffPrompt(board: Board, instruction: string): string {
  const { markdown } = compileBoard(board);
  const task = instruction.trim() || DEFAULT_RUN_INSTRUCTION;
  return (
    `${markdown}\n\n<instructions>\n${task}\n` +
    `Work through the sections in the suggested execution order. Produce the deliverable itself, not a plan. ` +
    `For each open question, state a sensible assumption in one line and continue.\n</instructions>`
  );
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
      system: RUN_SYSTEM_PROMPT,
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
