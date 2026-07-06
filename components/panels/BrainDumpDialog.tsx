"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { useBoardStore } from "@/lib/store/boardStore";
import { useUIStore } from "@/lib/store/uiStore";
import { parseBrainDump, scatterPositions } from "@/lib/braindump";
import { getCanvas } from "@/lib/canvasBridge";
import { CARD_W } from "@/lib/constants";

/**
 * The scatter-brain front door: paste anything, one thought per line, and
 * every line lands on the canvas as a typed card ready for AI Organize.
 */
export function BrainDumpDialog() {
  const open = useUIStore((s) => s.brainDumpOpen);
  const [text, setText] = useState("");
  const { toast } = useToast();

  const parsed = useMemo(() => parseBrainDump(text), [text]);
  const close = () => useUIStore.getState().setBrainDumpOpen(false);

  const scatter = () => {
    if (parsed.length === 0) return;
    const state = useBoardStore.getState();
    const center = getCanvas()?.viewportCenterWorld() ?? { x: 0, y: 0 };
    const positions = scatterPositions(parsed.length, {
      x: center.x - CARD_W / 2,
      y: center.y - 60,
    });
    parsed.forEach((item, i) => {
      state.addCard(state.activeBoardId, {
        type: item.type,
        title: item.title,
        body: item.body,
        x: positions[i].x,
        y: positions[i].y,
      });
    });
    setText("");
    close();
    toast({
      message: `${parsed.length} thought${parsed.length > 1 ? "s" : ""} scattered — now hit Organize to cluster them.`,
      variant: "success",
    });
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      ariaLabel="Brain dump"
      className="w-[560px] max-w-[calc(100vw-32px)]"
    >
      <div className="p-5">
        <h2 className="text-[15px] font-semibold tracking-tight">Brain dump</h2>
        <p className="mt-0.5 text-[12.5px] text-[var(--ink-dim)]">
          One thought per line. Questions, todos, links, half-ideas — everything
          becomes a card. I&apos;ll guess the type.
        </p>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) scatter();
            e.stopPropagation();
          }}
          rows={9}
          placeholder={
            "launch the newsletter\nwho is the first customer?\nfix the pricing page\nidea: partner with communities…"
          }
          className="mt-3 w-full rounded-xl bg-[var(--glass)] border
            border-[var(--glass-border)] px-3.5 py-3 text-[13.5px] leading-relaxed
            outline-none resize-none placeholder:text-[var(--ink-faint)]"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={parsed.length === 0}
            onClick={scatter}
            className="h-10 px-5 rounded-full text-[13.5px] font-semibold text-white
              bg-gradient-to-b from-[var(--accent)] to-[var(--accent-2)]
              hover:brightness-110 disabled:opacity-45"
          >
            Scatter onto board
          </button>
          <span className="text-[12.5px] text-[var(--ink-faint)]">
            {parsed.length === 0
              ? "⌘↵ to scatter"
              : `${parsed.length} thought${parsed.length > 1 ? "s" : ""} detected`}
          </span>
        </div>
      </div>
    </Dialog>
  );
}
