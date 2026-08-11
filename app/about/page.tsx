/**
 * /about — honest project page. Marketing fiction (testimonials, security
 * compliance claims, fake AI features, cost calculator) was removed in the
 * Phase-2 brand pivot. This page lists only tested, currently available modes
 * and capabilities.
 */
import type { Metadata } from "next";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { Hero } from "@/components/marketing/Hero";
import { ModesGrid } from "@/components/marketing/ModesGrid";
import { Capabilities } from "@/components/marketing/Capabilities";
import { FinalCTA, SiteFooter } from "@/components/marketing/Footer";

export const metadata: Metadata = {
  title: "About Diagrammatic — an open architect's canvas",
  description:
    "Diagrammatic is an open-source, local-first workspace for cloud architecture, mind maps, flowcharts, sequence diagrams, ER, UML, whiteboarding, C4, and Kanban. No sign-in.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#07101e] text-slate-100 antialiased">
      <SiteHeader />
      <Hero />
      <ModesGrid />
      <Capabilities />
      <FinalCTA />
      <SiteFooter />
    </main>
  );
}
