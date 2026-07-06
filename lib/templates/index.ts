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

/* Zone specs for each template. Order = execution order. */

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

function makeRender(zones: ZoneSpec[]) {
  return (text: string) => ({
    ...renderStructuredDeliverable(text, zones),
    toMarkdown: () => "", // not used; see deliverableToMarkdown below
  });
}

// We expose a single render that returns the structured deliverable.
// The UI uses deliverableToMarkdown for export.

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
    instantiate: gtm,
    renderOutput: render(GTM_ZONES),
  },
  {
    id: "product-spec",
    name: "Product spec (PRD)",
    tagline: "Problem to acceptance criteria, with risks stated.",
    persona: "pm",
    zones: PRD_ZONES,
    instantiate: productSpec,
    renderOutput: render(PRD_ZONES),
  },
  {
    id: "research",
    name: "Research synthesis",
    tagline: "Question, evidence, themes, conclusions.",
    persona: "researcher",
    zones: RESEARCH_ZONES,
    instantiate: research,
    renderOutput: render(RESEARCH_ZONES),
  },
  {
    id: "content-pipeline",
    name: "Content pipeline",
    tagline: "From idea to published piece.",
    persona: "generalist",
    zones: CONTENT_ZONES,
    instantiate: contentPipeline,
    renderOutput: render(CONTENT_ZONES),
  },
  {
    id: "triage",
    name: "Brain-dump triage",
    tagline: "A messy pile, ready for one-click AI Organize.",
    persona: "generalist",
    zones: TRIAGE_ZONES,
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

// quiet "unused" for makeRender helper if not used.
void makeRender;