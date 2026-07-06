"use client";

import { useToast } from "@/components/ui/Toast";
import {
  DumpIcon,
  FlowIcon,
  FrameIcon,
  LinkIcon,
  PlusIcon,
  SparklesIcon,
  XRayIcon,
} from "@/components/ui/icons";
import {
  runGenerateWorkflow,
  runOrganize,
  runSuggestLinks,
} from "@/lib/aiActions";
import { getCanvas } from "@/lib/canvasBridge";
import { CARD_W } from "@/lib/constants";
import { useBoardStore } from "@/lib/store/boardStore";
import { useUIStore } from "@/lib/store/uiStore";

function ToolButton({
  label,
  hint,
  onClick,
  active = false,
  busy = false,
  tour,
  children,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  active?: boolean;
  busy?: boolean;
  tour?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={hint ? `${label} (${hint})` : label}
      data-tour={tour}
      onClick={onClick}
      disabled={busy}
      className={`relative h-9 px-3 inline-flex items-center gap-1.5 rounded-lg
        text-[12.5px] font-medium transition-colors whitespace-nowrap
        ${active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--ink-dim)] hover:text-[var(--ink)] hover:bg-[var(--accent-soft)]"}
        ${busy ? "opacity-60" : ""}`}
    >
      {busy ? (
        <span
          className="w-4 h-4 rounded-full border-2 border-[var(--accent)]
            border-t-transparent animate-spin"
        />
      ) : (
        children
      )}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

export function Toolbar() {
  const { toast } = useToast();
  const toolMode = useUIStore((s) => s.toolMode);
  const aiBusy = useUIStore((s) => s.aiBusy);
  const xrayOpen = useUIStore((s) => s.xrayOpen);

  const newCard = () => {
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
  };

  return (
    <div
      className="glass-strong absolute bottom-5 left-1/2 -translate-x-1/2 z-40
        rounded-xl p-1 flex items-center gap-0.5"
    >
      <ToolButton label="Card" hint="N" onClick={newCard} tour="new-card">
        <PlusIcon size={15} />
      </ToolButton>
      <ToolButton
        label="Zone"
        hint="D — drag to draw"
        active={toolMode === "division"}
        onClick={() =>
          useUIStore
            .getState()
            .setToolMode(toolMode === "division" ? "select" : "division")
        }
      >
        <FrameIcon size={15} />
      </ToolButton>

      <div className="w-px h-5 mx-1 bg-[var(--glass-border)]" />

      <ToolButton
        label="Organize"
        hint="AI — cluster loose cards into zones"
        busy={aiBusy === "organize"}
        onClick={() => void runOrganize(toast)}
      >
        <SparklesIcon size={15} />
      </ToolButton>
      <ToolButton
        label="Suggest links"
        hint="AI — relate cards by content"
        busy={aiBusy === "links"}
        onClick={() => void runSuggestLinks(toast)}
      >
        <LinkIcon size={15} />
      </ToolButton>
      <ToolButton
        label="Workflow"
        hint="AI — dependency-ordered lanes in a new tab"
        busy={aiBusy === "workflow"}
        onClick={() => void runGenerateWorkflow(toast)}
      >
        <FlowIcon size={15} />
      </ToolButton>

      <div className="w-px h-5 mx-1 bg-[var(--glass-border)]" />

      <ToolButton
        label="Brain dump"
        hint="B — one thought per line"
        onClick={() => useUIStore.getState().setBrainDumpOpen(true)}
      >
        <DumpIcon size={15} />
      </ToolButton>
      <ToolButton
        label="X-Ray"
        hint="⌘. — the compiled prompt"
        active={xrayOpen}
        tour="xray-button"
        onClick={() => useUIStore.getState().setXrayOpen(!xrayOpen)}
      >
        <XRayIcon size={15} />
      </ToolButton>
    </div>
  );
}
