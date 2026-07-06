"use client";

import Link from "next/link";
import { TemplateGallery } from "@/components/onboarding/TemplateGallery";
import { applyTemplate } from "@/lib/workspaceOps";
import { TEMPLATES } from "@/lib/templates";

export function TemplatesRow() {
  return (
    <section id="templates" className="max-w-5xl mx-auto px-6 py-20 scroll-mt-24">
      <div className="text-[11px] font-semibold tracking-[0.14em] text-[var(--ink-faint)]">
        TEMPLATES
      </div>
      <p className="mt-2 text-[14px] text-[var(--ink-dim)]">
        Each template is a complete job. Pick one and fill in the cards.
      </p>
      <div className="mt-6">
        <TemplateGallery onPick={(id) => applyTemplate(id)} compact />
      </div>
      <div className="mt-6 text-center">
        <Link
          href="/studio"
          className="text-[13px] font-medium text-[var(--ink-dim)] hover:text-[var(--ink)] transition-colors"
        >
          See all {TEMPLATES.length} templates in the Studio →
        </Link>
      </div>
    </section>
  );
}