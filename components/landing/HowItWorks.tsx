import { DumpIcon, SparklesIcon, XRayIcon } from "@/components/ui/icons";

const STEPS = [
  {
    icon: DumpIcon,
    title: "Dump",
    text: "Paste every loose thought — one per line. Each becomes a card scattered on the canvas. No blank-page dread, no premature structure.",
  },
  {
    icon: SparklesIcon,
    title: "Arrange",
    text: "Drag cards close to link them. Draw zones to group them. Or hit AI Organize and watch the mess cluster itself — you stay in control, every move undoable.",
  },
  {
    icon: XRayIcon,
    title: "Compile & run",
    text: "The board compiles live into a structured prompt: zones become sections, links become execution order. Run it with your own Claude key in-app — or open it in Claude with one click.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="px-6 py-20 max-w-5xl mx-auto">
      <h2 className="text-[clamp(26px,4vw,36px)] font-bold tracking-tight text-center">
        Dump. Arrange. Compile.
      </h2>
      <p className="mt-2 text-center text-[14.5px] text-[var(--ink-dim)]">
        Three moves between a scattered brain and a runnable plan.
      </p>
      <div className="mt-10 grid sm:grid-cols-3 gap-4">
        {STEPS.map((step, i) => (
          <div key={step.title} className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-3">
              <span
                className="btn-primary w-10 h-10 rounded-lg inline-flex items-center
                  justify-center"
              >
                <step.icon size={18} />
              </span>
              <span className="text-[12px] font-semibold text-[var(--ink-faint)]">
                STEP {i + 1}
              </span>
            </div>
            <h3 className="mt-4 text-[17px] font-semibold tracking-tight">
              {step.title}
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-dim)]">
              {step.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
