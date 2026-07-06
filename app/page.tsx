import { LandingNav } from "@/components/landing/LandingNav";
import { Hero } from "@/components/landing/Hero";
import { DemoBoard } from "@/components/landing/DemoBoard";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ThesisSection } from "@/components/landing/ThesisSection";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { LocalFirstSection } from "@/components/landing/LocalFirstSection";
import { TemplatesRow } from "@/components/landing/TemplatesRow";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <div className="min-h-dvh">
      <LandingNav />
      <main>
        <Hero />
        <section id="demo" className="px-4 sm:px-6 max-w-6xl mx-auto scroll-mt-24">
          <div className="text-center mb-5">
            <h2 className="text-[clamp(20px,3vw,26px)] font-bold tracking-tight">
              This demo is the real product.
            </h2>
            <p className="mt-1 text-[13.5px] text-[var(--ink-dim)]">
              Drag a card close to another until it glows, release to link —
              and watch the compiled prompt rewrite itself.
            </p>
          </div>
          <DemoBoard />
        </section>
        <HowItWorks />
        <ThesisSection />
        <FeatureGrid />
        <LocalFirstSection />
        <TemplatesRow />
      </main>
      <Footer />
    </div>
  );
}
