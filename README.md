# Struppëflo

**Think in space. Ship in structure.**

A thinking canvas for scattered brains: drop thoughts as cards
on an infinite canvas, link them by dragging close, group them into zones —
then let the board **compile** into a structured, dependency-ordered prompt
that long-horizon AI agents actually follow.

- **Landing page** at `/` with a fully live demo board (the real component,
  sandboxed) and a live compiled-prompt panel.
- **Studio** at `/studio` — the full app, with a stepper onboarding + guided
  tour on first visit.

## The core idea

Chat prompts are soup. LLMs do their best long-horizon work with structured,
dependency-ordered context. Struppëflo compiles your spatial arrangement into
exactly that:

| Board gesture | Compiled meaning |
| --- | --- |
| Zones (divisions) | `<section>` blocks, dependency-ordered |
| Card types (note/task/question/insight/resource) | Semantic tags (`<task>`, `<open_question>`, …) |
| `depends_on` / `input_to` links | `<dependencies>` + `<execution_order>` |
| Spatial reading order | Deterministic tie-breaking |

Open the **Prompt X-Ray** (`⌘.`) to watch the prompt rewrite itself as you
drag cards around. Copy, paste into Claude, keep going.

## Features

- **Proximity linking** — drag a card near another until it glows, release to
  link; one click to retype the relationship.
- **Zones** — draw named regions (press `D`); they move with their cards
  (`⌥`-drag to move the frame alone).
- **Brain dump** (`B`) — one thought per line; each becomes a typed card.
- **AI Organize / Suggest links / Generate workflow** — deterministic local
  heuristics behind a provider interface (no network, instant, undoable).
- **Spark questions** — the board notices gaps and asks; answers become cards.
- **Tabs, templates, command palette (`⌘K`), undo/redo, export/import JSON,
  dark/light, full keyboard map (`?`).**

## Run it, don't just copy it

The **Run** button closes the loop:

- **No setup:** "Open in Claude" launches claude.ai with the compiled board
  pre-filled as the prompt.
- **Bring your own key:** connect an Anthropic API key (Help menu → Connect,
  or the Run panel) and runs stream directly in-app; results land back on the
  board as cards. The same key upgrades Organize, Suggest links, and Sparks
  from local heuristics to real Claude calls — with silent fallback to the
  heuristics on any failure.

The key is stored in this browser's localStorage and sent only to
`api.anthropic.com` (browser → Anthropic directly; enforced by the CSP).

## Local-first security

- Everything lives in `localStorage`. No account, no server, no telemetry.
- Strict CSP: `connect-src` allows only `'self'` and `api.anthropic.com` —
  a browser-enforced guarantee, not a promise.
- Imports are zod-validated, clamped, and re-keyed before touching the board.

## Development

```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # production build (static landing + studio)
```

Stack: Next.js 15 (App Router) · TypeScript strict · Tailwind v4 · Geist ·
zustand (+ zundo undo history, persist) · zod. Five runtime dependencies
total; the canvas is hand-rolled DOM, links are one SVG layer, and every drag
runs through a single rAF with zero React renders mid-gesture. Design system:
flat surfaces, hairline borders, monochrome primary (Vercel/n8n direction).

## Deploy to Vercel

Zero config needed:

```bash
npx vercel        # from this directory, or
```

…or push to GitHub and *Import Project* in Vercel. No environment variables
required for v1.

## Hosted AI backend (optional, later)

BYO-key already gives real AI with zero backend. If you later want a hosted
backend (shared keys, usage control, MCP integration), the seam is in place:

1. Implement `app/api/ai/{organize,suggest-links,workflow}/route.ts` with the
   Anthropic API (they currently return `501` with zod-validated bodies).
2. Set `NEXT_PUBLIC_AI_PROVIDER=api`.
3. `lib/ai/provider.ts` resolves: user key → `AnthropicProvider` (browser),
   else env flag → `ApiAIProvider` (your backend), else local heuristics.

Exposing boards to agents over MCP is the natural v3: the compiler's JSON
output (`CompiledBoard`) is already the resource an MCP server would serve.

## Architecture map

```
lib/compiler/   board → { markdown, json, warnings } (pure, deterministic)
lib/ai/         provider interface + local heuristics (TF-IDF clustering,
                pair scoring, workflow lanes, spark questions)
lib/store/      zustand workspace store (persist + undo) shared by the studio
                AND the landing demo (same machine, throwaway instance)
components/board/  canvas engine: camera, drag, proximity, links, zones
components/panels/ studio chrome: X-Ray, toolbar, tabs, palette, sparks
components/onboarding/ stepper + event-driven coach marks
components/landing/    marketing page with the live sandboxed demo
```
