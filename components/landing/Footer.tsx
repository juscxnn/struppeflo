import Link from "next/link";

export function Footer() {
  return (
    <footer className="max-w-5xl mx-auto px-6 pb-10 pt-8">
      <div
        className="border-t border-[var(--border)] pt-6 flex items-center
          justify-between text-[12.5px] text-[var(--ink-faint)]"
      >
        <span>Struppëflo — think in space, ship in structure.</span>
        <Link
          href="/studio"
          className="font-medium text-[var(--ink)] hover:underline"
        >
          Open Studio →
        </Link>
      </div>
    </footer>
  );
}
