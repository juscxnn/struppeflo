"use client";

import { boardHistory, useBoardStore } from "./store/boardStore";
import { useUIStore } from "./store/uiStore";
import {
  runGenerateWorkflow,
  runOrganize,
  runSuggestLinks,
} from "./aiActions";
import { exportWorkspace, parseWorkspaceJson, readFileAsText } from "./importExport";
import { compileBoard } from "./compiler/compile";
import { copyText } from "./clipboard";
import { getCanvas } from "./canvasBridge";
import { CARD_W } from "./constants";
import { emit } from "./events";

export interface Command {
  id: string;
  label: string;
  /** Keyboard hint rendered in the palette (display only). */
  keys?: string[];
  run: () => void | Promise<void>;
}

type Toast = (t: {
  message: string;
  variant?: "info" | "success" | "warn" | "error";
  sticky?: boolean;
  action?: { label: string; onClick: () => void };
}) => void;

function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

export function buildCommands(toast: Toast): Command[] {
  return [
    {
      id: "new-card",
      label: "New card",
      keys: ["N"],
      run: () => {
        const state = useBoardStore.getState();
        const center = getCanvas()?.viewportCenterWorld() ?? { x: 0, y: 0 };
        const id = state.addCard(state.activeBoardId, {
          x: Math.round(center.x - CARD_W / 2),
          y: Math.round(center.y - 48),
        });
        if (id) {
          useUIStore.getState().setSelection([id]);
          useUIStore.getState().setEditingCard(id);
        }
      },
    },
    {
      id: "new-zone",
      label: "Draw zone",
      keys: ["D"],
      run: () => useUIStore.getState().setToolMode("division"),
    },
    {
      id: "brain-dump",
      label: "Brain dump…",
      keys: ["B"],
      run: () => useUIStore.getState().setBrainDumpOpen(true),
    },
    {
      id: "link-selected",
      label: "Link selected cards",
      keys: ["L"],
      run: () => {
        const ui = useUIStore.getState();
        if (ui.selection.length !== 2) {
          toast({
            message: "Select exactly two cards to link them.",
            variant: "info",
          });
          return;
        }
        const state = useBoardStore.getState();
        const id = state.addLink(
          state.activeBoardId,
          ui.selection[0],
          ui.selection[1],
          "related_to",
          false,
        );
        toast({
          message: id
            ? "Linked. Click the line to set the relationship type."
            : "Those cards are already linked.",
          variant: id ? "success" : "info",
        });
      },
    },
    {
      id: "toggle-xray",
      label: "Toggle Prompt X-Ray",
      keys: ["⌘", "."],
      run: () => {
        const ui = useUIStore.getState();
        ui.setXrayOpen(!ui.xrayOpen);
      },
    },
    {
      id: "run-board",
      label: "Run this board with Claude",
      keys: ["R"],
      run: () => useUIStore.getState().setRunOpen(true),
    },
    {
      id: "connect-ai",
      label: "Connect Anthropic key…",
      run: () => useUIStore.getState().setConnectAIOpen(true),
    },
    {
      id: "templates",
      label: "Browse templates…",
      run: () => useUIStore.getState().setTemplatePickerOpen(true),
    },
    {
      id: "zoom-fit",
      label: "Fit board to view",
      keys: ["F"],
      run: () => getCanvas()?.zoomFit(),
    },
    {
      id: "copy-prompt",
      label: "Copy compiled prompt",
      run: async () => {
        const state = useBoardStore.getState();
        const board = state.boards[state.activeBoardId];
        if (!board) return;
        if (await copyText(compileBoard(board).markdown)) {
          emit("compile:copied");
          toast({
            message: "Compiled prompt copied — paste it into Claude.",
            variant: "success",
          });
        } else {
          toast({ message: "Couldn't access the clipboard.", variant: "error" });
        }
      },
    },
    {
      id: "organize",
      label: "AI: Organize loose cards into zones",
      run: () => runOrganize(toast),
    },
    {
      id: "suggest-links",
      label: "AI: Suggest links",
      run: () => runSuggestLinks(toast),
    },
    {
      id: "generate-workflow",
      label: "AI: Generate workflow tab",
      run: () => runGenerateWorkflow(toast),
    },
    {
      id: "new-tab",
      label: "New board tab",
      run: () => {
        useBoardStore.getState().createBoard();
      },
    },
    {
      id: "undo",
      label: "Undo",
      keys: ["⌘", "Z"],
      run: () => boardHistory.undo(),
    },
    {
      id: "redo",
      label: "Redo",
      keys: ["⇧", "⌘", "Z"],
      run: () => boardHistory.redo(),
    },
    {
      id: "select-all",
      label: "Select all cards",
      keys: ["⌘", "A"],
      run: () => {
        const state = useBoardStore.getState();
        const board = state.boards[state.activeBoardId];
        if (board) {
          useUIStore.getState().setSelection(Object.keys(board.cards));
        }
      },
    },
    {
      id: "delete-selection",
      label: "Delete selected cards",
      keys: ["⌫"],
      run: () => {
        const ui = useUIStore.getState();
        if (ui.selection.length === 0) return;
        const state = useBoardStore.getState();
        state.deleteCards(state.activeBoardId, ui.selection);
        ui.clearSelection();
      },
    },
    {
      id: "export",
      label: "Export workspace (JSON)",
      run: () => {
        exportWorkspace(useBoardStore.getState());
        toast({ message: "Workspace exported.", variant: "success" });
      },
    },
    {
      id: "import",
      label: "Import workspace…",
      run: async () => {
        const file = await pickFile();
        if (!file) return;
        let text: string;
        try {
          text = await readFileAsText(file);
        } catch (e) {
          toast({
            message: e instanceof Error ? e.message : "Couldn't read that file.",
            variant: "error",
          });
          return;
        }
        const result = parseWorkspaceJson(text);
        if (!result.ok) {
          toast({ message: result.error, variant: "error" });
          return;
        }
        if (
          !window.confirm(
            "Importing replaces your current workspace. Export first if you want a backup. Continue?",
          )
        ) {
          return;
        }
        useBoardStore.getState().importWorkspace(result.workspace);
        boardHistory.clear();
        toast({ message: "Workspace imported.", variant: "success" });
      },
    },
    {
      id: "toggle-proximity",
      label: "Toggle proximity linking",
      run: () => {
        const ui = useUIStore.getState();
        ui.setProximityLinking(!ui.proximityLinkingEnabled);
        toast({
          message: ui.proximityLinkingEnabled
            ? "Proximity linking off."
            : "Proximity linking on — drag a card close to another.",
          variant: "info",
        });
      },
    },
    {
      id: "toggle-theme",
      label: "Toggle dark mode",
      run: () => {
        const next = !document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", next);
        try {
          localStorage.setItem("struppeflo-theme", next ? "dark" : "light");
        } catch {
          // Session-only theme when storage is unavailable.
        }
      },
    },
    {
      id: "replay-tour",
      label: "Replay the tour",
      run: () => {
        useUIStore.getState().patchOnboarding({
          status: "in_progress",
          stepIndex: 3,
          tour: {
            createdCard: false,
            madeLink: false,
            openedXRay: false,
            copiedPrompt: false,
          },
        });
      },
    },
    {
      id: "help",
      label: "Keyboard shortcuts & help",
      keys: ["?"],
      run: () => useUIStore.getState().setHelpOpen(true),
    },
    {
      id: "reset-workspace",
      label: "Reset workspace…",
      run: () => {
        if (
          window.confirm(
            "This deletes every board in this browser. Export first if you want a backup. Reset?",
          )
        ) {
          useBoardStore.getState().resetWorkspace();
          boardHistory.clear();
          toast({ message: "Workspace reset.", variant: "info" });
        }
      },
    },
  ];
}
