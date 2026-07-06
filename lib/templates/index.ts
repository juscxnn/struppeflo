import type { Board, Persona } from "@/lib/types";
import { instantiate as gtm } from "./gtm";
import { instantiate as research } from "./research";
import { instantiate as productSpec } from "./productSpec";
import { instantiate as contentPipeline } from "./contentPipeline";
import { instantiate as triage } from "./triage";
import {
  renderStructuredDeliverable,
  deliverableToMarkdown,
} from "./renderOutput";
import type { Template, ZoneSpec } from "./outputSchema";

export type TemplateId =
  | "gtm"
  | "research"
  | "product-spec"
  | "content-pipeline"
  | "triage";

/* -------------------- Zone specs -------------------- */

const GTM_ZONES: ZoneSpec[] = [
  {
    name: "Research",
    outputKind: "paragraph",
    cardTypes: ["note", "resource", "question"],
    placeholder: "Who are we selling to and what do they pay for today?",
    hint: "ICP, competitor notes, market questions.",
  },
  {
    name: "Positioning",
    outputKind: "paragraph",
    cardTypes: ["insight", "note", "task"],
    placeholder: "What's the one sentence we want buyers to repeat?",
    hint: "Value prop, positioning statement, landing copy.",
  },
  {
    name: "Channels",
    outputKind: "checklist",
    cardTypes: ["task", "resource"],
    placeholder: "Where do we reach buyers and what do we publish there?",
    hint: "Newsletter, threads, pilots.",
  },
  {
    name: "Launch",
    outputKind: "checklist",
    cardTypes: ["task", "question"],
    placeholder: "What needs to be true on launch day?",
    hint: "Date, Product Hunt, success criteria.",
  },
];

const PRD_ZONES: ZoneSpec[] = [
  {
    name: "Problem",
    outputKind: "paragraph",
    cardTypes: ["note", "insight"],
    placeholder: "What's broken today, and for whom?",
    hint: "User pain, evidence, scope.",
  },
  {
    name: "Users",
    outputKind: "paragraph",
    cardTypes: ["note", "question"],
    placeholder: "Who hits this problem most?",
    hint: "Personas, segments, edge cases.",
  },
  {
    name: "Requirements",
    outputKind: "checklist",
    cardTypes: ["task", "resource"],
    placeholder: "What does the solution have to do?",
    hint: "Functional must-haves.",
  },
  {
    name: "Acceptance Criteria",
    outputKind: "checklist",
    cardTypes: ["task"],
    placeholder: "How do we know each requirement is met?",
    hint: "Testable conditions.",
  },
  {
    name: "Open Questions",
    outputKind: "paragraph",
    cardTypes: ["question"],
    placeholder: "What are we still unsure about?",
    hint: "Decisions to make, risks to track.",
  },
];

const RESEARCH_ZONES: ZoneSpec[] = [
  {
    name: "Question",
    outputKind: "paragraph",
    cardTypes: ["note", "question"],
    placeholder: "What's the research question?",
    hint: "Hypothesis, scope, what counts as an answer.",
  },
  {
    name: "Evidence",
    outputKind: "table",
    cardTypes: ["resource", "note"],
    placeholder: "What sources / data points do you have?",
    hint: "Papers, interviews, observations.",
  },
  {
    name: "Themes",
    outputKind: "checklist",
    cardTypes: ["insight"],
    placeholder: "What patterns emerge across the evidence?",
    hint: "Recurring ideas, contrasts.",
  },
  {
    name: "Synthesis",
    outputKind: "paragraph",
    cardTypes: ["insight", "task"],
    placeholder: "What does the evidence say, taken together?",
    hint: "Conclusions, recommendations.",
  },
];

const CONTENT_ZONES: ZoneSpec[] = [
  {
    name: "Idea",
    outputKind: "paragraph",
    cardTypes: ["note", "insight"],
    placeholder: "What's the angle?",
  },
  {
    name: "Outline",
    outputKind: "checklist",
    cardTypes: ["task"],
    placeholder: "What's the structure?",
  },
  {
    name: "Draft",
    outputKind: "paragraph",
    cardTypes: ["task", "resource"],
    placeholder: "First pass.",
  },
  {
    name: "Edit",
    outputKind: "checklist",
    cardTypes: ["task", "question"],
    placeholder: "What needs tightening?",
  },
  {
    name: "Publish",
    outputKind: "checklist",
    cardTypes: ["task"],
    placeholder: "Where and when does it go out?",
  },
];

const TRIAGE_ZONES: ZoneSpec[] = [
  {
    name: "Loose thoughts",
    outputKind: "checklist",
    cardTypes: ["note", "task", "question", "insight", "resource"],
    placeholder: "Drop them all here. Then click Organize.",
  },
];

/* -------------------- Per-template instructions + system prompts -------------------- */
/* The instruction is what the user MEANS to do. The system prompt is the
 * contract that gets the model to produce it well. They are tightly paired
 * and template-specific. */

const GTM_INSTRUCTION =
  "Write the launch plan I can hand to my team on Monday. Pull from the cards I dropped — use them as the raw material. Be specific to my situation, not generic.";

const GTM_SYSTEM = `You write launch plans for early-stage founders. The user has dropped their actual research, positioning, channels, and launch checklist onto a canvas. Each zone on their board is a section of the plan they need.

Output format (strict):
- Title: a short, specific name for this launch.
- Then one markdown heading per zone, in this exact order: ## Research, ## Positioning, ## Channels, ## Launch.
- Inside each heading, write the section content using the cards in that zone as your source. Use their content verbatim where useful, paraphrase where it improves clarity.
- For checklist zones (Channels, Launch), use a bulleted list with concrete actions — verbs at the start, owners if mentioned, dates if mentioned.
- For paragraph zones (Research, Positioning), use prose. Lead with the most important sentence.
- Be specific to their situation. Reference their actual cards. No generic advice.
- If a zone has no cards, write one line: "_No notes yet — fill in the cards on the board to flesh this out._"
- Keep total length tight. A launch plan that nobody reads is useless.`;

const PRD_INSTRUCTION =
  "Write the PRD my engineering team can start against. Use the cards I dropped on the board as the source. Don't pad it with generic advice.";

const PRD_SYSTEM = `You write product specs for engineers. The user has dropped their problem statement, users, requirements, acceptance criteria, and open questions onto a canvas.

Output format (strict):
- Title: the feature or product name.
- Then one markdown heading per zone, in this exact order: ## Problem, ## Users, ## Requirements, ## Acceptance Criteria, ## Open Questions.
- Inside each heading, write the section using the cards in that zone as your source.
- Problem + Users: prose. Lead with the most important sentence.
- Requirements: bulleted checklist. Each line MUST start with MUST, SHOULD, or COULD so the team can sort later.
- Acceptance Criteria: bulleted checklist. Each item must be testable — describe the observable condition that proves it works.
- Open Questions: prose paragraph. State each question clearly and call out what decision is blocking on it.
- Be specific to their product. No filler. No "this is a placeholder" lines.`;

const RESEARCH_INSTRUCTION =
  "Synthesize the evidence I dropped on the board into a literature synthesis I can share with my co-authors. Be honest about what's weak.";

const RESEARCH_SYSTEM = `You write research syntheses. The user has dropped a research question, evidence sources, themes, and synthesis notes onto a canvas.

Output format (strict):
- Title: the research question or topic, in plain English.
- Then one markdown heading per zone, in this exact order: ## Question, ## Evidence, ## Themes, ## Synthesis.
- Question: prose. State the question, the hypotheses, and what would count as an answer.
- Evidence: a markdown table with columns Source | Year | Population | Effect / Finding | Risk of bias. One row per evidence card. Keep cells short.
- Themes: bulleted checklist. Each theme is one pattern that emerges across the evidence.
- Synthesis: prose. What does the evidence support, what stays open, and the single most informative next experiment.
- Be honest about weak evidence and disconfirming cases. The user values honesty over false confidence.`;

const CONTENT_INSTRUCTION =
  "Write this content piece based on the cards I dropped on the board. Don't pad it. Match the tone of my idea card.";

const CONTENT_SYSTEM = `You write content pieces. The user has dropped an idea, outline, draft notes, edits, and publishing plan onto a canvas.

Output format (strict):
- Title: the working title of the piece.
- Then one markdown heading per zone, in this exact order: ## Idea, ## Outline, ## Draft, ## Edit, ## Publish.
- Idea: prose. Capture the angle in two or three sentences.
- Outline: bulleted checklist. One bullet per section/beat.
- Draft: prose. Write the first full pass of the piece. Length matches the request.
- Edit: bulleted checklist. Concrete edits to make — line-level or structural.
- Publish: bulleted checklist. Where it goes, when, who reviews.
- Match the tone set by the Idea card. Don't over-write.`;

const TRIAGE_INSTRUCTION =
  "Look at the loose thoughts I dropped and group them into themes. Suggest names for each group.";

const TRIAGE_SYSTEM = `You triage unstructured brain dumps. The user has dropped a pile of loose cards onto a single zone.

Output format: a single bulleted checklist. Each bullet is one themed group, with the format: "- **Group name** — short description of what binds these together". Use the cards on the board as the only source. Don't invent themes. If everything is one theme, say so.`;

function render(zones: ZoneSpec[]) {
  return (text: string) => renderStructuredDeliverable(text, zones);
}

export const TEMPLATES: Template[] = [
  {
    id: "gtm",
    name: "Launch plan",
    tagline: "From research to launch day, structured.",
    persona: "founder",
    zones: GTM_ZONES,
    instruction: GTM_INSTRUCTION,
    systemPrompt: GTM_SYSTEM,
    instantiate: gtm,
    renderOutput: render(GTM_ZONES),
  },
  {
    id: "product-spec",
    name: "Product spec (PRD)",
    tagline: "Problem to acceptance criteria, with risks stated.",
    persona: "pm",
    zones: PRD_ZONES,
    instruction: PRD_INSTRUCTION,
    systemPrompt: PRD_SYSTEM,
    instantiate: productSpec,
    renderOutput: render(PRD_ZONES),
  },
  {
    id: "research",
    name: "Research synthesis",
    tagline: "Question, evidence, themes, conclusions.",
    persona: "researcher",
    zones: RESEARCH_ZONES,
    instruction: RESEARCH_INSTRUCTION,
    systemPrompt: RESEARCH_SYSTEM,
    instantiate: research,
    renderOutput: render(RESEARCH_ZONES),
  },
  {
    id: "content-pipeline",
    name: "Content pipeline",
    tagline: "From idea to published piece.",
    persona: "generalist",
    zones: CONTENT_ZONES,
    instruction: CONTENT_INSTRUCTION,
    systemPrompt: CONTENT_SYSTEM,
    instantiate: contentPipeline,
    renderOutput: render(CONTENT_ZONES),
  },
  {
    id: "triage",
    name: "Brain-dump triage",
    tagline: "A messy pile, ready for one-click AI Organize.",
    persona: "generalist",
    zones: TRIAGE_ZONES,
    instruction: TRIAGE_INSTRUCTION,
    systemPrompt: TRIAGE_SYSTEM,
    instantiate: triage,
    renderOutput: render(TRIAGE_ZONES),
  },
];

export function instantiateTemplate(id: TemplateId): Board {
  const meta = TEMPLATES.find((t) => t.id === id);
  if (!meta) throw new Error(`Unknown template id: ${id}`);
  return meta.instantiate();
}

export function getTemplate(id: TemplateId): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export { deliverableToMarkdown };