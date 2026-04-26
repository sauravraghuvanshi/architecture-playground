/**
 * /about — preserves the Cloudairy-style marketing landing.
 * The root `/` route is now the architect-focused project hub.
 */
import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Hero } from "@/components/marketing/Hero";
import { TrustStrip } from "@/components/marketing/TrustStrip";
import { ToolsShowcase } from "@/components/marketing/ToolsShowcase";
import { ConceptToClarity } from "@/components/marketing/ConceptToClarity";
import { AIToolsGrid } from "@/components/marketing/AIToolsGrid";
import { CostCalculator } from "@/components/marketing/CostCalculator";
import { SecuritySection } from "@/components/marketing/SecuritySection";
import { Testimonials } from "@/components/marketing/Testimonials";
import { TemplatesPreview } from "@/components/marketing/TemplatesPreview";
import { FinalCTA, SiteFooter } from "@/components/marketing/Footer";

export const metadata: Metadata = {
  title: "About Diagrammatic — the all-in-one AI canvas",
  description:
    "Cloud architecture, flowcharts, mind maps, ER, UML, sequence diagrams, whiteboarding, and Kanban — one workspace, AI-native.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900 antialiased">
      <SiteHeader />
      <Hero />
      <TrustStrip />
      <ToolsShowcase />
      <ConceptToClarity />
      <AIToolsGrid />
      <CostCalculator />
      <SecuritySection />
      <Testimonials />
      <TemplatesPreview />
      <FinalCTA />
      <SiteFooter />
    </main>
  );
}
