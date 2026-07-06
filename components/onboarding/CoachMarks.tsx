"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { on } from "@/lib/events";
import { useUIStore } from "@/lib/store/uiStore";
import type { OnboardingState } from "@/lib/types";

interface TourStep {
  flag: keyof OnboardingState["tour"];
  selector: string;
  title: string;
  text: string;
}

const STEPS: TourStep[] = [
  {
    flag: "createdCard",
    selector: '[data-tour="new-card"]',
    title: "Create a card",
    text: "Click Card (or press N, or double-click the canvas) and type a thought.",
  },
  {
    flag: "madeLink",
    selector: ".board-card",
    title: "Link by proximity",
    text: "Drag a card close to another until it glows, then release. Need a second card? Make one.",
  },
  {
    flag: "openedXRay",
    selector: '[data-tour="xray-button"]',
    title: "Open the Prompt X-Ray",
    text: "Your board, compiled live into a structured prompt. Zones become sections; links become order.",
  },
  {
    flag: "copiedPrompt",
    selector: '[data-tour="xray-copy"]',
    title: "Copy the prompt",
    text: "Paste it into Claude or any LLM and keep going. The board is the prompt.",
  },
];

const PAD = 8;

export function CoachMarks() {
  const tour = useUIStore((s) => s.onboarding.tour);
  const status = useUIStore((s) => s.onboarding.status);
  const { toast } = useToast();
  const [rect, setRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  const stepIdx = STEPS.findIndex((s) => !tour[s.flag]);
  const step = stepIdx >= 0 ? STEPS[stepIdx] : null;

  // Real-event advancement: the tour listens, it never fakes.
  useEffect(() => {
    const flag = (f: keyof OnboardingState["tour"]) => () =>
      useUIStore.getState().setTourFlag(f);
    const offs = [
      on("card:created", flag("createdCard")),
      on("link:created", flag("madeLink")),
      on("panel:xray:opened", flag("openedXRay")),
      on("compile:copied", flag("copiedPrompt")),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  useEffect(() => {
    if (status === "done") {
      toast({
        message:
          "That's the whole loop: think spatially, compile structurally. Everything else is polish.",
        variant: "success",
      });
    }
  }, [status, toast]);

  // Anchors move (it's a canvas) — poll cheaply while the tour is up.
  useEffect(() => {
    if (!step) return;
    const update = () => {
      const el = document.querySelector(step.selector);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect((prev) =>
        prev &&
        Math.abs(prev.x - r.x) < 1 &&
        Math.abs(prev.y - r.y) < 1 &&
        Math.abs(prev.w - r.width) < 1 &&
        Math.abs(prev.h - r.height) < 1
          ? prev
          : { x: r.x, y: r.y, w: r.width, h: r.height },
      );
    };
    update();
    const interval = setInterval(update, 250);
    window.addEventListener("resize", update);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", update);
    };
  }, [step]);

  if (!step) return null;

  const cardBelow = rect ? rect.y + rect.h + 180 < window.innerHeight : true;
  const cardStyle = rect
    ? {
        left: Math.min(
          Math.max(12, rect.x + rect.w / 2 - 150),
          window.innerWidth - 312,
        ),
        top: cardBelow ? rect.y + rect.h + PAD + 12 : undefined,
        bottom: cardBelow
          ? undefined
          : window.innerHeight - rect.y + PAD + 12,
      }
    : { left: "50%", bottom: 96, transform: "translateX(-50%)" };

  return (
    <div className="fixed inset-0 z-[90] pointer-events-none">
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="coach-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.x - PAD}
                y={rect.y - PAD}
                width={rect.w + PAD * 2}
                height={rect.h + PAD * 2}
                rx={16}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(10,12,24,0.4)"
          mask="url(#coach-mask)"
        />
        {rect && (
          <rect
            x={rect.x - PAD}
            y={rect.y - PAD}
            width={rect.w + PAD * 2}
            height={rect.h + PAD * 2}
            rx={16}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
          />
        )}
      </svg>

      <div
        className="absolute pointer-events-auto glass-strong glass-blur rounded-2xl
          p-4 w-[300px] fade-up"
        style={cardStyle as React.CSSProperties}
      >
        <div className="text-[11px] font-semibold text-[var(--accent)] tracking-wide">
          {stepIdx + 1} OF {STEPS.length}
        </div>
        <div className="mt-1 text-[14.5px] font-semibold tracking-tight">
          {step.title}
        </div>
        <div className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-dim)]">
          {step.text}
        </div>
        <button
          type="button"
          onClick={() =>
            useUIStore.getState().patchOnboarding({ status: "skipped" })
          }
          className="mt-3 text-[12px] font-medium text-[var(--ink-faint)]
            hover:text-[var(--ink)]"
        >
          Skip tour
        </button>
      </div>
    </div>
  );
}
