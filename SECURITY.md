# Security

## Local-first posture

Struppëflo is local-first by design:

- **Boards live in your browser.** Stored in `localStorage` under `struppeflo-workspace`. No server, no account, no sync in v1.
- **API keys live in your browser.** Stored under `struppeflo-ai`. Sent only to the AI provider whose key they belong to (Anthropic, OpenAI, Gemini, MiniMax, or Kimi — whichever you connected). Struppëflo's servers never see your key.
- **CSP enforces it.** `next.config.ts` ships a `connect-src` directive that whitelists only `'self'` and the supported AI provider APIs. The browser blocks every other outbound call, even if the app regressed.

## What the server does (today)

The only server-side routes in production are:

- `POST /api/waitlist` — captures email for the Pro waitlist. Logs and (if `WAITLIST_WEBHOOK_URL` is set) forwards to a webhook.
- `POST /api/telemetry` — receives opt-in, structural-only telemetry. Schema-validated, hard-capped, content never sent. See `/privacy`.

Both routes validate input with zod and return JSON errors. Neither route stores anything by default.

## Reporting a vulnerability

Email **security@struppeflo.app** with:

1. A description of the issue and the impact.
2. Reproduction steps or a proof of concept.
3. Whether the issue is being disclosed publicly elsewhere.

We aim to acknowledge within 72 hours and ship a fix or mitigation within 14 days for confirmed issues.

## Supported versions

| Version | Supported |
| --- | --- |
| `main` branch, latest commit | yes |
| Anything else | best effort |

## Out of scope

- Issues in third-party providers (Anthropic, OpenAI, Gemini, MiniMax, Kimi) — report upstream.
- Self-hosted modifications under AGPL-3.0 — those are your responsibility; we don't run them.