import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { z } from "zod";

/**
 * Read access for the operator (Justin). Auth is a static bearer token in
 * TELEMETRY_ADMIN_TOKEN — set it in the Vercel dashboard. Returns the most
 * recent N events for a given day (default today, 200 events).
 *
 *   GET /api/admin/telemetry?day=2026-07-06&limit=500
 *   Authorization: Bearer <TELEMETRY_ADMIN_TOKEN>
 *
 * Returns 404 if KV is not configured (no data, no read endpoint).
 */

const querySchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
  kind: z
    .enum(["structure", "edit", "run", "run_quality", "session"])
    .optional(),
});

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: Request): Promise<NextResponse> {
  const token = process.env.TELEMETRY_ADMIN_TOKEN;
  if (!token) return unauthorized();

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  if (!bearer || bearer !== token) return unauthorized();

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
    return NextResponse.json(
      { error: "KV not configured" },
      { status: 503 },
    );
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
    },
    events,
  });
}