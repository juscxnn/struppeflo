import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/icons";

const LINK_TYPES: Array<[string, string, string]> = [
  ["depends on", "this card can\u2019t start until the other does", "var(--link-depends)"],
  ["feeds", "this card is input to the other", "var(--link-input)"],
  ["relates to", "a cross-reference \u2014 useful context, no order", "var(--link-related)"],
];

export function Hero() {
  return (
    <section className="max-w-5xl mx-auto px-6 pt-32 pb-12">
      <h1
        className="text-[clamp(36px,6vw,56px)] font-semibold tracking-[-0.03em]
          leading-[1.05] max-w-3xl"
      >
        Brief frontier AI in minutes, not hours.
      </h1>
      <p className="mt-4 text-[16px] leading-relaxed text-[var(--ink-dim)] max-w-2xl">
        Drop your scattered thoughts as cards on a canvas. Drag them together
        to connect them. Struppëflo compiles the layout into the structured
        prompt long-horizon AI work actually needs &mdash; sections,
        dependencies, execution order &mdash; and runs it with Claude,
        ChatGPT, Gemini, MiniMax, or Kimi.
      </p>

      <div className="mt-7 flex items-center gap-3">
        <Link
          href="/studio"
          className="btn-primary h-10 px-5 inline-flex items-center gap-2
            rounded-lg text-[14px] font-medium"
        >
          Open Studio
          <ArrowRightIcon size={15} />
        </Link>
        <a
          href="#demo"
          className="h-10 px-4 inline-flex items-center rounded-lg text-[14px]
            font-medium text-[var(--ink-dim)] hover:text-[var(--ink)]
            transition-colors"
        >
          Try the demo
        </a>
      </div>

      <div className="mt-10">
        <div className="text-[11px] font-semibold tracking-[0.14em] text-[var(--ink-faint)]">
          THREE WAYS TO CONNECT
        </div>
        <div className="mt-3 grid sm:grid-cols-3 gap-3 max-w-3xl">
          {LINK_TYPES.map(([verb, meaning, color]) => (
            <div
              key={verb}
              className="glass rounded-xl px-3.5 py-3 flex items-start gap-3"
            >
              <span
                aria-hidden
                className="w-1 self-stretch rounded-full shrink-0"
                style={{ background: color }}
              />
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold tracking-tight">
                  {verb}
                </div>
                <div className="text-[12px] leading-snug text-[var(--ink-dim)] mt-0.5">
                  {meaning}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-7 text-[12.5px] text-[var(--ink-faint)]">
        Free · no account · runs with Claude, ChatGPT, Gemini, MiniMax, or Kimi
      </p>
    </section>
  );
}