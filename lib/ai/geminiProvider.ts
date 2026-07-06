"use client";

import { getProviderKey, getAIConfig } from "../aiConfig";
import { boardBrief } from "./anthropicProvider";
import { layoutOrganizePlan } from "./layout";
import { planOrganize } from "./cluster";
import { suggestLinks as localSuggestLinks } from "./linkSuggest";
import { planWorkflow } from "./workflow";
import { generateSparks } from "./sparks";
import { CARD_TYPES, LINK_TYPES } from "../types";
import type {
  AIProvider,
  Board,
  LinkSuggestion,
  OrganizePlan,
  Persona,
  SparkQuestion,
  WorkflowPlan,
} from "../types";

/**
 * Google Gemini provider. Uses :generateContent with responseSchema for
 * structured output. Browser CORS works because Google exposes the API on a
 * CORS-permissive origin and the key is passed as a query parameter.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface GenPart {
  text?: string;
}

interface GenResponse {
  candidates?: Array<{
    content?: { parts?: GenPart[] };
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

async function callGemini(
  model: string,
  system: string,
  user: string,
  schema: Record<string, unknown>,
): Promise<{ json: unknown; usage: { inputTokens: number; outputTokens: number } } | null> {
  const key = getProviderKey("gemini");
  if (!key) return null;
  const url = `${API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      maxOutputTokens: 8192,
    },
  };
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as GenResponse;
    const text = j.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return {
      json: JSON.parse(text),
      usage: {
        inputTokens: j.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: j.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  } catch {
    return null;
  }
}

const ORGANIZE_SCHEMA = {
  type: "object",
  properties: {
    groups: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          cardIds: { type: "array", items: { type: "string" } },
        },
        required: ["name", "cardIds"],
      },
    },
  },
  required: ["groups"],
} as const;

const LINKS_SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          type: { type: "string", enum: LINK_TYPES },
          reason: { type: "string" },
        },
        required: ["from", "to", "type", "reason"],
      },
    },
  },
  required: ["suggestions"],
} as const;

const SPARKS_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          answerType: { type: "string", enum: CARD_TYPES },
        },
        required: ["question", "answerType"],
      },
    },
  },
  required: ["questions"],
} as const;

function systemPrompt(kind: "organize" | "links" | "sparks", persona: Persona | null): string {
  if (kind === "organize") {
    return (
      "You organize planning boards for people who think in scattered fragments. " +
      "Group the loose cards into 2-6 coherent, action-oriented zones. Zone names " +
      "are short (2-4 words), concrete, and title-cased. Every card id must appear " +
      "in exactly one group. Group by what the user is trying to accomplish, not " +
      "by card type."
    );
  }
  if (kind === "links") {
    return (
      "You find meaningful relationships between cards on a planning board. " +
      '"A depends_on B" means B must happen before A. "A input_to B" means A feeds B. ' +
      '"related_to" is a neutral cross-reference. Suggest at most 6 links that would ' +
      "genuinely help sequence or connect the work. Never suggest a link that already " +
      "exists. Each reason is one short sentence."
    );
  }
  return (
    "You help someone think through a plan by asking exactly 3 sharp, specific " +
    "questions about what's missing from their board — unstated assumptions, missing " +
    "prerequisites, undefined success criteria. Questions must be answerable in a " +
    "sentence or two and reference their actual content. " +
    `${persona ? `The user is a ${persona}. ` : ""}` +
    "Never ask something the board already answers."
  );
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export class GeminiProvider implements AIProvider {
  async organize(board: Board): Promise<OrganizePlan> {
    const loose = Object.values(board.cards).filter((c) => c.divisionId === null);
    if (loose.length < 2) return planOrganize(board);
    const { model } = getAIConfig();
    const r = await callGemini(
      model,
      systemPrompt("organize", null),
      `Group these loose cards into zones:\n\n${boardBrief(board, { looseOnly: true })}`,
      ORGANIZE_SCHEMA,
    );
    if (!r) return planOrganize(board);
    const parsed = r.json as { groups?: Array<{ name: string; cardIds: string[] }> };
    if (!parsed.groups || parsed.groups.length === 0) return planOrganize(board);
    const looseIds = new Set(loose.map((c) => c.id));
    const used = new Set<string>();
    const groups = parsed.groups
      .map((g) => ({
        name: (g.name || "Group").trim().slice(0, 60) || "Group",
        cardIds: g.cardIds.filter((id) => {
          if (!looseIds.has(id) || used.has(id)) return false;
          used.add(id);
          return true;
        }),
      }))
      .filter((g) => g.cardIds.length > 0);
    const missed = [...looseIds].filter((id) => !used.has(id));
    if (missed.length > 0) groups.push({ name: "Later / Unsorted", cardIds: missed });
    if (groups.length === 0) return planOrganize(board);
    return layoutOrganizePlan(board, groups);
  }

  async suggestLinks(board: Board): Promise<LinkSuggestion[]> {
    if (Object.keys(board.cards).length < 2) return localSuggestLinks(board);
    const { model } = getAIConfig();
    const r = await callGemini(
      model,
      systemPrompt("links", null),
      `Suggest links for this board:\n\n${boardBrief(board)}`,
      LINKS_SCHEMA,
    );
    if (!r) return localSuggestLinks(board);
    const parsed = r.json as {
      suggestions?: Array<{ from: string; to: string; type: (typeof LINK_TYPES)[number]; reason: string }>;
    };
    if (!parsed.suggestions) return localSuggestLinks(board);
    const existing = new Set(
      Object.values(board.links).map((l) =>
        l.from < l.to ? `${l.from}|${l.to}` : `${l.to}|${l.from}`,
      ),
    );
    const seen = new Set<string>();
    const valid = parsed.suggestions.filter((s) => {
      if (s.from === s.to || !board.cards[s.from] || !board.cards[s.to]) return false;
      const key = s.from < s.to ? `${s.from}|${s.to}` : `${s.to}|${s.from}`;
      if (existing.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return valid
      .slice(0, 7)
      .map((s) => ({
        from: s.from,
        to: s.to,
        type: s.type,
        score: 1,
        reason: s.reason.length > 120 ? `${s.reason.slice(0, 120)}…` : s.reason,
      }));
  }

  async generateWorkflow(board: Board): Promise<WorkflowPlan> {
    return planWorkflow(board);
  }

  async sparkQuestions(
    board: Board,
    persona: Persona | null,
    templateId: string | null,
  ): Promise<SparkQuestion[]> {
    const { model } = getAIConfig();
    const r = await callGemini(
      model,
      systemPrompt("sparks", persona),
      `What's missing from this board?\n\n${boardBrief(board)}`,
      SPARKS_SCHEMA,
    );
    if (!r) return generateSparks(board, persona, templateId);
    const parsed = r.json as {
      questions?: Array<{ question: string; answerType: (typeof CARD_TYPES)[number] }>;
    };
    if (!parsed.questions || parsed.questions.length === 0) {
      return generateSparks(board, persona, templateId);
    }
    return parsed.questions.slice(0, 3).map((q) => ({
      id: `ai-${slug(q.question)}`,
      question: q.question.trim().slice(0, 200),
      answerType: q.answerType,
      divisionId: null,
    }));
  }
}