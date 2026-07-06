"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { Board } from "@/components/board/Board";
import { BrainDumpDialog } from "@/components/panels/BrainDumpDialog";
import { CommandPalette } from "@/components/panels/CommandPalette";
import { ConnectAIDialog } from "@/components/panels/ConnectAIDialog";
import { HelpMenu } from "@/components/panels/HelpMenu";
import { NextActionBar } from "@/components/panels/NextActionBar";
import { RunPanel } from "@/components/panels/RunPanel";
import { RunsDrawer } from "@/components/panels/RunsDrawer";
import { SparkDock } from "@/components/panels/SparkDock";
import { TabBar } from "@/components/panels/TabBar";
import { TemplatePickerDialog } from "@/components/panels/TemplatePickerDialog";
import { Toolbar } from "@/components/panels/Toolbar";
import { XRayPanel } from "@/components/panels/XRayPanel";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useToast } from "@/components/ui/Toast";
import { Kbd } from "@/components/ui/Kbd";
import { RedoIcon, UndoIcon } from "@/components/ui/icons";
import { buildCommands } from "@/lib/commands";
import { useGlobalShortcuts } from "@/lib/shortcuts";
import {
  DEFAULT_POLICY,
  STORAGE_KEY_UI,
  STORAGE_KEY_WORKSPACE,
} from "@/lib/constants";
import { boardHistory, useBoardStore } from "@/lib/store/boardStore";
import { onStorageIssue } from "@/lib/store/storage";
import { useUIStore } from "@/lib/store/uiStore";
import { TEMPLATES, type TemplateId } from "@/lib/templates";
import { applyTemplate } from "@/lib/workspaceOps";
import { useSessionTracker } from "@/lib/sessionTracker";
import { StudioEntry } from "@/components/StudioEntry";

export function StudioShell() {
  // Persisted stores rehydrate client-side before first paint; gate rendering
  // until mounted so server HTML never mismatches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { toast } = useToast();
  const commands = useMemo(() => buildCommands(toast), [toast]);
  useGlobalShortcuts(commands, mounted);
  useSessionTracker();

  // Multi-tab: when another tab writes the persisted stores, rehydrate so
  // stale in-memory state here never clobbers newer state on the next write.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_WORKSPACE) {
        void useBoardStore.persist.rehydrate();
      } else if (e.key === STORAGE_KEY_UI) {
        void useUIStore.persist.rehydrate();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const doExport = () => void commands.find((c) => c.id === "export")?.run();
    return onStorageIssue((issue) => {
      if (issue === "near-quota") {
        toast({
          message:
            "Your workspace is close to the browser storage limit — export a backup.",
          variant: "warn",
          sticky: true,
          action: { label: "Export", onClick: doExport },
        });
      } else {
        toast({
          message:
            "Browser storage is full — changes are staying in memory only. Export now to keep them.",
          variant: "error",
          sticky: true,
          action: { label: "Export", onClick: doExport },
        });
      }
    });
  }, [toast, commands]);

  const onboardingActive = useUIStore(
    (s) =>
      s.onboarding.status === "unseen" || s.onboarding.status === "in_progress",
  );
  const undoable = useStore(
    useBoardStore.temporal,
    (s) => s.pastStates.length > 0,
  );
  const redoable = useStore(
    useBoardStore.temporal,
    (s) => s.futureStates.length > 0,
  );

  if (!mounted) return <div className="h-dvh" aria-busy />;

  // First-run: empty workspace → template gallery as the entry.
  const totalCards = Object.values(useBoardStore.getState().boards).reduce(
    (acc, b) => acc + Object.keys(b.cards).length,
    0,
  );
  if (totalCards === 0) {
    return <StudioEntry />;
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <header className="relative z-40 flex items-center gap-3 px-4 pt-3 pb-2">
        <Link
          href="/"
          className="shrink-0 text-[15px] font-bold tracking-tight
            hover:text-[var(--accent)] transition-colors"
        >
          Struppëflo
        </Link>
        <div className="w-px h-5 bg-[var(--glass-border)] shrink-0" />
        <TabBar />
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label="Undo"
            title="Undo (⌘Z)"
            disabled={!undoable}
            onClick={() => boardHistory.undo()}
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg
              text-[var(--ink-dim)] hover:bg-[var(--accent-soft)]
              disabled:opacity-35"
          >
            <UndoIcon size={15} />
          </button>
          <button
            type="button"
            aria-label="Redo"
            title="Redo (⇧⌘Z)"
            disabled={!redoable}
            onClick={() => boardHistory.redo()}
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg
              text-[var(--ink-dim)] hover:bg-[var(--accent-soft)]
              disabled:opacity-35"
          >
            <RedoIcon size={15} />
          </button>
          <button
            type="button"
            onClick={() => useUIStore.getState().setPaletteOpen(true)}
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg
              text-[12.5px] font-medium text-[var(--ink-dim)]
              hover:bg-[var(--accent-soft)]"
          >
            Commands
            <Kbd>⌘K</Kbd>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative flex-1 min-h-0">
        <Board
          store={useBoardStore}
          policy={DEFAULT_POLICY}
          history={boardHistory}
        />
        <Toolbar />
        <NextActionBar />
        <SparkDock />
        <XRayPanel />
        <RunPanel />
        <RunsDrawer />
        <HelpMenu commands={commands} />
      </main>

      <CommandPalette commands={commands} />
      <BrainDumpDialog />
      <ConnectAIDialog />
      <TemplatePickerDialog />
      <Suspense fallback={null}>
        <TemplateBootstrap />
      </Suspense>
      {onboardingActive && <OnboardingFlow />}
    </div>
  );
}

/** Handles /studio?template=… deep links from the landing page. */
function TemplateBootstrap() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    const requested = searchParams.get("template");
    if (!requested) return;
    done.current = true;

    const template = TEMPLATES.find((t) => t.id === requested);
    if (template) {
      applyTemplate(template.id as TemplateId);
      // They chose a starting point — don't stack the full stepper on top.
      if (useUIStore.getState().onboarding.status === "unseen") {
        useUIStore.getState().patchOnboarding({ status: "skipped" });
      }
    }
    router.replace("/studio");
  }, [searchParams, router]);

  return null;
}
