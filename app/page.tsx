import { Hero } from "@/components/landing/Hero";
import { AsciiBackground } from "@/components/landing/AsciiBackground";
import { DemoBoard } from "@/components/landing/DemoBoard";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ThesisSection } from "@/components/landing/ThesisSection";
import { TemplatesRow } from "@/components/landing/TemplatesRow";
import { Footer } from "@/components/landing/Footer";
import { LandingNav } from "@/components/landing/LandingNav";

export default function LandingPage() {
  return (
    <div className="relative min-h-dvh">
      <AsciiBackground />
      <div className="relative z-10">
        <LandingNav />
        <main>
          <Hero />
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
          <TemplatesRow />
          <ThesisSection />
        </main>
        <Footer />
      </div>
    </div>
  );
}
