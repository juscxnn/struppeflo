import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function LandingNav() {
  return (
    <div className="fixed top-4 inset-x-0 z-50 flex justify-center px-4">
      <nav
        className="glass-strong glass-blur rounded-full h-12 pl-5 pr-2 flex
          items-center gap-5 w-full max-w-3xl"
      >
        <Link href="/" className="text-[15px] font-bold tracking-tight shrink-0">
          Struppëflo
        </Link>
        <div className="hidden sm:flex items-center gap-4 text-[13px] font-medium text-[var(--ink-dim)]">
          <a href="#demo" className="hover:text-[var(--ink)] transition-colors">
            Demo
          </a>
          <a href="#how" className="hover:text-[var(--ink)] transition-colors">
            How it works
          </a>
          <a href="#why" className="hover:text-[var(--ink)] transition-colors">
            Why
          </a>
          <a
            href="#templates"
            className="hover:text-[var(--ink)] transition-colors"
          >
            Templates
          </a>
        </div>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <ThemeToggle />
          <Link
            href="/studio"
            className="h-9 px-4 inline-flex items-center rounded-full text-[13px]
              font-semibold text-white
              bg-gradient-to-b from-[var(--accent)] to-[var(--accent-2)]
              hover:brightness-110 transition-[filter]
              shadow-[0_4px_14px_rgba(91,95,242,0.35)]"
          >
            Open Studio
          </Link>
        </div>
      </nav>
    </div>
  );
}
