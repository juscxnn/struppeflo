"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TemplateGallery } from "@/components/onboarding/TemplateGallery";
import { applyTemplate } from "@/lib/workspaceOps";
import { TEMPLATES } from "@/lib/templates";

export function TemplatesRow() {
  const router = useRouter();
  return (
    <section
      id="templates"
      className="max-w-5xl mx-auto px-6 py-20 scroll-mt-24"
    >
      <div className="text-[11px] font-semibold tracking-[0.14em] text-[var(--ink-faint)]">
        TEMPLATES
      </div>
      <h2 className="mt-2 text-[clamp(22px,3.5vw,30px)] font-semibold tracking-tight max-w-xl">
        Five jobs, pre-structured.
      </h2>
      <p className="mt-3 text-[14px] leading-relaxed text-[var(--ink-dim)] max-w-2xl">
        Launch plan. PRD. Research synthesis. Content pipeline. Triage. Pick
        one. The board loads with sections, dependencies, and order set.
        Fill in the cards.
      </p>
      <div className="mt-6">
        <TemplateGallery
          onPick={(id) => {
            applyTemplate(id);
            router.push("/studio");
          }}
          compact
        />
      </div>
      <div className="mt-6 text-center">
        <Link
          href="/studio"
          className="text-[13px] font-medium text-[var(--ink-dim)] hover:text-[var(--ink)] transition-colors"
        >
          See all 5 templates in the Studio →
        </Link>
      </div>
    </section>
  );
}
