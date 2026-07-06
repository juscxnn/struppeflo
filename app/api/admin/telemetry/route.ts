import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { z } from "zod";
import { requireAdmin } from "../_lib/auth";

/**
 * Read access for the operator (Justin). Auth is a static bearer token in
 * TELEMETRY_ADMIN_TOKEN — set it in the Vercel dashboard. Returns the most
 * recent N events for a given day (default today, 200 events).
 *
 *   GET /api/admin/telemetry?day=2026-07-06&limit=500
 *   Authorization: Bearer <TELEMETRY_ADMIN_TOKEN>
 *
 * Returns 503 if KV is not configured (no data, no read endpoint).
 */
export const runtime = "nodejs";

const querySchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
  kind: z
    .enum([
      "structure",
      "edit",
      "run",
      "run_quality",
      "session",
      "consent",
      "first_run",
    ])
    .optional(),
});

function kvUnavailable(): NextResponse {
  return NextResponse.json({ error: "KV not configured" }, { status: 503 });
}

export async function GET(req: Request): Promise<NextResponse> {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    day: url.searchParams.get("day") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    kind: url.searchParams.get("kind") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.issues },
      { status: 400 },
    );
  }

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return kvUnavailable();
  }

  const day = parsed.data.day ?? new Date().toISOString().slice(0, 10);
  const limit = parsed.data.limit ?? 200;
  const raw = (await kv.lrange<string>(`telemetry:${day}`, 0, limit - 1)) as string[];

  let events = raw
    .map((s) => {
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    })
    .filter((e): e is unknown => e !== null);

  if (parsed.data.kind) {
    const k = parsed.data.kind;
    events = events.filter(
      (e) => typeof e === "object" && e !== null && (e as { kind?: string }).kind === k,
    );
  }

  // Cheap aggregates.
  const counters = await kv.mget<number[]>(
    `telemetry:counter:structure:${day}`,
    `telemetry:counter:edit:${day}`,
    `telemetry:counter:run:${day}`,
    `telemetry:counter:run_quality:${day}`,
    `telemetry:counter:session:${day}`,
    `telemetry:counter:consent:${day}`,
    `telemetry:counter:first_run:${day}`,
    `telemetry:counter:run:ok:${day}`,
    `telemetry:counter:run:error:${day}`,
    `telemetry:counter:run:aborted:${day}`,
  );

  return NextResponse.json({
    day,
    returned: events.length,
    counts: {
      structure: counters[0] ?? 0,
      edit: counters[1] ?? 0,
      run: counters[2] ?? 0,
      run_quality: counters[3] ?? 0,
      session: counters[4] ?? 0,
      consent: counters[5] ?? 0,
      first_run: counters[6] ?? 0,
      run_ok: counters[7] ?? 0,
      run_error: counters[8] ?? 0,
      run_aborted: counters[9] ?? 0,
    },
    events,
  });
}
