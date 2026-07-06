import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Tier-2 opt-in structural telemetry. Schema-hardened: titles, bodies, and
 * prompt text cannot fit through this schema even if the client regressed.
 *
 * Storage is intentionally pluggable:
 *   - TELEMETRY_WEBHOOK_URL set  → forward the payload server-side.
 *   - else                       → console.log only (visible in function logs).
 *
 * The route is POST-only and returns no identifying information.
 */

const cardTypeEnum = z.enum(["note", "task", "question", "insight", "resource"]);
const linkTypeEnum = z.enum(["related_to", "depends_on", "input_to"]);

const structureSchema = z.object({
  cards: z.number().int().min(0).max(10_000),
  divisions: z.number().int().min(0).max(1_000),
  links: z.number().int().min(0).max(10_000),
  cardTypes: z.record(cardTypeEnum, z.number().int().min(0).max(10_000)),
  linkTypes: z.record(linkTypeEnum, z.number().int().min(0).max(10_000)),
  maxDependencyDepth: z.number().int().min(0).max(64),
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
});

const bodySchema = z
  .object({
    structure: structureSchema.optional(),
    run: runSchema.optional(),
  })
  .refine((v) => v.structure !== undefined || v.run !== undefined, {
    message: "Empty telemetry payload",
  });

export async function POST(req: Request): Promise<NextResponse> {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid telemetry payload" }, { status: 400 });
  }

  const at = new Date().toISOString();
  console.log(`[telemetry] ${at}`, JSON.stringify(parsed));

  const webhook = process.env.TELEMETRY_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ at, ...parsed }),
      });
    } catch {
      // Log-only fallback.
    }
  }

  return NextResponse.json({ ok: true });
}