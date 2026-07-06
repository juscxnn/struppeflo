const FEATURES: Array<[string, string]> = [
  [
    "Two ways to link",
    "Drag a card close until it glows, or pull from its edge handle. Click a line to set depends-on or input-to.",
  ],
  [
    "Zones",
    "Named regions on the canvas. Each one becomes a section in the compiled prompt.",
  ],
  [
    "Prompt X-Ray",
    "The compiled prompt, live — Markdown or JSON, token estimate, dependency-cycle warnings.",
  ],
  [
    "AI organize",
    "Twenty half-thoughts become named, grouped zones in one click. Undoable.",
  ],
  [
    "Spark questions",
    "The board asks what's missing — prerequisites, success criteria. Answers land as cards.",
  ],
  [
    "The basics, done right",
    "Tabs, templates, undo history, ⌘K palette, keyboard shortcuts, JSON export.",
  ],
];

export function FeatureGrid() {
  return (
    <section className="max-w-5xl mx-auto px-6 py-20">
      <div className="text-[11px] font-semibold tracking-[0.14em] text-[var(--ink-faint)]">
        FEATURES
      </div>
      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8">
        {FEATURES.map(([title, text]) => (
          <div key={title} className="border-t border-[var(--border)] pt-4">
            <h3 className="text-[14px] font-semibold tracking-tight">{title}</h3>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-dim)]">
              {text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
