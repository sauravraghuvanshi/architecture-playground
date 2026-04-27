/**
 * Project hub — the architect-focused front door.
 * Linear/Notion vibe: dense, monochrome, no marketing scroll.
 *
 * Sections:
 *  1. HubHeader (sticky, search, new diagram)
 *  2. QuickPrompt (AI scaffold from a sentence)
 *  3. ModeTiles (start fresh in any mode)
 *  4. RecentDiagrams (drafts from localStorage)
 *  5. TemplateBrowser (cloud-filtered templates)
 *
 * Marketing landing lives at /about.
 */
import type { Metadata } from "next";
import { HubHeader } from "@/components/hub/HubHeader";
import { QuickPrompt } from "@/components/hub/QuickPrompt";
import { ModeTiles } from "@/components/hub/ModeTiles";
import { RecentDiagrams } from "@/components/hub/RecentDiagrams";
import { TemplateBrowser } from "@/components/hub/TemplateBrowser";

export const metadata: Metadata = {
  title: "Diagrammatic — your architecture workspace",
  description:
    "Project hub for Diagrammatic. Open recent diagrams, start from a template, or scaffold a new architecture from an AI prompt.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
      <HubHeader />
      <main className="mx-auto max-w-[1400px] px-6 pb-16">
        <QuickPrompt />
        <ModeTiles />
        <RecentDiagrams />
        <TemplateBrowser />
      </main>
    </div>
  );
}
