import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

/**
 * Public, unauthenticated aggregate counts used by the landing page.
 *
 *   users     — unique anonymous user ids seen (SCARD of telemetry:users)
 *   runs      — total AI runs started (INCR counter)
 *   outputs   — unique compiled prompts seen (SCARD by sha256 fingerprint)
 *
 * Returns zeros + `configured: false` when KV is not configured so the
 * landing UI can render a friendly fallback.
 */

const USERS_KEY = "telemetry:users";
const RUNS_KEY = "telemetry:totals:runs";
const PROMPTS_KEY = "telemetry:prompts";

export const revalidate = 0;

export async function GET(): Promise<NextResponse> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return NextResponse.json({
      configured: false,
      users: 0,
      runs: 0,
      outputs: 0,
    });
  }
  try {
    const [users, runs, outputs] = await Promise.all([
      kv.scard(USERS_KEY),
      kv.get<number>(RUNS_KEY),
      kv.scard(PROMPTS_KEY),
    ]);
    return NextResponse.json({
      configured: true,
      users: users ?? 0,
      runs: runs ?? 0,
      outputs: outputs ?? 0,
    });
  } catch {
    return NextResponse.json({
      configured: false,
      users: 0,
      runs: 0,
      outputs: 0,
    });
  }
}