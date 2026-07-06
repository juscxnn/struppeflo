/**
 * Parses a model's free-form markdown output into a structured deliverable
 * keyed by template zone names. Robust to: missing zones, extra sections,
 * empty output, headings with numbering like "## 1. Positioning".
 */

import type { OutputKind, StructuredDeliverable, ZoneSpec } from "./outputSchema";

function normalizeHeading(s: string): string {
  return s
    .replace(/^\s*#{1,3}\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function matchZone(heading: string, zones: ZoneSpec[]): ZoneSpec | null {
  const norm = normalizeHeading(heading);
  // Exact match first.
  for (const z of zones) {
    if (normalizeHeading(z.name) === norm) return z;
  }
  // Then containment match (e.g., "Positioning the product" → "Positioning").
  for (const z of zones) {
    const zNorm = normalizeHeading(z.name);
    if (zNorm && (norm.includes(zNorm) || zNorm.includes(norm))) return z;
  }
  return null;
}

function extractSections(text: string): Array<{ heading: string; body: string }> {
  const lines = text.split("\n");
  const sections: Array<{ heading: string; body: string }> = [];
  let current: { heading: string; body: string[] } | null = null;
  for (const line of lines) {
    const m = line.match(/^\s*#{1,3}\s+(.+?)\s*$/);
    if (m) {
      if (current) sections.push({ heading: current.heading, body: current.body.join("\n") });
      current = { heading: m[1], body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) sections.push({ heading: current.heading, body: current.body.join("\n") });
  return sections;
}

function extractTitle(text: string): string {
  const m = text.match(/^\s*#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : "";
}

function itemsFromBody(body: string): string[] {
  const out: string[] = [];
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*(?:[-*+]|\d+\.)\s+(.+?)\s*$/);
    if (m) out.push(m[1].trim());
  }
  return out;
}

function rowsFromBody(body: string): string[][] {
  const rows: string[][] = [];
  for (const line of body.split("\n")) {
    if (!line.includes("|")) continue;
    if (/^\s*\|?[\s\-:|]+\|?\s*$/.test(line)) continue; // separator row
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length > 1) rows.push(cells);
  }
  return rows;
}

export function renderStructuredDeliverable(
  text: string,
  zones: ZoneSpec[],
  options?: { title?: string },
): StructuredDeliverable {
  const sections = extractSections(text);
  const title = options?.title ?? extractTitle(text);

  const usedZones = new Set<string>();
  const out: StructuredDeliverable = {
    title,
    sections: zones.map((z) => ({ zoneName: z.name, outputKind: z.outputKind, markdown: "" })),
    leftover: "",
  };

  const leftoverParts: string[] = [];

  for (const { heading, body } of sections) {
    const matched = matchZone(heading, zones);
    if (!matched || usedZones.has(matched.name)) {
      leftoverParts.push(`## ${heading}\n${body}`);
      continue;
    }
    usedZones.add(matched.name);
    const idx = out.sections.findIndex((s) => s.zoneName === matched.name);
    if (idx >= 0) {
      out.sections[idx].markdown = body.trim();
      if (matched.outputKind === "checklist") {
        out.sections[idx].items = itemsFromBody(body);
      } else if (matched.outputKind === "table") {
        out.sections[idx].rows = rowsFromBody(body);
      }
    }
  }

  out.leftover = leftoverParts.join("\n\n").trim();
  return out;
}

/** Pretty markdown export of a deliverable — what users copy to Notion/etc. */
export function deliverableToMarkdown(d: StructuredDeliverable): string {
  const parts: string[] = [];
  if (d.title) parts.push(`# ${d.title}\n`);
  for (const s of d.sections) {
    parts.push(`## ${s.zoneName}\n`);
    if (s.markdown.trim()) {
      parts.push(s.markdown.trim());
    } else {
      parts.push(`_(no output for this section)_`);
    }
    parts.push("");
  }
  if (d.leftover) {
    parts.push(`## Notes\n${d.leftover}`);
  }
  return parts.join("\n").trim() + "\n";
}

export type { OutputKind, StructuredDeliverable, ZoneSpec };