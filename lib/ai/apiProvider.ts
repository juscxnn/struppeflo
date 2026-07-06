import type {
  AIProvider,
  Board,
  LinkSuggestion,
  OrganizePlan,
  Persona,
  SparkQuestion,
  WorkflowPlan,
} from "@/lib/types";
import { generateSparks } from "./sparks";

async function post<T>(url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? res.statusText);
  }
  return (await res.json()) as T;
}

/**
 * Backend seam for a real AI provider (e.g. the Anthropic API behind the
 * /api/ai/* routes). NOT used in v1 — the routes are 501 stubs and the app
 * ships with MockAIProvider; select this class by setting
 * NEXT_PUBLIC_AI_PROVIDER=api once the routes are implemented.
 */
export class ApiAIProvider implements AIProvider {
  organize(board: Board): Promise<OrganizePlan> {
    return post<OrganizePlan>("/api/ai/organize", { board });
  }

  suggestLinks(board: Board): Promise<LinkSuggestion[]> {
    return post<LinkSuggestion[]>("/api/ai/suggest-links", { board });
  }

  generateWorkflow(board: Board): Promise<WorkflowPlan> {
    return post<WorkflowPlan>("/api/ai/workflow", { board });
  }

  async sparkQuestions(
    board: Board,
    persona: Persona | null,
    templateId: string | null,
  ): Promise<SparkQuestion[]> {
    // Sparks stay local even in api mode: they're cheap deterministic
    // heuristics with no model in the loop, so a network hop buys nothing.
    return generateSparks(board, persona, templateId);
  }
}
