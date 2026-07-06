import Link from "next/link";
import { ArrowRightIcon } from "@/components/ui/icons";

export function Footer() {
  return (
    <footer className="px-6 pb-12 pt-8">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-[clamp(26px,4.5vw,40px)] font-bold tracking-tight leading-tight">
          Stop prompting.
          <br />
          Start arranging.
        </h2>
        <Link
          href="/studio"
          className="btn-primary mt-7 h-11 px-6 inline-flex items-center gap-2
            rounded-lg text-[14.5px] font-semibold"
        >
          Open the Studio
          <ArrowRightIcon size={16} />
        </Link>
        <div className="mt-10 text-[12px] text-[var(--ink-faint)]">
          Struppëflo — built for scattered brains and long-horizon agents.
          Local-first, no account, free.
        </div>
      </div>
    </footer>
  );
}
