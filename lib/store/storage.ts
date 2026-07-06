import type { StateStorage } from "zustand/middleware";
import {
  STORAGE_BUDGET_BYTES,
  STORAGE_WARN_RATIO,
  STORAGE_WRITE_THROTTLE_MS,
} from "../constants";

export type StorageIssue = "near-quota" | "write-blocked";

const listeners = new Set<(issue: StorageIssue) => void>();

/** UI layers subscribe to surface quota problems as toasts/banners. */
export function onStorageIssue(cb: (issue: StorageIssue) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify(issue: StorageIssue) {
  listeners.forEach((cb) => cb(issue));
}

const pending = new Map<string, string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
let warnedNearQuota = false;

function writeNow(name: string, value: string) {
  // UTF-16 storage: ~2 bytes per code unit.
  const bytes = (name.length + value.length) * 2;
  if (bytes > STORAGE_BUDGET_BYTES) {
    notify("write-blocked");
    return;
  }
  try {
    localStorage.setItem(name, value);
    if (!warnedNearQuota && bytes > STORAGE_BUDGET_BYTES * STORAGE_WARN_RATIO) {
      warnedNearQuota = true;
      notify("near-quota");
    }
  } catch {
    // QuotaExceededError or storage disabled — state stays in memory.
    notify("write-blocked");
  }
}

/**
 * Guarded localStorage adapter for zustand persist: throttled trailing
 * writes, a hard size budget, and quota-failure signaling instead of throws.
 */
export const guardedStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    pending.set(name, value);
    if (!timers.has(name)) {
      timers.set(
        name,
        setTimeout(() => {
          timers.delete(name);
          const v = pending.get(name);
          pending.delete(name);
          if (v != null) writeNow(name, v);
        }, STORAGE_WRITE_THROTTLE_MS),
      );
    }
  },
  removeItem: (name) => {
    pending.delete(name);
    try {
      localStorage.removeItem(name);
    } catch {
      // Nothing sensible to do.
    }
  },
};

// Flush throttled writes when the page is being hidden/closed.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    for (const [name, value] of pending) {
      pending.delete(name);
      writeNow(name, value);
    }
  });
}
