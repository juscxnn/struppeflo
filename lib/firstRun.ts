"use client";

/**
 * Per-user gate for the `first_run` telemetry event. Stored in localStorage
 * so it's browser-scoped — fine for our telemetry model where one user =
 * one browser.
 */

const KEY = "struppeflo-first-run-fired";

export function hasFiredFirstRun(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markFirstRunFired(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // ignore
  }
}