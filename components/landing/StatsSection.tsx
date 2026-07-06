"use client";

import { useEffect, useRef, useState } from "react";

export interface Stats {
  configured: boolean;
  users: number;
  runs: number;
  outputs: number;
}

const FALLBACK: Stats = {
  configured: false,
  users: 0,
  runs: 0,
  outputs: 0,
};

/**
 * Fetches live aggregate counts used by the landing page. Returns the same
 * FALLBACK (all zeros, `configured: false`) when KV isn't reachable so the UI
 * can render a friendly empty state without crashing.
 *
 * Re-fetches every 30s. Caller is responsible for deciding whether to render
 * anything based on the numbers (e.g., gate the hero stats on `users >= 10`).
 */
export function useStats(): { stats: Stats; loaded: boolean } {
  const [stats, setStats] = useState<Stats>(FALLBACK);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      try {
        const r = await fetch("/api/stats", { cache: "no-store" });
        if (!r.ok) return;
        const data = (await r.json()) as Stats;
        if (!cancelled) {
          setStats(data);
          setLoaded(true);
        }
      } catch {
        // network blip; keep previous numbers
      }
    };
    void fetchStats();
    const id = window.setInterval(fetchStats, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return { stats, loaded };
}

const TOOLTIPS: Record<keyof Omit<Stats, "configured">, string> = {
  users: "Unique anonymous sessions that started a run.",
  runs: "Total AI runs started across all users.",
  outputs: "Unique compiled prompts we've seen.",
};

export function HeroStats() {
  const { stats, loaded } = useStats();
  // Zero-state counters read as a dead product. Render nothing until the
  // numbers are real enough to help conversion instead of hurting it.
  if (!loaded || !stats.configured || stats.users < 10) return null;
  return (
    <div className="mt-8 flex items-center justify-center gap-6 text-[11.5px] text-[var(--ink-faint)] flex-wrap">
      <StatPill label="people" value={stats.users} tip={TOOLTIPS.users} />
      <span className="opacity-50">·</span>
      <StatPill label="runs" value={stats.runs} tip={TOOLTIPS.runs} />
      <span className="opacity-50">·</span>
      <StatPill label="prompts" value={stats.outputs} tip={TOOLTIPS.outputs} />
    </div>
  );
}

function StatPill({
  label,
  value,
  tip,
}: {
  label: string;
  value: number;
  tip: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        aria-label={`${label}: ${value}. ${tip}`}
        className="inline-flex items-baseline gap-1.5 hover:text-[var(--ink-dim)] transition-colors"
      >
        <strong className="font-semibold tabular-nums text-[var(--ink-dim)]">
          <AnimatedNumber value={value} />
        </strong>
        <span>{label}</span>
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-10
            w-56 px-2.5 py-1.5 rounded-md text-[11px] leading-snug
            bg-[var(--surface)] border border-[var(--border)]
            text-[var(--ink-dim)] shadow-sm text-left"
        >
          {tip}
        </span>
      )}
    </span>
  );
}

export function StatsSection() {
  const { stats, loaded } = useStats();

  if (!loaded || !stats.configured || stats.users < 10) return null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="glass rounded-xl px-6 py-5">
        <div className="grid grid-cols-3 gap-4">
          <Counter label="people using it" value={stats.users} />
          <Counter label="AI runs" value={stats.runs} />
          <Counter label="unique prompts" value={stats.outputs} />
        </div>
        <p className="mt-3 text-[11px] text-[var(--ink-faint)] text-center">
          Live, anonymous counts. No accounts, no tracking cookies.
        </p>
      </div>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-[28px] font-semibold tracking-tight tabular-nums">
        <AnimatedNumber value={value} />
      </div>
      <div className="mt-1 text-[11.5px] text-[var(--ink-faint)] leading-tight">
        {label}
      </div>
    </div>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const targetRef = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    fromRef.current = display;
    targetRef.current = value;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const duration = 800;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(
        fromRef.current + (targetRef.current - fromRef.current) * eased,
      );
      setDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = 0;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  if (value === 0) return <span>0</span>;
  return <span>{formatCount(display)}</span>;
}

function formatCount(n: number): string {
  if (n < 1000) return n.toLocaleString();
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
