"use client";

import { track as vercelTrack } from "@vercel/analytics";

/**
 * Anonymous product analytics: event names and small counts only — never
 * board content, titles, prompts, or keys. This is the activation-funnel
 * instrumentation (visit → dump → organize → compile → run) that pricing
 * and retention decisions depend on.
 */
export type AnalyticsEvent =
  | "brain_dump"
  | "organize"
  | "suggest_links"
  | "workflow_generated"
  | "template_used"
  | "xray_opened"
  | "prompt_copied"
  | "run_started"
  | "run_completed"
  | "open_in_claude"
  | "key_connected"
  | "tour_completed"
  | "waitlist_joined"
  | "result_added_to_board"
  | "result_split_into_cards"
  | "run_helpful_yes"
  | "run_helpful_no"
  | "telemetry_opt_in"
  | "telemetry_opt_out";

export function track(
  event: AnalyticsEvent,
  props?: Record<string, string | number | boolean>,
): void {
  try {
    vercelTrack(event, props);
  } catch {
    // Analytics must never break the product.
  }
}