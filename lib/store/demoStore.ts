import { createStore, type StoreApi } from "zustand/vanilla";
import { createWorkspaceSlice, type WorkspaceState } from "./boardStore";
import type { Workspace } from "../types";

export type WorkspaceStore = StoreApi<WorkspaceState>;

/**
 * Throwaway board store for the landing-page demo: same state machine as the
 * studio store, no persistence, no undo history. Each mount gets its own.
 */
export function createDemoStore(initial: Workspace): WorkspaceStore {
  return createStore<WorkspaceState>()(createWorkspaceSlice(initial));
}
