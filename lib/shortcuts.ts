"use client";

import { useEffect } from "react";
import type { Command } from "./commands";
import { useUIStore } from "./store/uiStore";

function isTyping(): boolean {
  const t = document.activeElement;
  return (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    (t instanceof HTMLElement && t.isContentEditable)
  );
}

/**
 * Global keymap for the studio. Escape always works; everything else defers
 * to native behavior while the user is typing in a field.
 */
export function useGlobalShortcuts(commands: Command[], enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const byId = new Map(commands.map((c) => [c.id, c]));

    const handler = (e: KeyboardEvent) => {
      const ui = useUIStore.getState();

      if (e.key === "Escape") {
        if (ui.paletteOpen) ui.setPaletteOpen(false);
        else if (ui.helpOpen) ui.setHelpOpen(false);
        else if (ui.brainDumpOpen) ui.setBrainDumpOpen(false);
        else if (ui.linkSuggestions.length > 0) ui.setLinkSuggestions([]);
        else if (ui.toolMode !== "select") ui.setToolMode("select");
        else ui.clearSelection();
        return;
      }

      if (isTyping()) return;
      const mod = e.metaKey || e.ctrlKey;
      const run = (id: string) => {
        e.preventDefault();
        void byId.get(id)?.run();
      };

      if (mod && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ui.setPaletteOpen(!ui.paletteOpen);
        return;
      }
      if (mod && e.key === ".") return run("toggle-xray");
      if (mod && !e.shiftKey && e.key.toLowerCase() === "z") return run("undo");
      if (mod && e.shiftKey && e.key.toLowerCase() === "z") return run("redo");
      if (mod && e.key.toLowerCase() === "a") return run("select-all");
      if (mod) return;

      switch (e.key) {
        case "n":
        case "N":
          return run("new-card");
        case "d":
        case "D":
          return run("new-zone");
        case "b":
        case "B":
          return run("brain-dump");
        case "l":
        case "L":
          return run("link-selected");
        case "?":
          return run("help");
        case "Delete":
        case "Backspace":
          return run("delete-selection");
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commands, enabled]);
}
