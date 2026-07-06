import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/icons";
import { HeroStats } from "@/components/landing/StatsSection";

export function Hero() {
  return (
    <section className="max-w-5xl mx-auto px-6 pt-28 pb-10">
      <h1
        className="text-[clamp(36px,6vw,56px)] font-semibold tracking-[-0.03em]
          leading-[1.05] max-w-3xl"
      >
        Put everything AI needs in one place.
      </h1>
      <p className="mt-5 text-[16px] leading-relaxed text-[var(--ink-dim)] max-w-2xl">
        Drop thoughts onto a canvas. Group them. The layout becomes a brief
        Claude, ChatGPT, or Gemini can finish in one pass.
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
        Free. No account. Works with your own Claude / ChatGPT / Gemini key — or open in the browser tab.
      </p>
      <HeroStats />
    </section>
  );
}
