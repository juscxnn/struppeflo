import { Hero } from "@/components/landing/Hero";
import { DemoBoard } from "@/components/landing/DemoBoard";
import { StatsSection } from "@/components/landing/StatsSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ThesisSection } from "@/components/landing/ThesisSection";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { ModelsSection } from "@/components/landing/ModelsSection";
import { RoadmapSection } from "@/components/landing/RoadmapSection";
import { LocalFirstSection } from "@/components/landing/LocalFirstSection";
import { TemplatesRow } from "@/components/landing/TemplatesRow";
import { Footer } from "@/components/landing/Footer";
import { LandingNav } from "@/components/landing/LandingNav";

export default function LandingPage() {
  return (
    <div className="min-h-dvh">
      <LandingNav />
      <main>
        <Hero />
        <StatsSection />
        <section
          id="demo"
          className="max-w-6xl mx-auto px-4 sm:px-6 scroll-mt-24"
        >
          <DemoBoard />
          <p className="mt-2 text-[12px] text-[var(--ink-faint)]">
            This is the real editor. Drag a card near another to link it. The
            compiled prompt updates live.
          </p>
        </section>
        <HowItWorks />
        <ThesisSection />
        <FeatureGrid />
        <ModelsSection />
        <RoadmapSection />
        <LocalFirstSection />
        <TemplatesRow />
      </main>
      <Footer />
    </div>
  );
}