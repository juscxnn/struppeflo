/**
 * BigQuery streaming sink for Tier-2 telemetry.
 *
 * Why: the Vercel KV is the primary hot path (counters, per-day lists, user
 * indexes) but it caps out at a 90-day TTL and it's expensive to do ad-hoc
 * analytics on raw JSON. BigQuery is the long-form analytical store — a
 * single `events` table with a strict schema, so we can compute funnel,
 * per-model thumbs, D7 retention, and template adoption in SQL.
 *
 * Design:
 *   - Lazy singleton client. Auth is via GOOGLE_APPLICATION_CREDENTIALS_JSON
 *     (the entire service-account JSON, inlined — Vercel-friendly because it
 *     doesn't need a file in the deploy). If any of the three required env
 *     vars is missing, every call short-circuits and `sendToBigQuery` returns
 *     immediately. No exceptions, no scary logs on the first cold call.
 *   - One-shot logging on first call into a misconfigured deployment so the
 *     operator notices in function logs.
 *   - Dataset + table are auto-created on first insert. Schema is permissive
 *     (typed top-level columns + a JSON-string fallback) so client regressions
 *     in the payload shape don't break the pipeline.
 *   - Streaming inserts via `tabledata.insertAll` (the same path the
 *     @google-cloud client uses under the hood). Latency is one HTTPS call;
 *     no load jobs.
 *   - Dedup via `insertId: event.userId + event.at` — re-sent events
 *     within the streaming buffer window are dropped.
 *   - All errors are swallowed: telemetry must never break the product, and
 *     a BigQuery outage is not the user's problem.
 */

import type { TelemetryEvent } from "@/lib/telemetry";

const DATASET_DEFAULT = "struppeflo_telemetry";
const TABLE_ID = "events";

interface BigQueryTable {
  insert: (
    rows: BigQueryRow[],
    options?: {
      raw?: boolean;
      skipInvalidRows?: boolean;
      ignoreUnknownValues?: boolean;
    },
  ) => Promise<[unknown]>;
  exists: () => Promise<[boolean]>;
}

interface BigQueryDataset {
  exists: () => Promise<[boolean]>;
  create: (id: string, options?: { location?: string }) => Promise<[unknown]>;
  table: (id: string) => BigQueryTable & {
    create: (
      id: string,
      options: { schema: { fields: Array<{ name: string; type: string; mode: string }> } },
    ) => Promise<[unknown]>;
    exists: () => Promise<[boolean]>;
  };
}

interface BigQueryClient {
  dataset: (id: string) => BigQueryDataset;
}

let cachedClient: BigQueryClient | null = null;
let configLogged = false;
let initPromise: Promise<BigQueryClient | null> | null = null;

function readConfig(): {
  projectId: string;
  dataset: string;
  credentialsJson: string;
} | null {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!projectId || !credentialsJson) return null;
  return {
    projectId,
    dataset: process.env.BIGQUERY_DATASET || DATASET_DEFAULT,
    credentialsJson,
  };
}

function logConfigOnce(reason: string): void {
  if (configLogged) return;
  configLogged = true;
  console.log(
    `[bigquery] telemetry sink disabled (${reason}). Set GOOGLE_CLOUD_PROJECT + GOOGLE_APPLICATION_CREDENTIALS_JSON (+ optional BIGQUERY_DATASET) to enable.`,
  );
}

async function getClient(): Promise<BigQueryClient | null> {
  if (cachedClient) return cachedClient;
  if (initPromise) return initPromise;

  const cfg = readConfig();
  if (!cfg) {
    logConfigOnce("env vars missing");
    return null;
  }

  initPromise = (async () => {
    try {
      // Dynamic import so the gRPC client never lands in the client bundle
      // and so deployments without the env vars don't pay the init cost.
      const mod = (await import("@google-cloud/bigquery")) as unknown as {
        BigQuery: new (opts: { projectId: string; credentials: unknown }) => BigQueryClient;
      };
      const credentials = JSON.parse(cfg.credentialsJson) as unknown;
      cachedClient = new mod.BigQuery({
        projectId: cfg.projectId,
        credentials,
      });
      return cachedClient;
    } catch (e) {
      console.error("[bigquery] client init failed", e);
      return null;
    } finally {
      initPromise = null;
    }
  })();
  return initPromise;
}

async function ensureDatasetAndTable(
  client: BigQueryClient,
  datasetId: string,
): Promise<void> {
  const dataset = client.dataset(datasetId);
  const [datasetExists] = await dataset.exists();
  if (!datasetExists) {
    await dataset.create(datasetId, { location: "US" });
  }
  const table = dataset.table(TABLE_ID);
  const [tableExists] = await table.exists();
  if (!tableExists) {
    await table.create(TABLE_ID, {
      schema: {
        fields: [
          { name: "kind", type: "STRING", mode: "REQUIRED" },
          { name: "at", type: "STRING", mode: "REQUIRED" },
          { name: "user_id", type: "STRING", mode: "REQUIRED" },
          { name: "provider", type: "STRING", mode: "NULLABLE" },
          { name: "model", type: "STRING", mode: "NULLABLE" },
          { name: "prompt_fingerprint", type: "STRING", mode: "NULLABLE" },
          { name: "status", type: "STRING", mode: "NULLABLE" },
          { name: "rating", type: "INT64", mode: "NULLABLE" },
          { name: "cards", type: "INT64", mode: "NULLABLE" },
          { name: "duration_ms", type: "INT64", mode: "NULLABLE" },
          { name: "edits_before_run", type: "INT64", mode: "NULLABLE" },
          { name: "max_dependency_depth", type: "INT64", mode: "NULLABLE" },
          { name: "structure_fingerprint", type: "STRING", mode: "NULLABLE" },
          { name: "template_id", type: "STRING", mode: "NULLABLE" },
          { name: "persona", type: "STRING", mode: "NULLABLE" },
          { name: "payload_json", type: "STRING", mode: "NULLABLE" },
        ],
      },
    });
  }
}

interface BigQueryValue {
  stringValue?: string;
  int64Value?: string;
  boolValue?: boolean;
  doubleValue?: number;
}

interface BigQueryRow {
  insertId: string;
  json: Record<string, BigQueryValue>;
}

function toRow(event: TelemetryEvent): BigQueryRow {
  // Best-effort extraction of the typed columns. Anything that doesn't match
  // a known column goes into payload_json so the schema doesn't have to
  // change every time a payload field is added.
  const run = event.run;
  const structure = event.structure;
  const runQuality = event.runQuality;
  const json: Record<string, BigQueryValue> = {
    kind: { stringValue: event.kind },
    at: { stringValue: event.at },
    user_id: { stringValue: event.userId },
  };
  if (run) {
    json.provider = { stringValue: run.provider };
    json.model = { stringValue: run.model };
    json.prompt_fingerprint = { stringValue: run.promptFingerprint };
    json.status = { stringValue: run.status };
    json.cards = { int64Value: String(run.cards) };
    json.duration_ms = { int64Value: String(run.durationMs) };
    json.edits_before_run = { int64Value: String(run.editsBeforeRun) };
    if (run.rating === 1 || run.rating === -1) {
      json.rating = { int64Value: String(run.rating) };
    }
  }
  if (structure) {
    json.max_dependency_depth = { int64Value: String(structure.maxDependencyDepth) };
    json.structure_fingerprint = { stringValue: structure.structureFingerprint };
    if (structure.templateId) json.template_id = { stringValue: structure.templateId };
    if (structure.persona) json.persona = { stringValue: structure.persona };
  }
  if (runQuality && !run) {
    json.prompt_fingerprint = { stringValue: runQuality.promptFingerprint };
  }
  json.payload_json = { stringValue: JSON.stringify(event) };
  return {
    insertId: `${event.userId}${event.at}`,
    json,
  };
}

/**
 * Stream a single telemetry event into BigQuery. Fire-and-forget from the
 * caller's perspective — the route handler invokes it with `void`.
 *
 * Returns one of:
 *   - "ok"       — accepted by the streaming insert
 *   - "skipped"  — env vars missing, no-op
 *   - "failed"   — auth/network/insert error; logged, never thrown
 */
export async function sendToBigQuery(
  event: TelemetryEvent,
): Promise<"ok" | "skipped" | "failed"> {
  const cfg = readConfig();
  if (!cfg) {
    logConfigOnce("env vars missing");
    return "skipped";
  }
  const client = await getClient();
  if (!client) return "failed";

  try {
    await ensureDatasetAndTable(client, cfg.dataset);
    const table = client.dataset(cfg.dataset).table(TABLE_ID);
    // `raw: true` skips the @google-cloud client's own encodeValue_ pass —
    // we ship the BigQuery wire-format wrappers ({ stringValue, int64Value,
    // …}) ourselves so the values land exactly as we declared in the schema.
    await table.insert([toRow(event)], {
      raw: true,
      skipInvalidRows: true,
      ignoreUnknownValues: true,
    });
    return "ok";
  } catch (e) {
    const err = e as Error & { errors?: Array<{ message?: string }> };
    const detail = err.errors?.map((x) => x.message).filter(Boolean).join("; ");
    console.error(
      "[bigquery] insert failed",
      detail ? `${err.message}: ${detail}` : err.message,
    );
    return "failed";
  }
}

/** Test/observability hook: which sink did we resolve to? */
export function bigqueryConfigured(): boolean {
  return readConfig() !== null;
}
