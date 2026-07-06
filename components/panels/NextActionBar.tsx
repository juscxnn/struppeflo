"use client";

import { useState } from "react";
import { useBoardStore } from "@/lib/store/boardStore";
import { useUIStore } from "@/lib/store/uiStore";
import { runOrganize, runSuggestLinks } from "@/lib/aiActions";
import { useToast } from "@/components/ui/Toast";
import { CompassIcon } from "@/components/ui/icons";

interface Suggestion {
  id: string;
  text: string;
  action: string;
  run: () => void;
}

/**
 * The guide layer for people who don't organize like a PM: one context-aware
 * next-best-action at a time, in the order the product's loop actually works
 * (dump → organize → link → compile → run). Dismissals stick per session.
 */
export function NextActionBar() {
  const board = useBoardStore((s) => s.boards[s.activeBoardId]);
  const xrayOpen = useUIStore((s) => s.xrayOpen);
  const runOpen = useUIStore((s) => s.runOpen);
  const aiBusy = useUIStore((s) => s.aiBusy);
  const onboardingActive = useUIStore(
    (s) =>
      s.onboarding.status === "unseen" || s.onboarding.status === "in_progress",
  );
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [seenXray, setSeenXray] = useState(false);

  if (!board || onboardingActive || aiBusy || runOpen) return null;
  if (xrayOpen && !seenXray) setSeenXray(true);

  const cards = Object.values(board.cards);
  const links = Object.keys(board.links).length;
  const divisions = Object.keys(board.divisions).length;
  const loose = cards.filter((c) => c.divisionId === null).length;
  const ui = useUIStore.getState();

  let suggestion: Suggestion | null = null;
  if (cards.length >= 4 && divisions === 0 && loose >= 4) {
    suggestion = {
      id: "organize",
      text: `${loose} loose cards — I can group them into zones for you.`,
      action: "Organize",
      run: () => void runOrganize(toast),
    };
  } else if (cards.length >= 3 && links === 0 && divisions > 0) {
    suggestion = {
      id: "links",
      text: "Zones are set. Want me to suggest how the cards connect?",
      action: "Suggest links",
      run: () => void runSuggestLinks(toast),
    };
  } else if (cards.length >= 3 && links > 0 && !seenXray && !xrayOpen) {
    suggestion = {
      id: "xray",
      text: "Your board already compiles into a structured prompt.",
      action: "See it (⌘.)",
      run: () => ui.setXrayOpen(true),
    };
  } else if (cards.length >= 3 && links > 0 && seenXray) {
    suggestion = {
      id: "run",
      text: "This board is ready to run.",
      action: "Run it",
      run: () => ui.setRunOpen(true),
    };
  }

  if (!suggestion || dismissed.has(suggestion.id)) return null;
  const current = suggestion;

  return (
    <div
      className="glass-strong absolute bottom-[4.5rem] left-1/2 -translate-x-1/2
        z-40 rounded-lg pl-3 pr-1.5 py-1.5 flex items-center gap-2.5
        max-w-[calc(100vw-32px)] fade-up"
    >
      <CompassIcon size={14} className="text-[var(--accent)] shrink-0" />
      <span className="text-[12.5px] text-[var(--ink-dim)] whitespace-nowrap overflow-hidden text-ellipsis">
        {current.text}
      </span>
      <button
        type="button"
        onClick={current.run}
        className="shrink-0 h-7 px-2.5 rounded-md text-[12px] font-semibold
          text-[var(--accent)] bg-[var(--accent-soft)] hover:brightness-110
          whitespace-nowrap"
      >
        {current.action}
      </button>
      <button
        type="button"
        aria-label="Dismiss suggestion"
        onClick={() =>
          setDismissed((d) => new Set(d).add(current.id))
        }
        className="shrink-0 w-6 h-6 inline-flex items-center justify-center
          rounded-md text-[var(--ink-faint)] hover:text-[var(--ink)]"
      >
        ×
      </button>
    </div>
  );
}
