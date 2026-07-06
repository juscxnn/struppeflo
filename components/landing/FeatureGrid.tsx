const FEATURES = [
  [
    "Drag to connect",
    "Pull a card near another. A line forms between them.",
  ],
  [
    "Zones",
    "Box a group of cards. Name the zone. It becomes a section.",
  ],
  [
    "Prompt X-Ray",
    "See the prompt your board compiles into. Updates live as you drag.",
  ],
  [
    "AI organize",
    "Twenty loose cards become named zones in one click. Undoable.",
  ],
];

export function FeatureGrid() {
  return (
    <section className="max-w-5xl mx-auto px-6 py-20">
      <div className="text-[11px] font-semibold tracking-[0.14em] text-[var(--ink-faint)]">
        FEATURES
      </div>
      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-8">
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