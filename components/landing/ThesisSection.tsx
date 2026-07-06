export function ThesisSection() {
  return (
    <section id="why" className="max-w-5xl mx-auto px-6 py-20 scroll-mt-24">
      <div className="text-[11px] font-semibold tracking-[0.14em] text-[var(--ink-faint)]">
        WHY
      </div>
      <h2 className="mt-2 text-[clamp(22px,3.5vw,30px)] font-semibold tracking-tight max-w-xl">
        Frontier models can do the work. They can't guess what you meant.
      </h2>
      <p className="mt-3 text-[14px] leading-relaxed text-[var(--ink-dim)] max-w-2xl">
        Long tasks need structure. Sections, order, dependencies. Without them
        the model wanders. Struppëflo gives you the structure by construction:
        zones become sections, links become dependencies, layout becomes the
        order the model reads.
      </p>

      <div className="mt-8 grid md:grid-cols-2 gap-4 items-stretch">
        <div className="glass rounded-xl p-5 flex flex-col">
          <div className="text-[11px] font-semibold tracking-[0.1em] text-[var(--ink-faint)]">
            WHAT YOU TYPE
          </div>
          <div
            className="mt-3 flex-1 rounded-lg bg-[var(--glass)] border
              border-[var(--border)] p-4 text-[13px] leading-relaxed
              text-[var(--ink-dim)] italic"
          >
            &ldquo;ok so I need a GTM plan but first the audience thing, also
            pricing?? the landing copy depends on the value prop which I
            haven&apos;t written. anyway make it actionable.&rdquo;
          </div>
        </div>

        <div className="glass rounded-xl p-5 flex flex-col">
          <div className="text-[11px] font-semibold tracking-[0.1em] text-[var(--ink-faint)]">
            WHAT THE MODEL GETS
          </div>
          <pre
            className="mt-3 flex-1 rounded-lg bg-[var(--glass)] border
              border-[var(--border)] p-4 text-[11px] leading-relaxed font-mono
              whitespace-pre-wrap text-[var(--ink-dim)] overflow-x-auto"
          >
{`## 1. Research
<note title="Target audience">…</note>

## 2. Strategy
<task title="Landing copy"
      depends_on="c2" inputs="c1">…</task>

<execution_order>
1. Value prop
2. Landing copy
3. Launch post
</execution_order>`}
          </pre>
        </div>
      </div>
    </section>
  );
}