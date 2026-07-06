import type {
  AIProvider,
  Board,
  LinkSuggestion,
  OrganizePlan,
  Persona,
  SparkQuestion,
  WorkflowPlan,
} from "@/lib/types";
import { planOrganize } from "./cluster";
import { suggestLinks } from "./linkSuggest";
import { generateSparks } from "./sparks";
import { planWorkflow } from "./workflow";

// Fixed delay so the UI reads as "thinking"; results stay pure functions of input.
const THINKING_MS = 400;

function think(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, THINKING_MS));
}

export class MockAIProvider implements AIProvider {
  async organize(board: Board): Promise<OrganizePlan> {
    await think();
    return planOrganize(board);
  }

  async suggestLinks(board: Board): Promise<LinkSuggestion[]> {
    await think();
    return suggestLinks(board);
  }

  async generateWorkflow(board: Board): Promise<WorkflowPlan> {
    await think();
    return planWorkflow(board);
  }

  async sparkQuestions(
    board: Board,
    persona: Persona | null,
    templateId: string | null,
  ): Promise<SparkQuestion[]> {
    await think();
    return generateSparks(board, persona, templateId);
  }
}
