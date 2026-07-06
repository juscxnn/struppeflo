import type { Board, CardType, Persona } from "@/lib/types";

/**
 * Output kinds that a template zone can produce. The Run panel renders each
 * zone's output in its declared kind (heading as a section, checklist as a
 * checklist, timeline as a vertical timeline, etc.).
 */
export type OutputKind =
  | "heading"
  | "paragraph"
  | "checklist"
  | "timeline"
  | "table";

export interface ZoneSpec {
  /** Display name shown in the template gallery and on the zone. */
  name: string;
  /** What kind of structure the output should take. */
  outputKind: OutputKind;
  /** Card types appropriate for this zone (guides the user when adding cards). */
  cardTypes: CardType[];
  /** One-line placeholder shown when the zone is empty. */
  placeholder: string;
  /** Optional hint shown in the gallery and on the zone header. */
  hint?: string;
}

/**
 * Parsed output of an AI run, attributed to the template's zones by name
 * match. The Run panel renders one block per zone.
 */
export interface DeliverableSection {
  zoneName: string;
  outputKind: OutputKind;
  /** Markdown content of the section. The renderer interprets per kind. */
  markdown: string;
  /** Parsed shape depending on kind — used by the structured renderer. */
  items?: string[];
  rows?: string[][];
}

export interface StructuredDeliverable {
  title: string;
  /** Section in order of the template's declared zones. */
  sections: DeliverableSection[];
  /** Anything the model emitted that didn't map to a zone. */
  leftover: string;
}

/** Per-template declaration. */
export interface Template {
  id: string;
  name: string;
  tagline: string;
  /** Who this template is for. */
  persona: Persona;
  /** The zone structure the user fills in. Order = execution order. */
  zones: ZoneSpec[];
  /**
   * One-line specific instruction injected into the prompt. This is the
   * template's actual "what should the model do" — not a generic placeholder.
   * Example: "Produce a launch plan with positioning, audience, channels,
   * timeline, and risks. Use the cards in each zone as your source material."
   */
  instruction: string;
  /**
   * System-prompt contract for this template. Tells the model what format
   * and depth to use. Tailored per template.
   */
  systemPrompt: string;
  /** Returns a board seeded with the template's zones and example cards. */
  instantiate: () => Board;
  /** Parses the model's output text into the structured deliverable shape. */
  renderOutput: (text: string) => StructuredDeliverable;
}