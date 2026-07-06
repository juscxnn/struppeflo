"use client";

import { useMemo } from "react";
import { TEMPLATES, type TemplateId } from "@/lib/templates";
import { boundsOfRects } from "@/lib/geometry";
import type { Board, Persona } from "@/lib/types";

const PERSONA_LABEL: Record<Persona, string> = {
  founder: "Founder",
  pm: "Product",
  researcher: "Research",
  student: "Student",
  generalist: "General",
};

export function TemplateGallery({
  persona,
  onPick,
  compact = false,
}: {
  persona?: Persona | null;
  onPick: (id: TemplateId) => void;
  compact?: boolean;
}) {
  const ordered = useMemo(() => {
    const arr = [...TEMPLATES];
    if (persona) {
      arr.sort(
        (a, b) =>
          Number(a.persona === persona) - Number(b.persona === persona),
      );
    }
    return arr;
  }, [persona]);

  const previews = useMemo(
    () => new Map(ordered.map((t) => [t.id, t.instantiate()])),
    [ordered],
  );

  return (
    <div
      className={
        compact
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          : "grid grid-cols-2 sm:grid-cols-3 gap-3"
      }
    >
      {ordered.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onPick(t.id as TemplateId)}
          className={
            compact
              ? "glass-card rounded-2xl p-5 text-left group transition-all hover:border-[var(--border-strong)] hover:-translate-y-0.5"
              : "glass-card rounded-xl p-3 text-left group"
          }
        >
          <MiniBoardPreview board={previews.get(t.id)!} compact={compact} />
          <div className="mt-3 flex items-center gap-2">
            <span
              className="text-[10.5px] font-semibold tracking-[0.08em] uppercase
                text-[var(--ink-faint)]"
            >
              {PERSONA_LABEL[t.persona]}
            </span>
          </div>
          <div
            className={
              compact
                ? "mt-1 text-[15px] font-semibold tracking-tight"
                : "mt-2 text-[13px] font-semibold tracking-tight"
            }
          >
            {t.name}
          </div>
          <div
            className={
              compact
                ? "mt-1 text-[12.5px] leading-snug text-[var(--ink-dim)]"
                : "text-[11.5px] leading-snug text-[var(--ink-dim)]"
            }
          >
            {t.tagline}
          </div>
          {compact && (
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              {t.zones.slice(0, 5).map((z) => (
                <span
                  key={z.name}
                  className="text-[10.5px] px-2 py-0.5 rounded-full
                    bg-[var(--glass)] border border-[var(--border)]
                    text-[var(--ink-dim)]"
                >
                  {z.name}
                </span>
              ))}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

export function MiniBoardPreview({
  board,
  compact = false,
}: {
  board: Board;
  compact?: boolean;
}) {
  const divisions = Object.values(board.divisions);
  const cards = Object.values(board.cards);
  const bounds = boundsOfRects([...divisions, ...cards]);
  if (!bounds) {
    return (
      <div className="h-20 rounded-lg bg-[var(--glass)] border border-[var(--border)]" />
    );
  }
  const pad = 40;

  return (
    <svg
      aria-hidden
      viewBox={`${bounds.x - pad} ${bounds.y - pad} ${bounds.w + pad * 2} ${bounds.h + pad * 2}`}
      className={
        compact
          ? "w-full h-32 rounded-lg bg-[var(--glass)] border border-[var(--border)]"
          : "w-full h-20 rounded-lg bg-[var(--glass)] border border-[var(--border)]"
      }
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