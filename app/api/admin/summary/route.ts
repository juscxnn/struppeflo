import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { z } from "zod";
import { requireAdmin } from "../_lib/auth";

/**
 * Per-day rollup for the operator dashboard.
 *
 *   GET /api/admin/summary?days=7
 *   Authorization: Bearer <TELEMETRY_ADMIN_TOKEN>
 *
 * Returns one row per day for the last N days (default 7, max 90). Each
 * row is a flat object of counter reads — no event-list scans.
 *
 * Caveat on `sessions`: the `telemetry:counter:session:{day}` counter
 * increments on BOTH session_start and session_end events, so the raw
 * value is 2x the actual session count. We report `Math.floor(raw / 2)`
 * which is a reasonable proxy given the strict start/end pairing.
 *
 * Caveat on `users_new`: counted via the SCARD return value of
 * `telemetry:users` SADD — increments the first time we see a userId,
 * which is "first time ever," not "first time today." A user who comes
 * back next month does not count as new again. Good enough for trend
 * tracking; for true "new today" we'd need a per-day set.
 */
export const runtime = "nodejs";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional(),
});

function dayList(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export async function GET(req: Request): Promise<NextResponse> {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    days: url.searchParams.get("days") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.issues },
      { status: 400 },
    );
  }

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return NextResponse.json({ error: "KV not configured" }, { status: 503 });
  }

  const days = parsed.data.days ?? 7;
  const daysList = dayList(days);

  // Pre-build the full key list so we can mget in a single round-trip.
  const keys: string[] = [];
  for (const d of daysList) {
    keys.push(`telemetry:counter:run:${d}`);
    keys.push(`telemetry:counter:run:ok:${d}`);
    keys.push(`telemetry:counter:run:error:${d}`);
    keys.push(`telemetry:counter:run:aborted:${d}`);
    keys.push(`telemetry:counter:edit:${d}`);
    keys.push(`telemetry:counter:session:${d}`);
    keys.push(`telemetry:counter:users_new:${d}`);
  }
  const values = await kv.mget<(number | null)[]>(...keys);

  const perDay = daysList.map((d, idx) => {
    const base = idx * 7;
    const sessionEvents = values[base + 5] ?? 0;
    return {
      day: d,
      runs: values[base] ?? 0,
      runs_ok: values[base + 1] ?? 0,
      runs_err: values[base + 2] ?? 0,
      runs_aborted: values[base + 3] ?? 0,
      edits: values[base + 4] ?? 0,
      sessions: Math.floor(sessionEvents / 2),
      users_new: values[base + 6] ?? 0,
    };
  });

  return NextResponse.json({ days, perDay });
}
