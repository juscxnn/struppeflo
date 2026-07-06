"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { Board } from "@/components/board/Board";
import { createDemoStore, type WorkspaceStore } from "@/lib/store/demoStore";
import { demoWorkspace } from "@/lib/templates/demo";
import { compileBoard } from "@/lib/compiler/compile";
import { copyText } from "@/lib/clipboard";
import { DEMO_POLICY } from "@/lib/constants";
import { useToast } from "@/components/ui/Toast";
import { CopyIcon } from "@/components/ui/icons";

const WORLD_W = 980;
const WORLD_H = 560;

/**
 * The landing demo IS the real Board component — DEMO policy (no pan/zoom,
 * no create/delete, positions clamped) on a throwaway store, with a live
 * mini X-Ray beside it so dragging cards visibly rewrites the compiled
 * prompt. Created client-side only (fresh UUIDs would break hydration).
 */
export function DemoBoard() {
  const [store, setStore] = useState<WorkspaceStore | null>(null);
  const [scale, setScale] = useState(1);
  const [generation, setGeneration] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStore(createDemoStore(demoWorkspace()));
  }, [generation]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / WORLD_W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [store]);

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-stretch">
      <div className="glass-strong rounded-3xl p-3 relative">
        <div ref={frameRef} className="relative overflow-hidden rounded-2xl">
          <div style={{ height: WORLD_H * scale }}>
            {store ? (
              // Keyed by scale: the camera is seeded once per mount, so a
              // late container measurement must remount the board.
              <Board
                key={`${generation}-${scale}`}
                store={store}
                policy={DEMO_POLICY}
                initialCamera={{ tx: 0, ty: 0, s: scale }}
                className="absolute inset-0"
              />
            ) : (
              <div
                className="absolute inset-0 flex items-center justify-center
                  text-[13px] text-[var(--ink-faint)]"
              >
                Loading the board…
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setGeneration((g) => g + 1)}
          className="absolute bottom-6 right-6 z-40 h-8 px-3 rounded-full glass-strong
            glass-blur text-[12px] font-medium text-[var(--ink-dim)]
            hover:text-[var(--ink)]"
        >
          Reset demo
        </button>
      </div>

      <div className="glass-strong rounded-3xl p-4 flex flex-col min-h-[320px]">
        {store ? (
          <DemoXRay store={store} />
        ) : (
          <div className="text-[12px] text-[var(--ink-faint)]">Compiling…</div>
        )}
      </div>
    </div>
  );
}

function DemoXRay({ store }: { store: WorkspaceStore }) {
  const board = useStore(store, (s) => s.boards[s.activeBoardId]);
  const [markdown, setMarkdown] = useState("");
  const preRef = useRef<HTMLPreElement>(null);
  const first = useRef(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!board) return;
    const t = setTimeout(() => {
      setMarkdown(compileBoard(board).markdown);
      if (!first.current && preRef.current) {
        preRef.current.classList.remove("xray-flash");
        void preRef.current.offsetWidth;
        preRef.current.classList.add("xray-flash");
      }
      first.current = false;
    }, 150);
    return () => clearTimeout(t);
  }, [board]);

  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <span
          aria-hidden
          className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"
        />
        <span className="text-[12.5px] font-semibold tracking-tight">
          Compiled prompt — live
        </span>
        <button
          type="button"
          aria-label="Copy compiled prompt"
          onClick={async () => {
            if (await copyText(markdown)) {
              toast({ message: "Copied — try it in Claude.", variant: "success" });
            } else {
              toast({ message: "Couldn't access the clipboard.", variant: "error" });
            }
          }}
          className="ml-auto w-7 h-7 inline-flex items-center justify-center
            rounded-full text-[var(--ink-faint)] hover:text-[var(--ink)]
            hover:bg-[var(--accent-soft)]"
        >
          <CopyIcon size={13} />
        </button>
      </div>
      <pre
        ref={preRef}
        className="thin-scroll flex-1 overflow-auto rounded-xl px-3 py-2 max-h-[480px]
          text-[10.5px] leading-relaxed font-mono whitespace-pre-wrap
          text-[var(--ink-dim)] bg-[var(--glass)]"
      >
        {markdown}
      </pre>
      <div className="mt-2 text-[11px] leading-snug text-[var(--ink-faint)]">
        Drag a card into the other zone, or close to another card until it
        glows — the prompt restructures itself.
      </div>
    </>
  );
}
