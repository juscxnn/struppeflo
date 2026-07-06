"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Kbd } from "@/components/ui/Kbd";
import { useUIStore } from "@/lib/store/uiStore";
import type { Command } from "@/lib/commands";

function matches(query: string, label: string): boolean {
  // Subsequence match: "swl" hits "Suggest links".
  const q = query.toLowerCase();
  const l = label.toLowerCase();
  let i = 0;
  for (const ch of l) {
    if (ch === q[i]) i++;
    if (i === q.length) return true;
  }
  return q.length === 0;
}

export function CommandPalette({ commands }: { commands: Command[] }) {
  const open = useUIStore((s) => s.paletteOpen);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => commands.filter((c) => matches(query, c.label)),
    [commands, query],
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  const close = () => useUIStore.getState().setPaletteOpen(false);

  const execute = (cmd: Command | undefined) => {
    if (!cmd) return;
    close();
    void cmd.run();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      ariaLabel="Command palette"
      className="w-[520px] max-w-[calc(100vw-32px)] mt-[12vh] mb-auto"
    >
      <div className="p-2">
        <input
          autoFocus
          value={query}
          placeholder="Type a command…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              execute(filtered[index]);
            }
            e.stopPropagation();
          }}
          className="w-full h-11 px-3.5 rounded-xl bg-[var(--glass)] outline-none
            text-[14px] placeholder:text-[var(--ink-faint)]"
        />
        <div
          ref={listRef}
          className="mt-1.5 max-h-[320px] overflow-y-auto thin-scroll flex flex-col"
        >
          {filtered.length === 0 && (
            <div className="px-3.5 py-6 text-center text-[13px] text-[var(--ink-faint)]">
              No matching commands
            </div>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              type="button"
              onClick={() => execute(cmd)}
              onMouseEnter={() => setIndex(i)}
              className={`flex items-center gap-2 px-3.5 h-10 rounded-xl text-left
                text-[13.5px] ${i === index ? "bg-[var(--accent-soft)]" : ""}`}
            >
              <span className="truncate">{cmd.label}</span>
              {cmd.keys && (
                <span className="ml-auto flex items-center gap-1">
                  {cmd.keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
