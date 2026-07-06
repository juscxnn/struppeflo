const STEPS = [
  {
    n: "01",
    title: "Drop your thoughts",
    body: "One card per idea. Brain dump a list. Every line becomes a card.",
  },
  {
    n: "02",
    title: "Arrange",
    body: "Drag cards close to link them. Drop them inside a named zone to group them.",
  },
  {
    n: "03",
    title: "Run",
    body: "The board compiles into a structured prompt. Sections, dependencies, reading order. Pick a model. Hit run.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="max-w-5xl mx-auto px-6 py-20 scroll-mt-24">
      <div className="text-[11px] font-semibold tracking-[0.14em] text-[var(--ink-faint)]">
        HOW IT WORKS
      </div>
      <div className="mt-6 grid sm:grid-cols-3 gap-x-10 gap-y-8">
        {STEPS.map((s) => (
          <div key={s.title} className="border-t border-[var(--border)] pt-4">
            <div className="text-[12px] font-mono text-[var(--ink-faint)]">{s.n}</div>
            <h3 className="mt-1.5 text-[15px] font-semibold tracking-tight">{s.title}</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-dim)]">
              {s.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}