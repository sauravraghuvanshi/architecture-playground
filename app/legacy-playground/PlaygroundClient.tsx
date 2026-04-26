/**
 * PlaygroundClient — bridges the server page shell to the client-only Playground.
 * React Flow needs DOM measurement (ResizeObserver), so it must be SSR-disabled.
 */
"use client";

import dynamic from "next/dynamic";
import type { IconManifestEntry, PlaygroundTemplate } from "@/components/playground/lib/types";

const Playground = dynamic(() => import("@/components/playground/Playground"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-4rem)] min-h-[600px] items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="flex flex-col items-center gap-3 text-zinc-500">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <p className="text-sm">Loading Architecture Playground…</p>
      </div>
    </div>
  ),
});

interface Props {
  icons: IconManifestEntry[];
  templates: PlaygroundTemplate[];
}

export function PlaygroundClient({ icons, templates }: Props) {
  return <Playground icons={icons} templates={templates} />;
}
