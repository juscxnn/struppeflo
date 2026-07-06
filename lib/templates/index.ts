import type { Board, Persona } from "@/lib/types";
import { instantiate as gtm } from "./gtm";
import { instantiate as research } from "./research";
import { instantiate as productSpec } from "./productSpec";
import { instantiate as contentPipeline } from "./contentPipeline";
import { instantiate as triage } from "./triage";

export type TemplateId =
  | "gtm"
  | "research"
  | "product-spec"
  | "content-pipeline"
  | "triage";

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  tagline: string;
  personaAffinity: Persona[];
  instantiate: () => Board;
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "gtm",
    name: "Go-to-market plan",
    tagline: "From market research to launch day, one connected flow.",
    personaAffinity: ["founder", "pm"],
    instantiate: gtm,
  },
  {
    id: "research",
    name: "Research project",
    tagline: "Question, evidence, synthesis — with disconfirmation built in.",
    personaAffinity: ["researcher", "student"],
    instantiate: research,
  },
  {
    id: "product-spec",
    name: "Product spec",
    tagline: "Problem to MVP scope, with the risks stated out loud.",
    personaAffinity: ["pm", "founder"],
    instantiate: productSpec,
  },
  {
    id: "content-pipeline",
    name: "Content pipeline",
    tagline: "Ideas move left to right until they're published.",
    personaAffinity: ["generalist", "founder"],
    instantiate: contentPipeline,
  },
  {
    id: "triage",
    name: "Brain-dump triage",
    tagline: "A messy pile of thoughts, ready for one-click AI Organize.",
    personaAffinity: ["generalist", "student"],
    instantiate: triage,
  },
];

export function instantiateTemplate(id: TemplateId): Board {
  const meta = TEMPLATES.find((t) => t.id === id);
  if (!meta) throw new Error(`Unknown template id: ${id}`);
  return meta.instantiate();
}
