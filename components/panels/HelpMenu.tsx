"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog } from "@/components/ui/Dialog";
import { Popover, type AnchorRect } from "@/components/ui/Popover";
import { Kbd } from "@/components/ui/Kbd";
import { useToast } from "@/components/ui/Toast";
import { HelpIcon } from "@/components/ui/icons";
import { useUIStore } from "@/lib/store/uiStore";
import { useTelemetryOptIn } from "@/lib/useTelemetryOptIn";
import { track } from "@/lib/analytics";
import type { Command } from "@/lib/commands";

const SHORTCUTS: Array<{ keys: string[]; what: string }> = [
  { keys: ["N"], what: "New card" },
  { keys: ["double-click"], what: "New card at cursor" },
  { keys: ["D"], what: "Draw a zone" },
  { keys: ["B"], what: "Brain dump" },
  { keys: ["L"], what: "Link two selected cards" },
  { keys: ["drag close"], what: "Link by proximity" },
  { keys: ["drag + handle"], what: "Draw a link" },
  { keys: ["R"], what: "Run the board" },
  { keys: ["F"], what: "Fit board to view" },
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
  const [telemetryOn, setTelemetryOn] = useTelemetryOptIn();
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
        className="glass-strong absolute bottom-5 right-5 z-40 w-10 h-10
          rounded-lg inline-flex items-center justify-center
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
            <button
              type="button"
              className={item}
              onClick={() => run("connect-ai")}
            >
              Connect Anthropic key…
            </button>
            <div className="h-px my-1 bg-[var(--glass-border)]" />
            <button
              type="button"
              className={item}
              onClick={() => {
                const next = !telemetryOn;
                setTelemetryOn(next);
                track(next ? "telemetry_opt_in" : "telemetry_opt_out");
                toast({
                  message: next
                    ? "Sharing structural telemetry. Off any time from here."
                    : "Telemetry off.",
                  variant: next ? "success" : "info",
                });
              }}
            >
              <span className="flex flex-col items-start leading-tight">
                <span>Help improve Struppëflo</span>
                <span className="text-[10.5px] text-[var(--ink-faint)] font-normal">
                  Board structure only · no titles or prompts
                </span>
              </span>
              <span
                className={`ml-auto text-[11px] font-semibold ${telemetryOn ? "text-[var(--accent)]" : "text-[var(--ink-faint)]"}`}
              >
                {telemetryOn ? "ON" : "OFF"}
              </span>
            </button>
            <Link
              href="/privacy"
              className="flex items-center px-3 h-8 rounded-lg text-[12px] text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--accent-soft)] transition-colors"
            >
              Privacy details →
            </Link>
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
            className="btn-primary mt-4 h-9 px-4 rounded-lg text-[13px]
              font-semibold w-full"
          >
            Got it
          </button>
        </div>
      </Dialog>
    </>
  );
}
