import Link from "next/link";
import { MiniBoardPreview } from "@/components/onboarding/TemplateGallery";
import { TEMPLATES } from "@/lib/templates";

export function TemplatesRow() {
  return (
    <section id="templates" className="px-6 py-20 max-w-5xl mx-auto">
      <h2 className="text-[clamp(26px,4vw,36px)] font-bold tracking-tight text-center">
        Start from a wired board.
      </h2>
      <p className="mt-2 text-center text-[14.5px] text-[var(--ink-dim)]">
        Every template opens pre-linked, so the compile loop clicks in the
        first thirty seconds.
      </p>
      <div className="mt-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {TEMPLATES.map((t) => (
          <Link
            key={t.id}
            href={`/studio?template=${t.id}`}
            className="glass-card rounded-xl p-3"
          >
            <MiniBoardPreview board={t.instantiate()} />
            <div className="mt-2 text-[13px] font-semibold tracking-tight">
              {t.name}
            </div>
            <div className="text-[11px] leading-snug text-[var(--ink-dim)]">
              {t.tagline}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
