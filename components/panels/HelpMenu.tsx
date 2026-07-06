"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Popover, type AnchorRect } from "@/components/ui/Popover";
import { Kbd } from "@/components/ui/Kbd";
import { useToast } from "@/components/ui/Toast";
import { HelpIcon } from "@/components/ui/icons";
import { useUIStore } from "@/lib/store/uiStore";
import type { Command } from "@/lib/commands";

const SHORTCUTS: Array<{ keys: string[]; what: string }> = [
  { keys: ["N"], what: "New card" },
  { keys: ["double-click"], what: "New card at cursor" },
  { keys: ["D"], what: "Draw a zone" },
  { keys: ["B"], what: "Brain dump" },
  { keys: ["L"], what: "Link two selected cards" },
  { keys: ["drag close"], what: "Link by proximity" },
  { keys: ["⌘", "."], what: "Prompt X-Ray" },
  { keys: ["⌘", "K"], what: "Command palette" },
  { keys: ["⌘", "Z"], what: "Undo" },
  { keys: ["⇧", "⌘", "Z"], what: "Redo" },
  { keys: ["⌘", "A"], what: "Select all" },
  { keys: ["⌫"], what: "Delete selection" },
  { keys: ["space", "drag"], what: "Pan the canvas" },
  { keys: ["⌘", "scroll"], what: "Zoom" },
  { keys: ["⌥", "drag zone"], what: "Move zone frame only" },
];

export function HelpMenu({ commands }: { commands: Command[] }) {
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const helpOpen = useUIStore((s) => s.helpOpen);
  const proximity = useUIStore((s) => s.proximityLinkingEnabled);
  const { toast } = useToast();

  const run = (id: string) => {
    setAnchor(null);
    void commands.find((c) => c.id === id)?.run();
  };

  const item =
    "flex items-center gap-2 w-full px-3 h-9 rounded-lg text-left text-[13px] hover:bg-[var(--accent-soft)]";

  return (
    <>
      <button
        type="button"
        aria-label="Help"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAnchor({ x: r.x, y: r.y, w: r.width, h: r.height });
        }}
        className="absolute bottom-5 right-5 z-40 w-10 h-10 glass-strong glass-blur
          rounded-full inline-flex items-center justify-center
          text-[var(--ink-dim)] hover:text-[var(--ink)]"
      >
        <HelpIcon size={17} />
      </button>

      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)}>
          <div className="p-1.5 w-60">
            <button type="button" className={item} onClick={() => run("help")}>
              Keyboard shortcuts
              <span className="ml-auto">
                <Kbd>?</Kbd>
              </span>
            </button>
            <button
              type="button"
              className={item}
              onClick={() => run("replay-tour")}
            >
              Replay the tour
            </button>
            <button
              type="button"
              className={item}
              onClick={() => {
                run("toggle-proximity");
              }}
            >
              Proximity linking
              <span
                className={`ml-auto text-[11px] font-semibold ${proximity ? "text-[var(--accent)]" : "text-[var(--ink-faint)]"}`}
              >
                {proximity ? "ON" : "OFF"}
              </span>
            </button>
            <div className="h-px my-1 bg-[var(--glass-border)]" />
            <button type="button" className={item} onClick={() => run("export")}>
              Export workspace (JSON)
            </button>
            <button type="button" className={item} onClick={() => run("import")}>
              Import workspace…
            </button>
            <button
              type="button"
              className={`${item} text-[var(--danger)]`}
              onClick={() => run("reset-workspace")}
            >
              Reset workspace…
            </button>
            <div className="h-px my-1 bg-[var(--glass-border)]" />
            <div className="px-3 py-2 text-[11.5px] leading-snug text-[var(--ink-faint)]">
              Local-first: your boards live in this browser and never touch a
              server.
            </div>
          </div>
        </Popover>
      )}

      <Dialog
        open={helpOpen}
        onClose={() => useUIStore.getState().setHelpOpen(false)}
        ariaLabel="Keyboard shortcuts"
        className="w-[440px] max-w-[calc(100vw-32px)]"
      >
        <div className="p-5">
          <h2 className="text-[15px] font-semibold tracking-tight mb-3">
            Keyboard shortcuts
          </h2>
          <div className="flex flex-col gap-1.5">
            {SHORTCUTS.map((s) => (
              <div key={s.what} className="flex items-center text-[13px]">
                <span className="text-[var(--ink-dim)]">{s.what}</span>
                <span className="ml-auto flex items-center gap-1">
                  {s.keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              useUIStore.getState().setHelpOpen(false);
              toast({
                message: "Tip: the board compiles into a prompt — hit ⌘. to see it.",
                variant: "info",
              });
            }}
            className="mt-4 h-9 px-4 rounded-full text-[13px] font-semibold text-white
              bg-gradient-to-b from-[var(--accent)] to-[var(--accent-2)] w-full"
          >
            Got it
          </button>
        </div>
      </Dialog>
    </>
  );
}
