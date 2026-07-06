import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { z } from "zod";
import { requireAdmin } from "../_lib/auth";

/**
 * Classic D1/D7/D30 retention, computed from
 * `telemetry:user:{userId}:firstRunAt` and
 * `telemetry:user:{userId}:lastSeen`.
 *
 * The cohort is "users who completed their first successful run at least
 * N days ago." A user is "retained on day N" if their lastSeen falls on
 * or after `firstRunAt + N days`. We also report the absolute cohort
 * size at each checkpoint so a shrinking denominator is visible.
 *
 *   GET /api/admin/retention
 *   Authorization: Bearer <TELEMETRY_ADMIN_TOKEN>
 */
export const runtime = "nodejs";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional(),
});

const CHECKPOINTS = [1, 7, 30] as const;

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

  // Window caps how far back we'll consider cohort members. A user whose
  // first run was before this window has already aged past the largest
  // checkpoint we're reporting.
  const windowDays = parsed.data.days ?? 90;
  const maxCheckpoint = Math.max(...CHECKPOINTS);
  const now = Date.now();
  const earliest = now - (windowDays + maxCheckpoint) * 24 * 60 * 60 * 1000;

  // SCAN for firstRunAt keys, then mget lastSeen for each. Volume is the
  // user base — bounded by the 90-day TTL we set on these keys.
  const userIds: string[] = [];
  let cursor = "0";
  do {
    const result = await kv.scan(cursor, {
      match: "telemetry:user:*:firstRunAt",
      count: 200,
    });
    cursor = result[0];
    for (const key of result[1]) {
      const m = key.match(/^telemetry:user:(.+):firstRunAt$/);
      if (!m) continue;
      userIds.push(m[1]);
    }
  } while (cursor !== "0");

  if (userIds.length === 0) {
    return NextResponse.json({
      note: "No first-run data yet. Retention populates once users start completing their first successful run.",
      cohorts: CHECKPOINTS.map((c) => ({
        checkpoint: c,
        cohortSize: 0,
        retained: 0,
        rate: 0,
      })),
    });
  }

  const firstRunValues = await kv.mget<(string | null)[]>(
    ...userIds.map((u) => `telemetry:user:${u}:firstRunAt`),
  );
  const lastSeenValues = await kv.mget<(string | null)[]>(
    ...userIds.map((u) => `telemetry:user:${u}:lastSeen`),
  );

  interface Cohort {
    checkpoint: number;
    cohortSize: number;
    retained: number;
    rate: number;
  }
  const cohorts: Record<number, Cohort> = {};
  for (const c of CHECKPOINTS) {
    cohorts[c] = { checkpoint: c, cohortSize: 0, retained: 0, rate: 0 };
  }

  userIds.forEach((_, i) => {
    const firstRunAt = firstRunValues[i];
    if (!firstRunAt) return;
    const firstRunMs = Date.parse(firstRunAt);
    if (Number.isNaN(firstRunMs)) return;
    if (firstRunMs < earliest) return;

    const lastSeenAt = lastSeenValues[i];
    const lastSeenMs = lastSeenAt ? Date.parse(lastSeenAt) : 0;

    for (const c of CHECKPOINTS) {
      const checkpointMs = firstRunMs + c * 24 * 60 * 60 * 1000;
      if (checkpointMs > now) continue; // cohort hasn't matured yet
      cohorts[c].cohortSize += 1;
      if (lastSeenMs >= checkpointMs) {
        cohorts[c].retained += 1;
      }
    }
  });

  for (const c of CHECKPOINTS) {
    const e = cohorts[c];
    e.rate = e.cohortSize === 0 ? 0 : e.retained / e.cohortSize;
  }

  return NextResponse.json({
    windowDays,
    cohorts: CHECKPOINTS.map((c) => cohorts[c]),
  });
}
