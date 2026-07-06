const STEPS: Array<[string, string]> = [
  [
    "Dump",
    "Paste everything, one thought per line. Each line becomes a card on the canvas.",
  ],
  [
    "Arrange",
    "Drag cards into zones and links — or let AI group and connect them for you.",
  ],
  [
    "Run",
    "The board compiles to a structured prompt. Run it with your own key, or open it in Claude.",
  ],
];

export function HowItWorks() {
  return (
    <section id="how" className="max-w-5xl mx-auto px-6 py-20 scroll-mt-24">
      <div className="text-[11px] font-semibold tracking-[0.14em] text-[var(--ink-faint)]">
        HOW IT WORKS
      </div>
      <div className="mt-6 grid sm:grid-cols-3 gap-x-10 gap-y-8">
        {STEPS.map(([title, text], i) => (
          <div key={title} className="border-t border-[var(--border)] pt-4">
            <div className="text-[12px] font-mono text-[var(--ink-faint)]">
              0{i + 1}
            </div>
            <h3 className="mt-1.5 text-[15px] font-semibold tracking-tight">
              {title}
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-dim)]">
              {text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
