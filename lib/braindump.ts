import type { CardType } from "@/lib/types";

const MAX_LINES = 60;
const TITLE_MAX = 60;

/** One leading list marker: -, *, •, "1.", "[ ]"/"[x]". Stripped iteratively for "- [ ]". */
const LIST_MARKER = /^(?:[-*•]|\d+\.|\[[ xX]?\])\s*/;
const CHECKBOX = /^(?:[-*•]\s*)?\[[ xX]?\]/;
const TASK_VERB =
  /^(?:todo|do |fix|write|call|email|build|ship|buy|schedule|book|send|review|finish)/i;
const URL = /https?:\/\/\S+/i;
const INSIGHT_OPENER = /^(?:idea|insight|maybe|what if)/i;

export function parseBrainDump(
  text: string,
): Array<{ title: string; body: string; type: CardType }> {
  const out: Array<{ title: string; body: string; type: CardType }> = [];
  for (const raw of text.split(/\r?\n/)) {
    if (out.length >= MAX_LINES) break;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const hadCheckbox = CHECKBOX.test(trimmed);
    let content = trimmed;
    for (;;) {
      const next = content.replace(LIST_MARKER, "");
      if (next === content) break;
      content = next.trimStart();
    }
    if (!content) continue;
    const { title, body } = splitTitle(content);
    out.push({ title, body, type: inferType(content, hadCheckbox) });
  }
  return out;
}

function splitTitle(line: string): { title: string; body: string } {
  if (line.length <= TITLE_MAX) return { title: line, body: "" };
  const head = line.slice(0, TITLE_MAX);
  const space = head.lastIndexOf(" ");
  const cut = space > 0 ? space : TITLE_MAX;
  return { title: `${head.slice(0, cut).trimEnd()}…`, body: line.slice(cut).trim() };
}

function inferType(content: string, hadCheckbox: boolean): CardType {
  if (/\?\s*$/.test(content)) return "question";
  if (hadCheckbox || TASK_VERB.test(content)) return "task";
  if (URL.test(content)) return "resource";
  if (INSIGHT_OPENER.test(content)) return "insight";
  return "note";
}

/** Golden angle in radians — successive points never align, so the scatter stays even. */
const SPIRAL_ANGLE = 2.399963;
const SPIRAL_STEP = 90;

export function scatterPositions(
  count: number,
  origin: { x: number; y: number },
): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(i) * SPIRAL_STEP;
    const a = i * SPIRAL_ANGLE;
    let x = Math.round(origin.x + r * Math.cos(a));
    const y = Math.round(origin.y + r * Math.sin(a));
    // Rounding can theoretically collide at large i; nudge right until unique.
    while (seen.has(`${x},${y}`)) x += 1;
    seen.add(`${x},${y}`);
    out.push({ x, y });
  }
  return out;
}
