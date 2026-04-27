/**
 * /about — honest project page. Marketing fiction (testimonials, security
 * compliance claims, fake AI features, cost calculator) was removed in the
 * Phase-2 brand pivot. This is now a single dark editorial flow with only
 * the modes & capabilities that actually exist (or are clearly labelled
 * Soon / Planned in the roadmap).
 */
import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Hero } from "@/components/marketing/Hero";
import { ModesGrid } from "@/components/marketing/ModesGrid";
import { Capabilities, Roadmap } from "@/components/marketing/Capabilities";
import { FinalCTA, SiteFooter } from "@/components/marketing/Footer";

export const metadata: Metadata = {
  title: "About Diagrammatic — an open architect's canvas",
  description:
    "Diagrammatic is an open-source canvas for cloud architecture today, with mind maps, flowcharts, sequence diagrams, ER, UML, whiteboarding and Kanban shipping by phase. No sign-in.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
      <SiteHeader />
      <Hero />
      <ModesGrid />
      <Capabilities />
      <Roadmap />
      <FinalCTA />
      <SiteFooter />
    </main>
  );
}
