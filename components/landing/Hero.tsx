import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/icons";

export function Hero() {
  return (
    <section className="max-w-5xl mx-auto px-6 pt-36 pb-12">
      <h1
        className="text-[clamp(36px,6vw,56px)] font-semibold tracking-[-0.03em]
          leading-[1.05] max-w-2xl"
      >
        The board is the prompt.
      </h1>
      <p className="mt-4 text-[16px] leading-relaxed text-[var(--ink-dim)] max-w-xl">
        Drop thoughts as cards. Drag them together to connect them. Struppëflo
        compiles the layout into a structured prompt — and runs it with Claude.
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
      <p className="mt-5 text-[12.5px] text-[var(--ink-faint)]">
        Free · no account · your data stays in this browser
      </p>
    </section>
  );
}
