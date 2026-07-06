"use client";

import { useEffect, useRef } from "react";
import { emit, on } from "./events";
import { useBoardStore } from "./store/boardStore";
import {
  computeBoardStructure,
  sendTelemetry,
  structureFingerprint,
  type EditAction,
  type EditPayload,
} from "./telemetry";

type EditEvent =
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
  | "board:opened";

const EVENT_TO_ACTION: Record<EditEvent, EditAction> = {
  "card:created": "card_added",
  "card:updated": "card_edited",
  "card:deleted": "card_deleted",
  "card:moved": "card_edited",
  "link:created": "link_added",
  "link:updated": "card_edited",
  "link:deleted": "link_removed",
  "division:created": "division_added",
  "division:resized": "division_resized",
  "division:deleted": "division_removed",
  "board:created": "board_created",
  "board:opened": "board_opened",
};

/**
 * Session tracker. Mounts once in the studio shell. Subscribes to all
 * mutation events, counts edits/runs/ratings, and emits session telemetry on
 * visibility-change / unmount / beforeunload.
 */
export function useSessionTracker(): void {
  const editsRef = useRef(0);
  const lastEditRef = useRef(0);
  const sessionStartRef = useRef(Date.now());
  const runsRef = useRef(0);
  const upRef = useRef(0);
  const downRef = useRef(0);

  useEffect(() => {
    sessionStartRef.current = Date.now();
    sendTelemetry({ kind: "session", session: { kind: "session_start" } });

    const unsubs: Array<() => void> = [];

    const editEvents = Object.keys(EVENT_TO_ACTION) as EditEvent[];
    for (const ev of editEvents) {
      unsubs.push(
        on(ev, ((detail: unknown) => {
          const now = Date.now();
          const st = useBoardStore.getState();
          const board = st.boards[st.activeBoardId];
          const d = detail as
            | { cardType?: string; linkType?: string }
            | undefined;
          const payload: EditPayload = {
            action: EVENT_TO_ACTION[ev],
            cardsBefore: board ? Object.keys(board.cards).length : 0,
            divisionsBefore: board ? Object.keys(board.divisions).length : 0,
            linksBefore: board ? Object.keys(board.links).length : 0,
            msSincePrevEdit:
              lastEditRef.current === 0 ? 0 : now - lastEditRef.current,
            ...(d?.cardType
              ? { cardType: d.cardType as EditPayload["cardType"] }
              : {}),
            ...(d?.linkType
              ? { linkType: d.linkType as EditPayload["linkType"] }
              : {}),
          };
          editsRef.current += 1;
          lastEditRef.current = now;
          sendTelemetry({ kind: "edit", edit: payload });
        }) as Parameters<typeof on>[1]),
      );
    }

    const flush = async () => {
      const st = useBoardStore.getState();
      const board = st.boards[st.activeBoardId];
      let finalStructure: ReturnType<typeof computeBoardStructure> | undefined;
      if (board) {
        const fp = await structureFingerprint(board);
        finalStructure = computeBoardStructure(board, fp);
      }
      sendTelemetry({
        kind: "session",
        session: {
          kind: "session_end",
          durationMs: Date.now() - sessionStartRef.current,
          edits: editsRef.current,
          runs: runsRef.current,
          ratings: { up: upRef.current, down: downRef.current },
          ...(finalStructure ? { finalStructure } : {}),
        },
      });
    };

    unsubs.push(
      on("run:started", (() => {
        runsRef.current += 1;
      }) as Parameters<typeof on>[1]),
    );

    unsubs.push(
      on("run:quality", ((detail: unknown) => {
        const d = detail as
          | { rating?: 1 | -1; reRun?: boolean; addedToBoard?: boolean; splitIntoCards?: boolean }
          | undefined;
        if (d?.rating === 1) upRef.current += 1;
        if (d?.rating === -1) downRef.current += 1;
        sendTelemetry({
          kind: "run_quality",
          runQuality: {
            promptFingerprint: "00".repeat(32),
            reRun: !!d?.reRun,
            editedAfter: false,
            addedToBoard: !!d?.addedToBoard,
            splitIntoCards: !!d?.splitIntoCards,
          },
        });
      }) as Parameters<typeof on>[1]),
    );

    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const onUnload = () => void flush();
    window.addEventListener("beforeunload", onUnload);

    return () => {
      unsubs.forEach((u) => u());
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
      void flush();
    };
  }, []);
}

/** Helpers used by RunPanel to push signals into the tracker. */
export function reportRunStarted(): void {
  emit("run:started");
}

let lastPromptFingerprint: string | null = null;
let lastPromptSeenCount = 0;

export function rememberRunPrompt(promptFingerprint: string): void {
  lastPromptFingerprint = promptFingerprint;
  lastPromptSeenCount = 0;
}

export function reportRunQuality(args: {
  rating?: 1 | -1;
  addedToBoard?: boolean;
  splitIntoCards?: boolean;
}): void {
  const fp = lastPromptFingerprint ?? "00".repeat(32);
  const reRun = lastPromptSeenCount > 0;
  lastPromptSeenCount += 1;
  emit("run:quality", { ...args, promptFingerprint: fp, reRun });
}

void emit;