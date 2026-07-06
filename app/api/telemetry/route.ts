import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { z } from "zod";

/**
 * Tier-2 opt-in structural telemetry. Schema-hardened: titles, bodies, and
 * prompt text cannot fit through this schema even if the client regressed.
 *
 * Storage is intentionally pluggable:
 *   - KV_REST_API_URL + KV_REST_API_TOKEN set → Vercel KV (Redis).
 *     The event is pushed to a per-day list, with a TTL of 90 days.
 *   - TELEMETRY_WEBHOOK_URL set              → forward server-side.
 *   - else                                   → console.log only.
 *
 * The route is POST-only and returns no identifying information.
 */

const cardTypeEnum = z.enum(["note", "task", "question", "insight", "resource"]);
const linkTypeEnum = z.enum(["related_to", "depends_on", "input_to"]);
const editActionEnum = z.enum([
  "card_added",
  "card_edited",
  "card_deleted",
  "link_added",
  "link_removed",
  "division_added",
  "division_resized",
  "division_removed",
  "board_created",
  "board_opened",
  "template_used",
  "organize",
  "suggest_links",
  "workflow_generated",
]);

const histogramSchema = z.record(z.number().int().min(0).max(10_000));

const structureSchema = z.object({
  cards: z.number().int().min(0).max(10_000),
  divisions: z.number().int().min(0).max(1_000),
  links: z.number().int().min(0).max(10_000),
  cardTypes: histogramSchema,
  linkTypes: histogramSchema,
  maxDependencyDepth: z.number().int().min(0).max(64),
  structureFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});

const editSchema = z.object({
  action: editActionEnum,
  cardsBefore: z.number().int().min(0).max(10_000),
  divisionsBefore: z.number().int().min(0).max(1_000),
  linksBefore: z.number().int().min(0).max(10_000),
  msSincePrevEdit: z.number().int().min(0).max(60 * 60 * 1000),
  cardType: cardTypeEnum.optional(),
  linkType: linkTypeEnum.optional(),
});

const runSchema = z.object({
  provider: z.string().min(1).max(40),
  model: z.string().min(1).max(80),
  promptFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  inputTokens: z.number().int().min(0).max(10_000_000),
  outputTokens: z.number().int().min(0).max(10_000_000),
  durationMs: z.number().int().min(0).max(60 * 60 * 1000),
  status: z.enum(["ok", "error", "aborted"]),
  rating: z.union([z.literal(1), z.literal(-1)]).optional(),
  cards: z.number().int().min(0).max(10_000),
  editsBeforeRun: z.number().int().min(0).max(100_000),
});

const runQualitySchema = z.object({
  promptFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  reRun: z.boolean(),
  editedAfter: z.boolean(),
  addedToBoard: z.boolean(),
  splitIntoCards: z.boolean(),
});

const sessionSchema = z.object({
  kind: z.enum(["session_start", "session_end"]),
  durationMs: z.number().int().min(0).max(7 * 24 * 60 * 60 * 1000).optional(),
  edits: z.number().int().min(0).max(100_000).optional(),
  runs: z.number().int().min(0).max(100_000).optional(),
  ratings: z
    .object({
      up: z.number().int().min(0).max(100_000),
      down: z.number().int().min(0).max(100_000),
    })
    .optional(),
  finalStructure: structureSchema.optional(),
});

const bodySchema = z.object({
  kind: z.enum(["structure", "edit", "run", "run_quality", "session"]),
  at: z.string().datetime(),
  userId: z.string().min(8).max(64),
  structure: structureSchema.optional(),
  edit: editSchema.optional(),
  run: runSchema.optional(),
  runQuality: runQualitySchema.optional(),
  session: sessionSchema.optional(),
});

const TTL_SECONDS = 90 * 24 * 60 * 60;

export async function POST(req: Request): Promise<NextResponse> {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid telemetry payload" },
      { status: 400 },
    );
  }

  console.log(`[telemetry ${parsed.kind}] ${parsed.at}`, JSON.stringify(parsed));

  const hasKv = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;
  const webhook = process.env.TELEMETRY_WEBHOOK_URL;

  if (hasKv) {
    try {
      const day = parsed.at.slice(0, 10);
      const dayKey = `telemetry:${day}`;
      await kv.rpush(dayKey, JSON.stringify(parsed));
      await kv.expire(dayKey, TTL_SECONDS);
      // Index per user, capped at the last 1000 events, so we can compute
      // repeat-session metrics later.
      const userKey = `telemetry:user:${parsed.userId}`;
      await kv.rpush(userKey, JSON.stringify(parsed));
      await kv.ltrim(userKey, -1000, -1);
      await kv.expire(userKey, TTL_SECONDS);
      // Per-kind counter, useful for high-level dashboards.
      await kv.incr(`telemetry:counter:${parsed.kind}:${day}`);
      await kv.expire(`telemetry:counter:${parsed.kind}:${day}`, TTL_SECONDS);
      // All-time totals for the public landing-page counter. The user set
      // grows monotonically; runs and structures grow as events arrive.
      await kv.sadd("telemetry:users", parsed.userId);
      if (parsed.kind === "run") {
        await kv.incr("telemetry:totals:runs");
        const fp = parsed.run?.promptFingerprint;
        if (fp) await kv.sadd("telemetry:prompts", fp);
      }
      if (parsed.kind === "structure") {
        await kv.incr("telemetry:totals:structures");
      }
    } catch (e) {
      console.error("[telemetry] kv write failed", e);
    }
  }

  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...parsed }),
      });
    } catch {
      // Log-only fallback.
    }
  }

  return NextResponse.json({
    ok: true,
    storage: hasKv ? "kv" : webhook ? "webhook" : "log",
  });
}