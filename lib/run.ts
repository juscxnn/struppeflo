"use client";

import { compileBoard } from "./compiler/compile";
import { anthropicClient } from "./ai/anthropicProvider";
import { getAIConfig, getProviderKey, modelProvider } from "./aiConfig";
import { copyText } from "./clipboard";
import { getModel, type ProviderId } from "./ai/models";
import type { Board } from "./types";

export const DEFAULT_RUN_INSTRUCTION =
  "Produce the deliverable this board describes, worked through to a " +
  "finished, usable state.";

export type StreamEvent =
  | { kind: "text"; delta: string }
  | { kind: "thinking"; delta: string };

/**
 * Per-model system prompt contract. Tailored for each provider's strengths.
 */
function systemPromptFor(provider: ProviderId, model: string): string {
  if (provider === "anthropic") {
    return `You execute plans that arrive as compiled boards from a spatial planning tool.

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
  }
  if (provider === "openai") {
    return `You execute plans compiled from a spatial planning board.

The user's prompt contains:
- <section> blocks ordered by dependency then layout.
- Cards tagged <task>, <note>, <insight>, <resource>, or <open_question>.
- depends_on / inputs attributes and an <execution_order> block.

Work in execution order. Produce the deliverable itself, not a plan. For each <open_question>, state a sensible assumption in one line and continue. Use markdown headings to mark each section. Match depth to the work. End with a brief "Assumptions" list.`;
  }
  if (provider === "gemini") {
    return `The user has compiled a planning board into a structured prompt. Follow the <execution_order> unless it is clearly wrong.

Treat <note>, <insight>, <resource>, and <open_question> as real input. For each <open_question>, state a one-line assumption and keep going.

Format: lead with the deliverable. Use one markdown heading per top-level section. Be concrete and specific. End with a short "Assumptions" list.`;
  }
  // MiniMax and Kimi share the bilingual-friendly contract.
  return `The user has compiled a planning board into a structured prompt. Follow the <execution_order> unless it is clearly wrong.

For each <open_question>, state a one-line assumption and continue. Lead with the deliverable. Match depth to the work — substantive sections get substance; thin sections stay short. End with a brief "Assumptions" list.

You may answer in English or in the language the user wrote the instructions in. Model: ${model}.`;
}

export function buildRunPrompt(board: Board, instruction: string): string {
  const { markdown } = compileBoard(board);
  return `${markdown}\n\n<instructions>\n${instruction.trim() || DEFAULT_RUN_INSTRUCTION}\n</instructions>`;
}

/**
 * The handoff to hosted chat UIs can't set a system prompt, so fold a one-line
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

/** Past this length the host URL becomes unreliable — fall back to copy. */
const MAX_URL_PROMPT = 6000;

interface Handoff {
  url: string;
  /**
   * Whether the host accepts a `q=` query param. ChatGPT/Gemini/MiniMax/Kimi
   * either ignore it or truncate; we always copy when in doubt.
   */
  supportsQuery: boolean;
}

function handoffFor(provider: ProviderId): Handoff {
  switch (provider) {
    case "anthropic":
      return { url: "https://claude.ai/new", supportsQuery: true };
    case "openai":
      return { url: "https://chatgpt.com/", supportsQuery: true };
    case "gemini":
      return { url: "https://gemini.google.com/app", supportsQuery: false };
    case "minimax":
      return { url: "https://chat.minimax.io/", supportsQuery: true };
    case "kimi":
      return { url: "https://kimi.com/", supportsQuery: true };
  }
}

export async function openInModel(
  provider: ProviderId,
  prompt: string,
): Promise<"opened" | "copied"> {
  const target = handoffFor(provider);
  if (target.supportsQuery && prompt.length <= MAX_URL_PROMPT) {
    window.open(`${target.url}?q=${encodeURIComponent(prompt)}`, "_blank", "noopener");
    return "opened";
  }
  await copyText(prompt);
  window.open(target.url, "_blank", "noopener");
  return "copied";
}

/**
 * Stream a run with the user's own key. Yields typed events; throws on setup
 * or API errors (the Run panel surfaces them).
 */
export async function* streamRun(
  prompt: string,
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const cfg = getAIConfig();
  const provider = modelProvider(cfg.model);
  const model = cfg.model;
  const spec = getModel(model);

  if (provider === "anthropic") {
    const client = await anthropicClient();
    if (!client) throw new Error("No Anthropic API key configured.");
    const stream = client.messages.stream(
      {
        model,
        max_tokens: 64000,
        ...(model === "claude-opus-4-8"
          ? { thinking: { type: "adaptive" as const } }
          : {}),
        system: systemPromptFor("anthropic", model),
        messages: [{ role: "user", content: prompt }],
      },
      { signal },
    );
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield { kind: "text", delta: event.delta.text };
      } else if (
        event.type === "content_block_delta" &&
        event.delta.type === "thinking_delta"
      ) {
        yield { kind: "thinking", delta: event.delta.thinking };
      }
    }
    return;
  }

  if (provider === "gemini") {
    const key = getProviderKey("gemini");
    if (!key) throw new Error("No Google API key configured.");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPromptFor("gemini", model) }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 64000 },
      }),
      signal,
    });
    if (!r.ok || !r.body) {
      const text = await r.text().catch(() => "");
      throw new Error(`${r.status} ${r.statusText}${text ? `: ${text.slice(0, 160)}` : ""}`);
    }
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const events = buf.split("\n\n");
      buf = events.pop() ?? "";
      for (const evt of events) {
        const line = evt.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          const j = JSON.parse(payload) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const text = j.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) yield { kind: "text", delta: text };
        } catch {
          // Skip malformed event.
        }
      }
    }
    return;
  }

  // OpenAI-compatible (OpenAI, MiniMax, Kimi).
  const compatProvider =
    provider === "openai"
      ? "openai"
      : provider === "minimax"
        ? "minimax"
        : "kimi";
  const key = getProviderKey(compatProvider);
  if (!key) throw new Error(`No ${spec?.label ?? compatProvider} API key configured.`);
  const apiUrl =
    provider === "openai"
      ? "https://api.openai.com/v1/chat/completions"
      : provider === "minimax"
        ? "https://api.MiniMax.io/v1/chat/completions"
        : "https://api.moonshot.cn/v1/chat/completions";
  const r = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: 64000,
      messages: [
        { role: "system", content: systemPromptFor(provider, model) },
        { role: "user", content: prompt },
      ],
    }),
    signal,
  });
  if (!r.ok || !r.body) {
    const text = await r.text().catch(() => "");
    throw new Error(`${r.status} ${r.statusText}${text ? `: ${text.slice(0, 160)}` : ""}`);
  }
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      if (!payload) continue;
      try {
        const j = JSON.parse(payload) as {
          choices?: Array<{
            delta?: { content?: string; reasoning_content?: string };
          }>;
        };
        const text = j.choices?.[0]?.delta?.content;
        const reasoning = j.choices?.[0]?.delta?.reasoning_content;
        if (text) yield { kind: "text", delta: text };
        if (reasoning) yield { kind: "thinking", delta: reasoning };
      } catch {
        // Skip malformed event.
      }
    }
  }
}

/** Cheap key validation: fetch model metadata (no tokens billed). */
export async function testAIKey(): Promise<{ ok: boolean; error?: string }> {
  const { testAIKey: testImpl } = await import("./ai/anthropicProvider");
  return testImpl(modelProvider(getAIConfig().model));
}

// Re-export the typed event union from a single place for the UI.
export type { StreamEvent as RunStreamEvent };