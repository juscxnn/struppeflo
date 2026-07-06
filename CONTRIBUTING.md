# Contributing to Struppëflo

Thanks for building with us. Struppëflo is AGPL-3.0 — by contributing, you agree your work is licensed under the same.

## Local setup

```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # production build
```

Requirements: Node 20+, npm 10+.

## Code conventions

- **TypeScript strict.** No `any` in new code; the existing handful are pinned in `tsconfig.json` and tracked.
- **No comments unless asked.** Code should read as code. Doc-comments (`/** */`) only on exported APIs, components, and non-obvious decisions.
- **Match the file layout.** `app/` for routes, `components/` for React, `lib/` for pure logic, `lib/store/` for state, `lib/compiler/` and `lib/ai/` for the deterministic core.
- **Keep the dependency surface small.** Five runtime deps today (`@anthropic-ai/sdk`, `@vercel/analytics`, `geist`, `next`, `react`, `react-dom`, `zod`, `zundo`, `zustand`). New deps need a one-line rationale in the PR.
- **Determinism where it matters.** The compiler and local AI heuristics must be pure functions of input. Anything stochastic belongs behind a provider interface with a deterministic fallback.
- **CSP is enforced, not aspirational.** Any new outbound network call must be added to `connect-src` in `next.config.ts`.

## Provider model

Every AI feature goes through `lib/ai/provider.ts`. New providers implement the `AIProvider` interface in `lib/types.ts` and degrade to `MockAIProvider` on any failure. Local-first is a contract — never break it.

## Pull requests

- One concern per PR. Smaller is faster to review.
- Run `npm run build` locally before pushing. CI runs it again.
- If your change touches the compiled prompt format or the run output, update `README.md` and the landing demo if relevant.

## Reporting bugs

Open a GitHub issue with: a board state you can reproduce (export JSON from the Help menu), what you expected, what happened. Screenshots help for canvas issues.

## Security issues

See `SECURITY.md`. Don't open public issues for security.