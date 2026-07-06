export function ThesisSection() {
  return (
    <section id="why" className="px-6 py-20 max-w-5xl mx-auto">
      <h2 className="text-[clamp(26px,4vw,36px)] font-bold tracking-tight text-center max-w-2xl mx-auto leading-tight">
        Your brain isn&apos;t linear.
        <br />
        Your prompts shouldn&apos;t be soup.
      </h2>
      <p className="mt-4 text-center text-[14.5px] leading-relaxed text-[var(--ink-dim)] max-w-2xl mx-auto">
        LLMs do their best long-horizon work with structured, dependency-ordered
        context — not a chat transcript of afterthoughts. Struppëflo compiles
        your spatial arrangement into exactly that: zones become sections,
        proximity becomes links, links become execution order.
      </p>

      <div className="mt-10 grid md:grid-cols-2 gap-4 items-stretch">
        <div className="glass rounded-xl p-6 flex flex-col">
          <div className="text-[11.5px] font-semibold tracking-wide text-[var(--danger)]">
            WHAT YOU'D TYPE INTO CHAT
          </div>
          <div
            className="mt-3 flex-1 rounded-lg bg-[var(--glass)] border
              border-[var(--border)] p-4 text-[13px]
              leading-relaxed text-[var(--ink-dim)] italic"
          >
            &ldquo;ok so I need a GTM plan but first there&apos;s the audience
            thing, also pricing?? and I never finished the competitor list — oh
            and the landing page copy depends on the value prop which I
            haven&apos;t written, anyway make it actionable&rdquo;
          </div>
          <div className="mt-3 text-[12px] text-[var(--ink-faint)]">
            The model guesses at structure, order, and what matters. So do you.
          </div>
        </div>

        <div className="glass rounded-xl p-6 flex flex-col">
          <div className="text-[11.5px] font-semibold tracking-wide text-[var(--accent)]">
            WHAT STRUPPËFLO COMPILES
          </div>
          <pre
            className="mt-3 flex-1 rounded-lg bg-[var(--glass)] border
              border-[var(--border)] p-4 text-[11px]
              leading-relaxed font-mono whitespace-pre-wrap text-[var(--ink-dim)]
              overflow-x-auto"
          >
            {`<board name="GTM Plan" cards="8" sections="3">

## 1. Research
<note id="c1" title="Target audience">
Solo founders juggling 5+ workstreams…
</note>

## 2. Strategy
<task id="c4" title="Landing copy"
      depends_on="c2" inputs="c1">
Lead with the value prop, not features.
</task>

<execution_order>
1. Value prop (Research)
2. Landing copy (Strategy)
3. Launch post (Launch)
</execution_order>`}
          </pre>
          <div className="mt-3 text-[12px] text-[var(--ink-faint)]">
            Sections, dependencies, execution order — machine-legible, human-honest.
          </div>
        </div>
      </div>
    </section>
  );
}
