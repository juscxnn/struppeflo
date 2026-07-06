"use client";

import type Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, Board, Persona, SparkQuestion } from "../types";
import { layoutOrganizePlan } from "./layout";
import { planOrganize } from "./cluster";
import { suggestLinks as localSuggestLinks } from "./linkSuggest";
import { planWorkflow } from "./workflow";
import { generateSparks } from "./sparks";
import { CARD_TYPES, LINK_TYPES } from "../types";
import type { LinkSuggestion, OrganizePlan, WorkflowPlan } from "../types";
import { getProviderKey, getAIConfig } from "../aiConfig";

/**
 * Base for browser-direct Anthropic and OpenAI-compatible providers.
 * Each concrete subclass overrides `apiUrl` (or relies on the SDK for
 * Anthropic) and how it constructs the request body.
 */

export type StreamEvent =
  | { kind: "text"; delta: string }
  | { kind: "thinking"; delta: string }
  | { kind: "tool_use"; delta: string }
  | { kind: "usage"; inputTokens: number; outputTokens: number };

// The Anthropic SDK is ~60 kB — load it only when a key is actually connected.
async function getSdk() {
  const [{ default: AnthropicSdk }, { zodOutputFormat }] = await Promise.all([
    import("@anthropic-ai/sdk"),
    import("@anthropic-ai/sdk/helpers/zod"),
  ]);
  return { AnthropicSdk, zodOutputFormat };
}

export async function anthropicClient(): Promise<Anthropic | null> {
  const key = getProviderKey("anthropic");
  if (!key) return null;
  const { AnthropicSdk } = await getSdk();
  return new AnthropicSdk({ apiKey: key, dangerouslyAllowBrowser: true });
}

/** Cheap key validation: fetch model metadata (no tokens billed). */
export async function testAIKey(
  provider: "anthropic" | "openai" | "gemini" | "minimax" | "kimi",
): Promise<{ ok: boolean; error?: string }> {
  const key = getProviderKey(provider);
  if (!key) return { ok: false, error: "No key entered." };
  try {
    if (provider === "anthropic") {
      const client = await anthropicClient();
      if (!client) return { ok: false, error: "No key entered." };
      const model = getAIConfig().model;
      await client.models.retrieve(model);
      return { ok: true };
    }
    if (provider === "gemini") {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
      const r = await fetch(url);
      return r.ok
        ? { ok: true }
        : { ok: false, error: `${r.status} ${r.statusText}`.slice(0, 200) };
    }
    // OpenAI-compat: a 1-token request to /v1/models is the cheapest test.
    const apiUrl =
      provider === "openai"
        ? "https://api.openai.com/v1/models"
        : provider === "minimax"
          ? "https://api.MiniMax.io/v1/models"
          : "https://api.moonshot.cn/v1/models";
    const r = await fetch(apiUrl, { headers: { Authorization: `Bearer ${key}` } });
    return r.ok
      ? { ok: true }
      : { ok: false, error: `${r.status} ${r.statusText}`.slice(0, 200) };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not reach the provider API.";
    return { ok: false, error: message.slice(0, 200) };
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/** Compact, model-legible board description for structured tasks. */
export function boardBrief(board: Board, opts?: { looseOnly?: boolean }): string {
  const divisions = Object.values(board.divisions);
  const cards = Object.values(board.cards)
    .filter((c) => !opts?.looseOnly || c.divisionId === null)
    .sort((a, b) => a.createdAt - b.createdAt);
  const links = Object.values(board.links);

  const lines: string[] = [];
  if (divisions.length > 0 && !opts?.looseOnly) {
    lines.push("Zones:");
    for (const d of divisions) lines.push(`- ${d.id}: ${d.name}`);
    lines.push("");
  }
  lines.push("Cards:");
  for (const c of cards) {
    const body = c.body ? ` — ${truncate(c.body, 200)}` : "";
    lines.push(`- ${c.id} [${c.type}] ${truncate(c.title, 120) || "Untitled"}${body}`);
  }
  if (links.length > 0 && !opts?.looseOnly) {
    lines.push("", "Existing links:");
    for (const l of links) lines.push(`- ${l.from} ${l.type} ${l.to}`);
  }
  return lines.join("\n");
}

const organizeSchema = z
  .object({
    groups: z.array(
      z.object({
        name: z.string(),
        cardIds: z.array(z.string()),
      }),
    ),
  });

const linksSchema = z
  .object({
    suggestions: z.array(
      z.object({
        from: z.string(),
        to: z.string(),
        type: z.enum(LINK_TYPES),
        reason: z.string(),
      }),
    ),
  });

const sparksSchema = z
  .object({
    questions: z.array(
      z.object({
        question: z.string(),
        answerType: z.enum(CARD_TYPES),
      }),
    ),
  });

// Lazily import zod so server bundles stay small.
import { z } from "zod/v4";

export class AnthropicProvider implements AIProvider {
  async organize(board: Board): Promise<OrganizePlan> {
    const client = await anthropicClient();
    const loose = Object.values(board.cards).filter(
      (c) => c.divisionId === null,
    );
    if (!client || loose.length < 2) return planOrganize(board);

    try {
      const { zodOutputFormat } = await getSdk();
      const { model } = getAIConfig();
      const response = await client.messages.parse({
        model,
        max_tokens: 16000,
        ...(model === "claude-opus-4-8"
          ? { thinking: { type: "adaptive" as const } }
          : {}),
        system:
          "You organize planning boards for people who think in scattered fragments. " +
          "Group the loose cards into 2-6 coherent, action-oriented zones. Zone names " +
          "are short (2-4 words), concrete, and title-cased. Every card id must appear " +
          "in exactly one group. Group by what the user is trying to accomplish, not " +
          "by card type.",
        messages: [
          {
            role: "user",
            content: `Group these loose cards into zones:\n\n${boardBrief(board, { looseOnly: true })}`,
          },
        ],
        output_config: { format: zodOutputFormat(organizeSchema) },
      });
      const parsed = response.parsed_output;
      if (!parsed || parsed.groups.length === 0) return planOrganize(board);

      const looseIds = new Set(loose.map((c) => c.id));
      const used = new Set<string>();
      const groups = parsed.groups
        .map((g) => ({
          name: g.name.trim().slice(0, 60) || "Group",
          cardIds: g.cardIds.filter((id) => {
            if (!looseIds.has(id) || used.has(id)) return false;
            used.add(id);
            return true;
          }),
        }))
        .filter((g) => g.cardIds.length > 0);
      const missed = [...looseIds].filter((id) => !used.has(id));
      if (missed.length > 0) {
        groups.push({ name: "Later / Unsorted", cardIds: missed });
      }
      if (groups.length === 0) return planOrganize(board);
      return layoutOrganizePlan(board, groups);
    } catch {
      return planOrganize(board);
    }
  }

  async suggestLinks(board: Board): Promise<LinkSuggestion[]> {
    const client = await anthropicClient();
    if (!client || Object.keys(board.cards).length < 2) {
      return localSuggestLinks(board);
    }
    try {
      const { zodOutputFormat } = await getSdk();
      const { model } = getAIConfig();
      const response = await client.messages.parse({
        model,
        max_tokens: 16000,
        ...(model === "claude-opus-4-8"
          ? { thinking: { type: "adaptive" as const } }
          : {}),
        system:
          "You find meaningful relationships between cards on a planning board. " +
          'Semantics: "A depends_on B" means B must happen before A. "A input_to B" ' +
          'means A feeds B. "related_to" is a neutral cross-reference. Suggest at ' +
          "most 6 links that would genuinely help sequence or connect the work — " +
          "skip the obvious and the trivial. Never suggest a link that already exists. " +
          "Each reason is one short sentence.",
        messages: [
          {
            role: "user",
            content: `Suggest links for this board:\n\n${boardBrief(board)}`,
          },
        ],
        output_config: { format: zodOutputFormat(linksSchema) },
      });
      const parsed = response.parsed_output;
      if (!parsed) return localSuggestLinks(board);

      const existing = new Set(
        Object.values(board.links).map((l) =>
          l.from < l.to ? `${l.from}|${l.to}` : `${l.to}|${l.from}`,
        ),
      );
      const seen = new Set<string>();
      const valid = parsed.suggestions.filter((s) => {
        if (s.from === s.to || !board.cards[s.from] || !board.cards[s.to]) {
          return false;
        }
        const key = s.from < s.to ? `${s.from}|${s.to}` : `${s.to}|${s.from}`;
        if (existing.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return valid
        .slice(0, 7)
        .map((s) => ({ ...s, score: 1, reason: truncate(s.reason, 120) }));
    } catch {
      return localSuggestLinks(board);
    }
  }

  async generateWorkflow(board: Board): Promise<WorkflowPlan> {
    return planWorkflow(board);
  }

  async sparkQuestions(
    board: Board,
    persona: Persona | null,
    templateId: string | null,
  ): Promise<SparkQuestion[]> {
    const client = await anthropicClient();
    if (!client) return generateSparks(board, persona, templateId);
    try {
      const { zodOutputFormat } = await getSdk();
      const { model } = getAIConfig();
      const response = await client.messages.parse({
        model,
        max_tokens: 4096,
        system:
          "You help someone think through a plan by asking exactly 3 sharp, specific " +
          "questions about what's missing from their board — unstated assumptions, " +
          "missing prerequisites, undefined success criteria. Questions must be " +
          "answerable in a sentence or two and reference their actual content. " +
          `${persona ? `The user is a ${persona}. ` : ""}Never ask something the board already answers.`,
        messages: [
          {
            role: "user",
            content: `What's missing from this board?\n\n${boardBrief(board)}`,
          },
        ],
        output_config: { format: zodOutputFormat(sparksSchema) },
      });
      const parsed = response.parsed_output;
      if (!parsed || parsed.questions.length === 0) {
        return generateSparks(board, persona, templateId);
      }
      return parsed.questions.slice(0, 3).map((q) => ({
        id: `ai-${slug(q.question)}`,
        question: truncate(q.question.trim(), 200),
        answerType: q.answerType,
        divisionId: null,
      }));
    } catch {
      return generateSparks(board, persona, templateId);
    }
  }
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}