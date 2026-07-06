import Link from "next/link";

export function Footer() {
  return (
    <footer className="max-w-5xl mx-auto px-6 pb-10 pt-8">
      <div
        className="border-t border-[var(--border)] pt-6 flex items-center
          justify-between text-[12.5px] text-[var(--ink-faint)] flex-wrap gap-3"
      >
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            made with <span aria-label="love">♡</span>
          </span>
          <span>·</span>
          <span>Local-first · AGPL-3.0</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/privacy"
            className="font-medium text-[var(--ink-dim)] hover:text-[var(--ink)] transition-colors"
          >
            Privacy
          </Link>
          <a
            href="https://github.com/juscxnn/struppeflo"
            target="_blank"
            rel="noopener"
            className="font-medium text-[var(--ink-dim)] hover:text-[var(--ink)] transition-colors"
          >
            GitHub
          </a>
          <Link
            href="/studio"
            className="font-medium text-[var(--ink)] hover:underline"
          >
            Open Studio →
          </Link>
        </div>
      </div>
    </footer>
  );
}
