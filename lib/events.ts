/**
 * Tiny typed event bus. Store actions emit; the coach-marks tour (and any
 * other passive observer) subscribes. Deliberately global and dependency-free.
 */
export type AppEvent =
  | "card:created"
  | "link:created"
  | "panel:xray:opened"
  | "compile:copied";

type Handler = (detail?: unknown) => void;

const handlers = new Map<AppEvent, Set<Handler>>();

export function on(event: AppEvent, handler: Handler): () => void {
  let set = handlers.get(event);
  if (!set) {
    set = new Set();
    handlers.set(event, set);
  }
  set.add(handler);
  return () => set.delete(handler);
}

export function emit(event: AppEvent, detail?: unknown): void {
  handlers.get(event)?.forEach((h) => {
    try {
      h(detail);
    } catch {
      // A listener error must never break a store action.
    }
  });
}
