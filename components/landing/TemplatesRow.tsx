import Link from "next/link";
import { MiniBoardPreview } from "@/components/onboarding/TemplateGallery";
import { TEMPLATES } from "@/lib/templates";

export function TemplatesRow() {
  return (
    <section id="templates" className="max-w-5xl mx-auto px-6 py-20 scroll-mt-24">
      <div className="text-[11px] font-semibold tracking-[0.14em] text-[var(--ink-faint)]">
        TEMPLATES
      </div>
      <p className="mt-2 text-[14px] text-[var(--ink-dim)]">
        Five pre-wired boards. Pick one and start from structure.
      </p>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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
