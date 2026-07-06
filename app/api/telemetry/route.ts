import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { z } from "zod";
import { sendToBigQuery } from "@/lib/telemetry/bigquery";

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
 * In addition, every accepted event is streamed to BigQuery (fire-and-forget)
 * if GOOGLE_CLOUD_PROJECT + GOOGLE_APPLICATION_CREDENTIALS_JSON are set. The
 * response includes a `bigquery` field so the operator can verify the sink
 * is engaged without checking Vercel logs.
 *
 * The route is POST-only and returns no identifying information.
 */

export const runtime = "nodejs";

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
  templateId: z.string().min(1).max(80).optional(),
  persona: z.string().min(1).max(40).optional(),
  zoneHistogram: z
    .record(
      z.object({
        cards: z.number().int().min(0).max(10_000),
        cardTypes: histogramSchema,
      }),
    )
    .optional(),
  linkRatio: z
    .object({
      dependsOn: z.number().int().min(0).max(10_000),
      inputTo: z.number().int().min(0).max(10_000),
      relatedTo: z.number().int().min(0).max(10_000),
    })
    .optional(),
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

const consentSchema = z.object({
  shown: z.boolean(),
  optedIn: z.boolean(),
});

const firstRunSchema = z.object({
  provider: z.string().min(1).max(40),
  model: z.string().min(1).max(80),
  promptFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  durationMs: z.number().int().min(0).max(60 * 60 * 1000),
  cards: z.number().int().min(0).max(10_000),
});

const bodySchema = z.object({
  kind: z.enum([
    "structure",
    "edit",
    "run",
    "run_quality",
    "session",
    "consent",
    "first_run",
  ]),
  at: z.string().datetime(),
  userId: z.string().min(8).max(64),
  structure: structureSchema.optional(),
  edit: editSchema.optional(),
  run: runSchema.optional(),
  runQuality: runQualitySchema.optional(),
  session: sessionSchema.optional(),
  consent: consentSchema.optional(),
  firstRun: firstRunSchema.optional(),
});

const TTL_SECONDS = 90 * 24 * 60 * 60;
const LAST_SEEN_TTL_SECONDS = 90 * 24 * 60 * 60;

export async function POST(req: Request): Promise<NextResponse> {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
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
      // DAU/WAU/MAU key — last time we saw this user accept a telemetry
      // event. 90-day TTL matches the rest of the per-user data so the
      // admin retention endpoint can compute a clean 90-day window.
      await kv.set(
        `telemetry:user:${parsed.userId}:lastSeen`,
        parsed.at,
        { ex: LAST_SEEN_TTL_SECONDS },
      );
      // Per-kind counter, useful for high-level dashboards.
      await kv.incr(`telemetry:counter:${parsed.kind}:${day}`);
      await kv.expire(`telemetry:counter:${parsed.kind}:${day}`, TTL_SECONDS);
      // All-time totals for the public landing-page counter. The user set
      // grows monotonically; runs and structures grow as events arrive.
      // sadd returns the number of *new* members — use that to count
      // "first-time user today" without an extra round-trip.
      const newMembers = await kv.sadd("telemetry:users", parsed.userId);
      if (newMembers > 0) {
        await kv.incr(`telemetry:counter:users_new:${day}`);
        await kv.expire(`telemetry:counter:users_new:${day}`, TTL_SECONDS);
      }
      if (parsed.kind === "run") {
        await kv.incr("telemetry:totals:runs");
        const fp = parsed.run?.promptFingerprint;
        if (fp) await kv.sadd("telemetry:prompts", fp);
      }
      if (parsed.kind === "structure") {
        await kv.incr("telemetry:totals:structures");
      }
      // Per-run status counters (for the admin summary endpoint).
      if (parsed.kind === "run" && parsed.run) {
        const status = parsed.run.status;
        await kv.incr(`telemetry:counter:run:${status}:${day}`);
        await kv.expire(
          `telemetry:counter:run:${status}:${day}`,
          TTL_SECONDS,
        );
        // Per-model thumbs: lets /api/admin/models answer
        // "is GPT-5 getting more 👎 than Opus?" without scanning the day list.
        const r = parsed.run.rating;
        if (r === 1) {
          await kv.incr(
            `telemetry:rating:${parsed.run.provider}:${parsed.run.model}:${day}:up`,
          );
          await kv.expire(
            `telemetry:rating:${parsed.run.provider}:${parsed.run.model}:${day}:up`,
            TTL_SECONDS,
          );
        } else if (r === -1) {
          await kv.incr(
            `telemetry:rating:${parsed.run.provider}:${parsed.run.model}:${day}:down`,
          );
          await kv.expire(
            `telemetry:rating:${parsed.run.provider}:${parsed.run.model}:${day}:down`,
            TTL_SECONDS,
          );
        }
      }
      // Session counts: every session_start lands here, every session_end
      // does too. The admin summary uses this as a sessions/day proxy.
      if (parsed.kind === "session") {
        await kv.incr(`telemetry:counter:session_event:${day}`);
        await kv.expire(
          `telemetry:counter:session_event:${day}`,
          TTL_SECONDS,
        );
      }
      // Edits: keep a separate day counter so the summary endpoint doesn't
      // have to scan the day list.
      if (parsed.kind === "edit") {
        await kv.incr(`telemetry:counter:edit:${day}`);
        await kv.expire(`telemetry:counter:edit:${day}`, TTL_SECONDS);
      }
      // Consent: write a schema-hardened, content-free record. We persist
      // ONLY the timestamp — the bools live in the same event but we don't
      // index them so a user with consent=false is still a user we can
      // compute retention over.
      if (parsed.kind === "consent") {
        await kv.set(
          `telemetry:consent:${parsed.userId}:${parsed.at}`,
          "1",
          { ex: TTL_SECONDS },
        );
      }
      // first_run: persist once per user so retention can compute D1/D7/D30.
      if (parsed.kind === "first_run") {
        const exists = await kv.get(
          `telemetry:user:${parsed.userId}:firstRunAt`,
        );
        if (!exists) {
          await kv.set(
            `telemetry:user:${parsed.userId}:firstRunAt`,
            parsed.at,
            { ex: LAST_SEEN_TTL_SECONDS },
          );
        }
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

  // Fire-and-forget BigQuery insert, raced against a 2s ceiling so the
  // response stays snappy. If BigQuery is unreachable, the user-facing
  // latency is unaffected and the operator can read the failure in the
  // Vercel function logs. We deliberately don't `void` here because the
  // response body must report the outcome.
  type BqStatus = "ok" | "skipped" | "failed";
  const bigqueryStatus: BqStatus = await Promise.race<BqStatus>([
    sendToBigQuery(parsed).catch((): BqStatus => "failed"),
    new Promise<BqStatus>((resolve) => {
      setTimeout(() => resolve("skipped"), 2000);
    }),
  ]);

  return NextResponse.json({
    ok: true,
    storage: hasKv ? "kv" : webhook ? "webhook" : "log",
    bigquery: bigqueryStatus,
  });
}
