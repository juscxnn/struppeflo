/**
 * Tiny typed event bus. Store actions emit; the coach-marks tour, the
 * session tracker, and any other passive observer subscribe. Deliberately
 * global and dependency-free.
 *
 * Event payload shape is loose (`unknown`) so any caller can pass whatever
 * the listener expects. Type the listeners themselves.
 */
export type AppEvent =
  | "card:created"
  | "card:updated"
  | "card:deleted"
  | "card:moved"
  | "link:created"
  | "link:updated"
  | "link:deleted"
  | "division:created"
  | "division:resized"
  | "division:deleted"
  | "board:created"
  | "board:opened"
  | "board:reset"
  | "panel:xray:opened"
  | "compile:copied"
  | "run:started"
  | "run:completed"
  | "run:quality";

export type AppEventDetail = unknown;

type Handler = (detail?: AppEventDetail) => void;

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

export function emit(event: AppEvent, detail?: AppEventDetail): void {
  handlers.get(event)?.forEach((h) => {
    try {
      h(detail);
    } catch {
      // A listener error must never break a store action.
    }
  });
}