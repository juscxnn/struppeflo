const POINTS: Array<[string, string]> = [
  ["Local-first", "Boards live in this browser. Export JSON anytime."],
  ["Zero backend", "A static app. Strict CSP blocks every call except the AI providers you connect."],
  ["Your keys", "AI runs on your own provider key. Browser to API direct. Struppëflo never sees it."],
];

export function LocalFirstSection() {
  return (
    <section className="max-w-5xl mx-auto px-6 py-20">
      <div className="text-[11px] font-semibold tracking-[0.14em] text-[var(--ink-faint)]">
        PRIVACY
      </div>
      <div className="mt-6 grid sm:grid-cols-3 gap-x-10 gap-y-8">
        {POINTS.map(([title, text]) => (
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