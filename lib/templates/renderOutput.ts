/**
 * Parses a model's free-form markdown output into a structured deliverable
 * keyed by template zone names. Robust to: missing zones, extra sections,
 * empty output, headings with numbering like "## 1. Positioning".
 *
 * Lenient heading detection: ATX (# to ####), Setext (=== and --- underlines),
 * and aggressive stripping of model preambles ("Sure!", "Here's your…", etc.).
 */

import type { OutputKind, StructuredDeliverable, ZoneSpec } from "./outputSchema";

/**
 * Preamble lines models tend to emit at the very top of their output. We strip
 * them so the deliverable starts at the first real heading. Case-insensitive,
 * anchored to the start of the line, and tolerant of a few words after.
 */
const PREAMBLE_PATTERNS: RegExp[] = [
  /^\s*(?:Sure|Of course|Certainly|Absolutely|Great|OK(?:ay)?|Alright|Alrighty|Perfect|Excellent|Sounds good)[!.,]?\s/i,
  /^\s*Here(?:'s| is) (?:your|the|a|an|my)\b/i,
  /^\s*I(?:'d| would) be (?:happy|glad) to\b/i,
  /^\s*Happy to help\b/i,
  /^\s*(?:Let me|Allow me to|I(?:'ll| will))\b.*\b(?:draft|put|write|build|knock|put together|compile|generate|create)\b/i,
  /^\s*Below is\b/i,
];

/**
 * Normalize Setext-style headings ("Title\n===" or "Title\n---") into ATX
 * ("# Title" / "## Title") so the main parser can treat them uniformly. The
 * key invariant: a Setext underline only fires when the previous line has
 * actual text on it, so a bare `---` horizontal rule on its own line is left
 * alone.
 */
function normalizeSetext(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    if (
      next !== undefined &&
      line.trim() !== "" &&
      /^=+$/.test(next.trim()) &&
      !/^#{1,6}\s/.test(line.trim())
    ) {
      out.push(`# ${line.trim()}`);
      i++;
      continue;
    }
    if (
      next !== undefined &&
      line.trim() !== "" &&
      /^-{3,}$/.test(next.trim()) &&
      !/^#{1,6}\s/.test(line.trim())
    ) {
      out.push(`## ${line.trim()}`);
      i++;
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

/**
 * Strip model preambles from the top of the text. Walks non-empty lines until
 * it hits a heading or a line that doesn't look like a preamble. The intent
 * is to never modify body text — only discard noise above the first heading.
 */
function stripPreamble(text: string): string {
  const lines = text.split("\n");
  let i = 0;
  // Skip leading blank lines.
  while (i < lines.length && lines[i].trim() === "") i++;
  // Skip preamble-like lines.
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "") {
      i++;
      continue;
    }
    if (/^#{1,6}\s/.test(trimmed)) break;
    if (PREAMBLE_PATTERNS.some((p) => p.test(trimmed))) {
      i++;
      continue;
    }
    break;
  }
  return lines.slice(i).join("\n");
}

function normalizeHeading(s: string): string {
  return s
    .replace(/^\s*#{1,6}\s*/, "")
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

function extractSections(
  text: string,
): Array<{ heading: string; body: string }> {
  const lines = text.split("\n");
  const sections: Array<{ heading: string; body: string }> = [];
  let current: { heading: string; body: string[] } | null = null;
  for (const line of lines) {
    const m = line.match(/^\s*#{1,4}\s+(.+?)\s*$/);
    if (m) {
      if (current)
        sections.push({ heading: current.heading, body: current.body.join("\n") });
      current = { heading: m[1], body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current)
    sections.push({ heading: current.heading, body: current.body.join("\n") });
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
  const cleaned = stripPreamble(normalizeSetext(text));
  const sections = extractSections(cleaned);
  const title = options?.title ?? extractTitle(cleaned);
  const titleNormalized = title.trim().toLowerCase();

  const usedZones = new Set<string>();
  const out: StructuredDeliverable = {
    title,
    sections: zones.map((z) => ({
      zoneName: z.name,
      outputKind: z.outputKind,
      markdown: "",
    })),
    leftover: "",
  };

  const leftoverParts: string[] = [];

  for (const { heading, body } of sections) {
    // The title is rendered as its own block; don't echo it as a leftover
    // section, otherwise the user sees the title twice (once as the heading,
    // once in the "Other" block).
    if (
      titleNormalized !== "" &&
      heading.trim().toLowerCase() === titleNormalized
    ) {
      continue;
    }
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

  // Recovery fallback: when the model returned prose with no recognizable
  // section headings, the section list is empty and the deliverable would
  // render as N empty placeholders. Surface the full cleaned text as
  // `leftover` so the structured renderer can show it in a raw fallback view.
  if (sections.length === 0 && cleaned.trim().length > 0) {
    out.leftover = cleaned.trim();
    return out;
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
