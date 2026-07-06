"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { applyTemplate } from "@/lib/workspaceOps";
import { useUIStore } from "@/lib/store/uiStore";
import { useBoardStore } from "@/lib/store/boardStore";
import { TemplateGallery } from "@/components/onboarding/TemplateGallery";
import { AuroraBackground } from "@/components/AuroraBackground";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { DumpIcon } from "@/components/ui/icons";
import type { TemplateId } from "@/lib/templates";

/**
 * First-run entry screen. Shown only when the workspace is empty.
 * Templates are the primary CTA. A blank canvas and the brain dump are
 * secondary — most users should start from a template.
 */
export function StudioEntry() {
  const router = useRouter();
  const boards = useBoardStore((s) => s.boards);
  const boardOrder = useBoardStore((s) => s.boardOrder);
  const cards = Object.values(boards).flatMap((b) => Object.keys(b.cards));
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Don't render until mounted to avoid hydration mismatch.
  if (!mounted) return null;
  const isEmpty =
    boardOrder.length === 0 || cards.length === 0;

  if (!isEmpty) return null;

  const pick = (id: TemplateId) => {
    if (useUIStore.getState().onboarding.status === "unseen") {
      useUIStore.getState().patchOnboarding({ status: "skipped" });
    }
    applyTemplate(id);
    router.refresh();
  };

  const blank = () => {
    if (useUIStore.getState().onboarding.status === "unseen") {
      useUIStore.getState().patchOnboarding({ status: "in_progress", stepIndex: 1 });
    }
    useBoardStore.getState().createBoard("Untitled");
    router.refresh();
  };

  const dump = () => {
    useUIStore.getState().setBrainDumpOpen(true);
  };

  return (
    <div className="relative min-h-dvh flex flex-col">
      <AuroraBackground />
      <header className="relative z-10 flex items-center justify-end px-6 pt-4">
        <ThemeToggle />
      </header>
      <main className="relative z-10 flex-1 px-6 py-10 max-w-6xl mx-auto w-full">
        <div className="text-[11px] font-semibold tracking-[0.14em] text-[var(--ink-faint)]">
          STUDIO
        </div>
        <h1 className="mt-2 text-[clamp(28px,4vw,40px)] font-semibold tracking-[-0.02em]">
          Pick a template. Fill it in. Run.
        </h1>
        <p className="mt-3 text-[14.5px] text-[var(--ink-dim)] max-w-xl">
          Each template is a complete job. The board shows the structure,
          the AI brief compiles from it, and the output comes back shaped
          by your zones.
        </p>

        <div className="mt-8">
          <TemplateGallery onPick={pick} compact />
        </div>

        <div className="mt-8 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={blank}
            className="h-10 px-4 rounded-lg text-[13px] font-medium
              text-[var(--ink-dim)] hover:text-[var(--ink)] hover:bg-[var(--accent-soft)]"
          >
            Start with a blank canvas
          </button>
          <button
            type="button"
            onClick={dump}
            className="h-10 px-4 inline-flex items-center gap-1.5 rounded-lg
              text-[13px] font-medium text-[var(--ink-dim)]
              hover:text-[var(--ink)] hover:bg-[var(--accent-soft)]"
          >
            <DumpIcon size={14} />
            Brain dump
          </button>
        </div>
      </main>
    </div>
  );
}