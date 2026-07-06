import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/icons";

export function Hero() {
  return (
    <section className="pt-36 pb-14 px-6 text-center">
      <div
        className="fade-up inline-flex items-center gap-2 glass rounded-full h-8 px-4
          text-[12.5px] font-medium text-[var(--ink-dim)]"
      >
        <span
          aria-hidden
          className="w-2 h-2 rounded-full bg-gradient-to-b from-[var(--accent)]
            to-[var(--accent-2)]"
        />
        A thinking canvas that compiles into AI context
      </div>

      <h1
        className="fade-up mt-6 text-[clamp(38px,7vw,68px)] font-bold tracking-[-0.03em]
          leading-[1.04] max-w-4xl mx-auto"
        style={{ animationDelay: "0.06s" }}
      >
        Think in space.
        <br />
        <span
          className="bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)]
            bg-clip-text text-transparent"
        >
          Ship in structure.
        </span>
      </h1>

      <p
        className="fade-up mt-6 text-[clamp(15px,2vw,18px)] leading-relaxed
          text-[var(--ink-dim)] max-w-2xl mx-auto"
        style={{ animationDelay: "0.12s" }}
      >
        Struppëflo turns scattered thoughts into glass cards on an infinite
        canvas — link them by dragging close, group them into zones — then{" "}
        <strong className="text-[var(--ink)] font-semibold">compiles</strong>{" "}
        your arrangement into a structured, dependency-ordered prompt that
        long-horizon AI agents actually follow.
      </p>

      <div
        className="fade-up mt-8 flex items-center justify-center gap-3 flex-wrap"
        style={{ animationDelay: "0.18s" }}
      >
        <Link
          href="/studio"
          className="h-12 px-7 inline-flex items-center gap-2 rounded-full
            text-[15px] font-semibold text-white
            bg-gradient-to-b from-[var(--accent)] to-[var(--accent-2)]
            hover:brightness-110 transition-[filter]
            shadow-[0_8px_24px_rgba(91,95,242,0.4)]"
        >
          Open the Studio
          <ArrowRightIcon size={16} />
        </Link>
        <a
          href="#demo"
          className="h-12 px-6 inline-flex items-center rounded-full text-[14.5px]
            font-semibold glass-strong glass-blur hover:brightness-105"
        >
          Try the live demo ↓
        </a>
      </div>

      <div
        className="fade-up mt-6 text-[12.5px] text-[var(--ink-faint)]"
        style={{ animationDelay: "0.24s" }}
      >
        Local-first · No account · Nothing leaves your browser
      </div>
    </section>
  );
}
