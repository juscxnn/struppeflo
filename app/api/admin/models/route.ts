import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { z } from "zod";
import { requireAdmin } from "../_lib/auth";

/**
 * Per-provider × model rollup. Reads from per-model thumbs counters
 * (`telemetry:rating:{provider}:{model}:{day}:up|:down`) plus the
 * per-day run-status counters. Run-status counters are global (not
 * per-model) — to break them down we'd need a per-model key, which the
 * route handler doesn't write today. This endpoint:
 *   - reports thumbs up/down per model directly from the per-model keys
 *   - reports global runs/runs_ok/runs_err/runs_aborted per day as
 *     context (template/model split will land in a follow-up)
 *
 *   GET /api/admin/models?days=7
 *   Authorization: Bearer <TELEMETRY_ADMIN_TOKEN>
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

interface ModelRollup {
  provider: string;
  model: string;
  thumbsUp: number;
  thumbsDown: number;
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

  // SCAN for per-model thumbs keys. The Upstash SCAN returns a cursor; we
  // iterate until the cursor wraps back to "0". Volume is bounded by the
  // number of distinct (provider, model, day, upDown) tuples — small.
  const keysInRange: string[] = [];
  let cursor = "0";
  do {
    const result = await kv.scan(cursor, {
      match: "telemetry:rating:*",
      count: 200,
    });
    cursor = result[0];
    for (const key of result[1]) {
      // key: telemetry:rating:<provider>:<model>:<day>:up|down
      // Last two segments are <day> and up|down.
      const stripped = key.replace(/^telemetry:rating:/, "");
      const lastColon = stripped.lastIndexOf(":");
      if (lastColon < 0) continue;
      const withoutUpDown = stripped.slice(0, lastColon);
      const upDown = stripped.slice(lastColon + 1);
      if (upDown !== "up" && upDown !== "down") continue;
      const secondLastColon = withoutUpDown.lastIndexOf(":");
      if (secondLastColon < 0) continue;
      const day = withoutUpDown.slice(secondLastColon + 1);
      if (!daysList.includes(day)) continue;
      keysInRange.push(key);
    }
  } while (cursor !== "0");

  const values = keysInRange.length
    ? await kv.mget<(number | null)[]>(...keysInRange)
    : [];

  const grouped = new Map<string, ModelRollup>();
  keysInRange.forEach((key, i) => {
    const stripped = key.replace(/^telemetry:rating:/, "");
    const lastColon = stripped.lastIndexOf(":");
    const withoutUpDown = stripped.slice(0, lastColon);
    const upDown = stripped.slice(lastColon + 1);
    const secondLastColon = withoutUpDown.lastIndexOf(":");
    const providerModel = withoutUpDown.slice(0, secondLastColon);
    const firstColon = providerModel.indexOf(":");
    if (firstColon < 0) return;
    const provider = providerModel.slice(0, firstColon);
    const model = providerModel.slice(firstColon + 1);
    const id = `${provider}\u0000${model}`;
    let entry = grouped.get(id);
    if (!entry) {
      entry = { provider, model, thumbsUp: 0, thumbsDown: 0 };
      grouped.set(id, entry);
    }
    const v = values[i] ?? 0;
    if (upDown === "up") entry.thumbsUp += v;
    else entry.thumbsDown += v;
  });

  const rollup = Array.from(grouped.values()).sort(
    (a, b) => b.thumbsUp + b.thumbsDown - (a.thumbsUp + a.thumbsDown),
  );

  // Per-day run-status counters for context. The route handler writes
  // these globally (not per-model), so we surface them alongside the
  // per-model thumbs.
  const ctxKeys: string[] = [];
  for (const d of daysList) {
    ctxKeys.push(`telemetry:counter:run:${d}`);
    ctxKeys.push(`telemetry:counter:run:ok:${d}`);
    ctxKeys.push(`telemetry:counter:run:error:${d}`);
    ctxKeys.push(`telemetry:counter:run:aborted:${d}`);
  }
  const ctxValues = await kv.mget<(number | null)[]>(...ctxKeys);
  const perDay = daysList.map((d, idx) => {
    const base = idx * 4;
    return {
      day: d,
      runs: ctxValues[base] ?? 0,
      runs_ok: ctxValues[base + 1] ?? 0,
      runs_err: ctxValues[base + 2] ?? 0,
      runs_aborted: ctxValues[base + 3] ?? 0,
    };
  });

  return NextResponse.json({
    days,
    note: "Per-model runs/errors will land here when the route handler writes per-model status counters; for now, runs are global and per-day.",
    models: rollup,
    perDay,
  });
}
