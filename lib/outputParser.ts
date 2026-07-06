/**
 * Lightweight markdown parser for splitting run output into cards.
 * Detects top-level headings as section boundaries and bullet items as
 * individual cards within a section.
 */

export interface ParsedSection {
  name: string;
  items: ParsedItem[];
}

export interface ParsedItem {
  /** Markdown content of the item, trimmed of leading bullet/number. */
  text: string;
}

/**
 * Walks the markdown and produces sections. Sections are top-level headings
 * (no leading spaces, "## " or "# "). Items within a section are bullets and
 * numbered lists. Anything else (paragraphs under a heading) becomes a single
 * freeform card with the heading as a prefix.
 */
export function parseOutputAsCards(markdown: string): ParsedSection[] {
  const lines = markdown.split("\n");
  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;
  let buffer: string[] = [];

  const flushBuffer = () => {
    if (!current || buffer.length === 0) {
      buffer = [];
      return;
    }
    const text = buffer.join("\n").trim();
    if (text) current.items.push({ text });
    buffer = [];
  };

  for (const line of lines) {
    const heading = line.match(/^#{1,2}\s+(.+?)\s*$/);
    if (heading) {
      flushBuffer();
      current = { name: heading[1].trim(), items: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      // No heading yet — skip until we hit one. The board will still get one
      // catch-all card at the end if anything is left over.
      continue;
    }
    const bullet = line.match(/^\s*(?:[-*+]|\d+\.)\s+(.+)$/);
    if (bullet) {
      flushBuffer();
      current.items.push({ text: bullet[1].trim() });
      continue;
    }
    if (line.trim().length === 0) {
      flushBuffer();
      continue;
    }
    buffer.push(line);
  }
  flushBuffer();

  // If the output had no headings, synthesize one section from the whole text.
  if (sections.length === 0) {
    const text = markdown.trim();
    if (text) sections.push({ name: "Output", items: [{ text }] });
  }

  return sections.filter((s) => s.items.length > 0);
}