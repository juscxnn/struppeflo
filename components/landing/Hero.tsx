import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/icons";

export function Hero() {
  return (
    <section className="max-w-5xl mx-auto px-6 pt-28 pb-10">
      <h1
        className="text-[clamp(36px,6vw,56px)] font-semibold tracking-[-0.03em]
          leading-[1.05] max-w-3xl"
      >
        AI is fast. Your prompt is the bottleneck.
      </h1>
      <p className="mt-5 text-[16px] leading-relaxed text-[var(--ink-dim)] max-w-2xl">
        Drop your messy thoughts on a canvas. Group them. Struppëflo writes
        the structured prompt frontier models need to follow through on long
        tasks. No setup. No account.
      </p>

      <div className="mt-7 flex items-center gap-3">
        <Link
          href="/studio"
          className="btn-primary h-11 px-5 inline-flex items-center gap-2
            rounded-lg text-[14px] font-medium"
        >
          Open Studio
          <ArrowRightIcon size={15} />
        </Link>
        <a
          href="#demo"
          className="h-11 px-4 inline-flex items-center rounded-lg text-[14px]
            font-medium text-[var(--ink-dim)] hover:text-[var(--ink)]
            transition-colors"
        >
          Try the demo
        </a>
      </div>
      <p className="mt-4 text-[12.5px] text-[var(--ink-faint)]">
        Free. Runs with Claude, ChatGPT, Gemini, MiniMax, Kimi.
      </p>
    </section>
  );
}