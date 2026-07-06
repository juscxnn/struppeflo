"use client";

import { useBoardStore } from "./store/boardStore";
import { useUIStore } from "./store/uiStore";
import { instantiateTemplate, type TemplateId } from "./templates";

/**
 * Instantiate a template as a new tab. If the workspace is a single untouched
 * board (fresh install), the empty board is replaced instead of kept around.
 */
export function applyTemplate(templateId: TemplateId): string {
  const state = useBoardStore.getState();
  const prior = state.boards[state.activeBoardId];
  const priorIsLoneEmptyBoard =
    prior !== undefined &&
    state.boardOrder.length === 1 &&
    Object.keys(prior.cards).length === 0 &&
    Object.keys(prior.divisions).length === 0;

  const board = instantiateTemplate(templateId);
  state.insertBoard(board);
  if (priorIsLoneEmptyBoard) {
    useBoardStore.getState().closeBoard(prior.id);
  }
  useUIStore.getState().setBoardTemplate(board.id, templateId);
  return board.id;
}
