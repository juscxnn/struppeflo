import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { STORAGE_KEY_UI } from "../constants";
import { emit } from "../events";
import { guardedStorage } from "./storage";
import type { Camera, ID, LinkSuggestion, OnboardingState } from "../types";

export type ToolMode = "select" | "division";
export type AiJob = "organize" | "links" | "workflow" | null;

interface UIState {
  selection: ID[];
  editingCardId: ID | null;
  xrayOpen: boolean;
  paletteOpen: boolean;
  helpOpen: boolean;
  toolMode: ToolMode;
  proximityLinkingEnabled: boolean;
  onboarding: OnboardingState;
  savedCameras: Record<ID, Camera>;
  /** Pending AI link suggestions rendered as ghost links (not persisted). */
  linkSuggestions: LinkSuggestion[];
  aiBusy: AiJob;
  brainDumpOpen: boolean;
  runOpen: boolean;
  connectAIOpen: boolean;
  templatePickerOpen: boolean;
  /** Show the execution-flow overlay on the board (numbered zones + arrows). */
  showFlow: boolean;
  /** Whether Flow has been auto-shown for each board (so we don't keep
   *  flipping it on after the user has dismissed it once). */
  flowAutoShownFor: Record<ID, boolean>;
  /** Past-runs drawer (sliding right-rail). */
  runsDrawerOpen: boolean;
  /** Which template a board was seeded from (feeds spark questions). */
  boardTemplates: Record<ID, string>;

  setSelection: (ids: ID[]) => void;
  toggleSelected: (id: ID) => void;
  clearSelection: () => void;
  setEditingCard: (id: ID | null) => void;
  setXrayOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  setToolMode: (mode: ToolMode) => void;
  setProximityLinking: (enabled: boolean) => void;
  patchOnboarding: (patch: Partial<OnboardingState>) => void;
  setTourFlag: (flag: keyof OnboardingState["tour"]) => void;
  saveCamera: (boardId: ID, camera: Camera) => void;
  setLinkSuggestions: (s: LinkSuggestion[]) => void;
  setAiBusy: (job: AiJob) => void;
  setBrainDumpOpen: (open: boolean) => void;
  setRunOpen: (open: boolean) => void;
  setConnectAIOpen: (open: boolean) => void;
  setTemplatePickerOpen: (open: boolean) => void;
  setShowFlow: (show: boolean) => void;
  markFlowAutoShown: (boardId: ID) => void;
  setRunsDrawerOpen: (open: boolean) => void;
  setBoardTemplate: (boardId: ID, templateId: string) => void;
}

const initialOnboarding: OnboardingState = {
  status: "unseen",
  stepIndex: 0,
  persona: null,
  tour: {
    createdCard: false,
    madeLink: false,
    openedXRay: false,
    copiedPrompt: false,
  },
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      selection: [],
      editingCardId: null,
      xrayOpen: false,
      paletteOpen: false,
      helpOpen: false,
      toolMode: "select",
      proximityLinkingEnabled: true,
      onboarding: initialOnboarding,
      savedCameras: {},
      linkSuggestions: [],
      aiBusy: null,
      brainDumpOpen: false,
      runOpen: false,
      connectAIOpen: false,
      templatePickerOpen: false,
      showFlow: false,
      flowAutoShownFor: {},
      runsDrawerOpen: false,
      boardTemplates: {},

      setSelection: (ids) => set({ selection: ids }),
      toggleSelected: (id) =>
        set((s) => ({
          selection: s.selection.includes(id)
            ? s.selection.filter((x) => x !== id)
            : [...s.selection, id],
        })),
      clearSelection: () => set({ selection: [], editingCardId: null }),
      setEditingCard: (id) => set({ editingCardId: id }),
      setXrayOpen: (open) => {
        // X-Ray and Run share the right rail — only one open at a time.
        set(open ? { xrayOpen: true, runOpen: false } : { xrayOpen: false });
        if (open) emit("panel:xray:opened");
      },
      setPaletteOpen: (open) => set({ paletteOpen: open }),
      setHelpOpen: (open) => set({ helpOpen: open }),
      setToolMode: (mode) => set({ toolMode: mode }),
      setProximityLinking: (enabled) =>
        set({ proximityLinkingEnabled: enabled }),
      patchOnboarding: (patch) =>
        set((s) => ({ onboarding: { ...s.onboarding, ...patch } })),
      setTourFlag: (flag) =>
        set((s) => {
          const tour = { ...s.onboarding.tour, [flag]: true };
          const done = Object.values(tour).every(Boolean);
          return {
            onboarding: {
              ...s.onboarding,
              tour,
              status: done ? "done" : s.onboarding.status,
            },
          };
        }),
      saveCamera: (boardId, camera) =>
        set((s) => ({
          savedCameras: { ...s.savedCameras, [boardId]: camera },
        })),
      setLinkSuggestions: (suggestions) =>
        set({ linkSuggestions: suggestions }),
      setAiBusy: (job) => set({ aiBusy: job }),
      setBrainDumpOpen: (open) => set({ brainDumpOpen: open }),
      setRunOpen: (open) =>
        set(open ? { runOpen: true, xrayOpen: false } : { runOpen: false }),
      setConnectAIOpen: (open) => set({ connectAIOpen: open }),
      setTemplatePickerOpen: (open) => set({ templatePickerOpen: open }),
      setShowFlow: (show) => set({ showFlow: show }),
      markFlowAutoShown: (boardId) =>
        set((s) => ({
          flowAutoShownFor: { ...s.flowAutoShownFor, [boardId]: true },
        })),
      setRunsDrawerOpen: (open) => set({ runsDrawerOpen: open }),
      setBoardTemplate: (boardId, templateId) =>
        set((s) => ({
          boardTemplates: { ...s.boardTemplates, [boardId]: templateId },
        })),
    }),
    {
      name: STORAGE_KEY_UI,
      storage: createJSONStorage(() => guardedStorage),
      partialize: (s) => ({
        proximityLinkingEnabled: s.proximityLinkingEnabled,
        onboarding: s.onboarding,
        savedCameras: s.savedCameras,
        boardTemplates: s.boardTemplates,
      }),
    },
  ),
);
