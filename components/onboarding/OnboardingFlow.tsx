"use client";

import { useUIStore } from "@/lib/store/uiStore";
import { applyTemplate } from "@/lib/workspaceOps";
import { PERSONAS, type Persona } from "@/lib/types";
import { CoachMarks } from "./CoachMarks";
import { TemplateGallery } from "./TemplateGallery";
import { DumpIcon, CardStackIcon } from "@/components/ui/icons";

const PERSONA_COPY: Record<Persona, { label: string; blurb: string }> = {
  founder: { label: "Founder", blurb: "GTM, fundraising, everything at once" },
  researcher: { label: "Researcher", blurb: "Sources, evidence, synthesis" },
  pm: { label: "Product manager", blurb: "Specs, priorities, stakeholders" },
  student: { label: "Student", blurb: "Projects, papers, deadlines" },
  generalist: { label: "Scattered generalist", blurb: "My tabs have tabs" },
};

export function OnboardingFlow() {
  const onboarding = useUIStore((s) => s.onboarding);

  if (onboarding.stepIndex >= 3) return <CoachMarks />;

  const patch = useUIStore.getState().patchOnboarding;
  const skip = () => patch({ status: "skipped" });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4
        bg-[rgba(10,12,24,0.35)] backdrop-blur-md"
    >
      <div className="glass-strong glass-blur rounded-3xl w-[680px] max-w-full max-h-[88vh] overflow-y-auto thin-scroll fade-up">
        <div className="flex items-center gap-1.5 px-6 pt-5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all
                ${i === onboarding.stepIndex ? "w-6 bg-[var(--accent)]" : "w-1.5 bg-[var(--ink-faint)]"}`}
            />
          ))}
          <button
            type="button"
            onClick={skip}
            className="ml-auto text-[12.5px] font-medium text-[var(--ink-faint)]
              hover:text-[var(--ink)] px-2 py-1 rounded-lg"
          >
            Skip
          </button>
        </div>

        {onboarding.stepIndex === 0 && (
          <div className="px-8 pb-8 pt-4 text-center">
            <FloatingCards />
            <h1 className="text-[26px] font-bold tracking-tight leading-tight">
              Think in space.
              <br />
              Ship in structure.
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-[var(--ink-dim)] max-w-md mx-auto">
              Struppëflo is a canvas for scattered thinking. Drop your thoughts
              as cards, drag them close to link them, group them into zones —
              and the board <em>compiles</em> into a structured prompt any AI
              can run with.
            </p>
            <button
              type="button"
              onClick={() => patch({ status: "in_progress", stepIndex: 1 })}
              className="mt-6 h-11 px-7 rounded-full text-[14.5px] font-semibold text-white
                bg-gradient-to-b from-[var(--accent)] to-[var(--accent-2)]
                hover:brightness-110 shadow-[0_6px_18px_rgba(91,95,242,0.35)]"
            >
              Get started
            </button>
            <div className="mt-3 text-[11.5px] text-[var(--ink-faint)]">
              No account. Nothing leaves your browser.
            </div>
          </div>
        )}

        {onboarding.stepIndex === 1 && (
          <div className="px-8 pb-8 pt-4">
            <h2 className="text-[20px] font-bold tracking-tight">
              What describes you best?
            </h2>
            <p className="mt-1 text-[13px] text-[var(--ink-dim)]">
              This tunes the starter questions and template order — nothing is
              locked in.
            </p>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PERSONAS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => patch({ persona: p, stepIndex: 2 })}
                  className="glass rounded-2xl p-4 text-left transition-transform
                    hover:scale-[1.02]"
                >
                  <div className="text-[13.5px] font-semibold tracking-tight">
                    {PERSONA_COPY[p].label}
                  </div>
                  <div className="mt-0.5 text-[11.5px] leading-snug text-[var(--ink-dim)]">
                    {PERSONA_COPY[p].blurb}
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => patch({ stepIndex: 2 })}
                className="rounded-2xl p-4 text-left text-[12.5px]
                  text-[var(--ink-faint)] hover:text-[var(--ink)]"
              >
                I&apos;d rather not say →
              </button>
            </div>
          </div>
        )}

        {onboarding.stepIndex === 2 && (
          <div className="px-8 pb-8 pt-4">
            <h2 className="text-[20px] font-bold tracking-tight">
              Pick a starting point
            </h2>
            <p className="mt-1 text-[13px] text-[var(--ink-dim)]">
              Templates come pre-wired with zones, cards and links so you can
              feel the compile loop immediately.
            </p>
            <div className="mt-4">
              <TemplateGallery
                persona={onboarding.persona}
                onPick={(id) => {
                  applyTemplate(id);
                  patch({ stepIndex: 3 });
                }}
              />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  patch({ stepIndex: 3 });
                  useUIStore.getState().setBrainDumpOpen(true);
                }}
                className="h-10 px-4 rounded-full inline-flex items-center gap-2
                  text-[13px] font-semibold text-[var(--accent)]
                  bg-[var(--accent-soft)] hover:brightness-110"
              >
                <DumpIcon size={15} />
                Start with a brain dump
              </button>
              <button
                type="button"
                onClick={() => patch({ stepIndex: 3 })}
                className="h-10 px-4 rounded-full inline-flex items-center gap-2
                  text-[13px] font-medium text-[var(--ink-dim)]
                  hover:bg-[var(--accent-soft)]"
              >
                <CardStackIcon size={15} />
                Blank canvas
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FloatingCards() {
  return (
    <div aria-hidden className="relative h-28 mb-2">
      <div
        className="gentle-float absolute left-1/2 -translate-x-[130%] top-4 w-28 h-16
          glass-card rounded-xl"
        style={{ ["--float-rot" as string]: "-6deg", animationDelay: "0s" }}
      />
      <div
        className="gentle-float absolute left-1/2 -translate-x-1/2 top-0 w-28 h-16
          glass-card rounded-xl"
        style={{ ["--float-rot" as string]: "2deg", animationDelay: "-1.7s" }}
      />
      <div
        className="gentle-float absolute left-1/2 translate-x-[30%] top-6 w-28 h-16
          glass-card rounded-xl"
        style={{ ["--float-rot" as string]: "7deg", animationDelay: "-3.4s" }}
      />
    </div>
  );
}
