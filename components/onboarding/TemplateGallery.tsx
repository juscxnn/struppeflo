"use client";

import { useMemo } from "react";
import { TEMPLATES, type TemplateId } from "@/lib/templates";
import { boundsOfRects } from "@/lib/geometry";
import type { Board, Persona } from "@/lib/types";

export function TemplateGallery({
  persona,
  onPick,
}: {
  persona: Persona | null;
  onPick: (id: TemplateId) => void;
}) {
  const ordered = useMemo(() => {
    const arr = [...TEMPLATES];
    if (persona) {
      arr.sort(
        (a, b) =>
          Number(b.personaAffinity.includes(persona)) -
          Number(a.personaAffinity.includes(persona)),
      );
    }
    return arr;
  }, [persona]);

  // Instantiated once per template purely to draw the mini preview.
  const previews = useMemo(
    () => new Map(ordered.map((t) => [t.id, t.instantiate()])),
    [ordered],
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {ordered.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onPick(t.id)}
          className="glass rounded-2xl p-3 text-left transition-transform
            hover:scale-[1.02] hover:border-[var(--accent)] group"
        >
          <MiniBoardPreview board={previews.get(t.id)!} />
          <div className="mt-2 text-[13px] font-semibold tracking-tight">
            {t.name}
          </div>
          <div className="text-[11.5px] leading-snug text-[var(--ink-dim)]">
            {t.tagline}
          </div>
        </button>
      ))}
    </div>
  );
}

export function MiniBoardPreview({ board }: { board: Board }) {
  const divisions = Object.values(board.divisions);
  const cards = Object.values(board.cards);
  const bounds = boundsOfRects([...divisions, ...cards]);
  if (!bounds) return <div className="h-20 rounded-xl bg-[var(--glass)]" />;
  const pad = 40;

  return (
    <svg
      aria-hidden
      viewBox={`${bounds.x - pad} ${bounds.y - pad} ${bounds.w + pad * 2} ${bounds.h + pad * 2}`}
      className="w-full h-20 rounded-xl bg-[var(--glass)]"
      preserveAspectRatio="xMidYMid meet"
    >
      {divisions.map((d) => (
        <rect
          key={d.id}
          x={d.x}
          y={d.y}
          width={d.w}
          height={d.h}
          rx={24}
          fill="var(--accent-soft)"
          stroke="var(--glass-border)"
          strokeWidth={4}
        />
      ))}
      {cards.map((c) => (
        <rect
          key={c.id}
          x={c.x}
          y={c.y}
          width={c.w}
          height={c.h}
          rx={16}
          fill="var(--glass-strong)"
          stroke="var(--glass-edge)"
          strokeWidth={3}
        />
      ))}
    </svg>
  );
}
