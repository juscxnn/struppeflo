"use client";

import { getProvider } from "./ai/provider";
import { getCanvas } from "./canvasBridge";
import { boardHistory, useBoardStore } from "./store/boardStore";
import { useUIStore } from "./store/uiStore";
import type { Persona } from "./types";

type Toast = (t: {
  message: string;
  variant?: "info" | "success" | "warn" | "error";
  action?: { label: string; onClick: () => void };
}) => void;

/**
 * Shared entry points for the toolbar buttons and command palette. Each is
 * guarded against double-fire via the aiBusy flag.
 */

export async function runOrganize(toast: Toast): Promise<void> {
  const ui = useUIStore.getState();
  if (ui.aiBusy) return;
  const state = useBoardStore.getState();
  const board = state.boards[state.activeBoardId];
  if (!board) return;

  ui.setAiBusy("organize");
  try {
    const plan = await getProvider().organize(board);
    if (plan.divisions.length === 0) {
      toast({
        message: "Nothing to organize — add a few cards outside any zone first.",
        variant: "info",
      });
      return;
    }
    // FLIP: transition left/top for this one commit.
    getCanvas()?.setWorldClass("organize-settle", true);
    useBoardStore.getState().applyOrganize(board.id, plan);
    setTimeout(() => getCanvas()?.setWorldClass("organize-settle", false), 500);
    toast({
      message: `Organized ${Object.keys(plan.assignments).length} cards into ${plan.divisions.length} zones.`,
      variant: "success",
      action: { label: "Undo", onClick: () => boardHistory.undo() },
    });
  } finally {
    useUIStore.getState().setAiBusy(null);
  }
}

export async function runSuggestLinks(toast: Toast): Promise<void> {
  const ui = useUIStore.getState();
  if (ui.aiBusy) return;
  const state = useBoardStore.getState();
  const board = state.boards[state.activeBoardId];
  if (!board) return;

  ui.setAiBusy("links");
  try {
    const suggestions = await getProvider().suggestLinks(board);
    if (suggestions.length === 0) {
      toast({
        message:
          "No link suggestions — cards need a bit more text for me to relate them.",
        variant: "info",
      });
      return;
    }
    useUIStore.getState().setLinkSuggestions(suggestions);
    toast({
      message: `${suggestions.length} link suggestion${suggestions.length > 1 ? "s" : ""} — click ✓ to accept.`,
      variant: "info",
    });
  } finally {
    useUIStore.getState().setAiBusy(null);
  }
}

export async function runGenerateWorkflow(toast: Toast): Promise<void> {
  const ui = useUIStore.getState();
  if (ui.aiBusy) return;
  const state = useBoardStore.getState();
  const board = state.boards[state.activeBoardId];
  if (!board) return;
  if (Object.keys(board.cards).length < 2) {
    toast({
      message: "Add at least two cards before generating a workflow.",
      variant: "info",
    });
    return;
  }

  ui.setAiBusy("workflow");
  try {
    const plan = await getProvider().generateWorkflow(board);
    useBoardStore.getState().insertBoard(plan.board);
    toast({
      message: `Workflow tab created — dependency-ordered lanes from "${board.name}".`,
      variant: "success",
    });
  } finally {
    useUIStore.getState().setAiBusy(null);
  }
}

export async function fetchSparks(persona: Persona | null) {
  const state = useBoardStore.getState();
  const board = state.boards[state.activeBoardId];
  if (!board) return [];
  const templateId =
    useUIStore.getState().boardTemplates[board.id] ?? null;
  return getProvider().sparkQuestions(board, persona, templateId);
}
