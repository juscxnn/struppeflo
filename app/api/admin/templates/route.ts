import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { z } from "zod";
import { requireAdmin } from "../_lib/auth";

/**
 * Per-template rollup. Reads the structure-fingerprint set on each
 * structure event, but templates aren't directly indexed on the event
 * path yet (see task 3 — templateId lives on BoardStructurePayload but
 * is not yet wired into the per-event counter).
 *
 * For now, we return:
 *   - the runs-per-day totals (template-agnostic)
 *   - the structure-event totals, which is a proxy for "how many boards
 *     did the user compile and ship a run against"
 *
 * Once RunPanel starts passing templateId through to /api/telemetry and
 * the route writes a `telemetry:counter:structure:template:{id}:{day}`
 * counter, the front-end of this endpoint can just SCAN that prefix.
 *
 *   GET /api/admin/templates?days=7
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

  // Per-day run totals (template-agnostic). When per-template counters are
  // added in the route handler, this is where the SCAN over the
  // `telemetry:counter:structure:template:*:{day}` prefix will land.
  const keys: string[] = [];
  for (const d of daysList) {
    keys.push(`telemetry:counter:run:${d}`);
    keys.push(`telemetry:counter:structure:${d}`);
  }
  const values = await kv.mget<(number | null)[]>(...keys);

  const perDay = daysList.map((d, idx) => {
    const base = idx * 2;
    return {
      day: d,
      runs: values[base] ?? 0,
      structures: values[base + 1] ?? 0,
    };
  });

  const totals = perDay.reduce(
    (acc, row) => {
      acc.runs += row.runs;
      acc.structures += row.structures;
      return acc;
    },
    { runs: 0, structures: 0 },
  );

  return NextResponse.json({
    days,
    note: "Per-template breakdown is wired through BoardStructurePayload.templateId; the route handler will start writing per-template counters as soon as RunPanel calls buildBoardStructure. Until then, this endpoint reports the template-agnostic totals.",
    totals,
    perDay,
    templates: [] as Array<{
      templateId: string;
      runs: number;
      thumbsUp: number;
      thumbsDown: number;
    }>,
  });
}
