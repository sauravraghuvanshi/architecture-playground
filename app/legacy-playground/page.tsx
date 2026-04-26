/**
 * Root page — the Architecture Playground IS the app.
 *
 * Server component: reads icon manifest + templates from disk, passes them as
 * serializable props to the client. The actual React Flow canvas is loaded
 * client-only (ssr:false) inside <PlaygroundClient />.
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { PlaygroundClient } from "./PlaygroundClient";
import type { IconManifest, IconManifestEntry, PlaygroundTemplate } from "@/components/playground/lib/types";
import { resolveTemplateDefaults, type ParameterizedTemplate } from "@/components/playground/lib/template-engine";

export const metadata: Metadata = {
  title: "Architecture Playground — drag-and-drop cloud diagrams",
  description:
    "Interactive Azure + AWS + GCP architecture playground. Drag service icons onto the canvas, connect them, define a request sequence, and export PNG, JSON, or animated GIF.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Architecture Playground",
    description:
      "Build, animate, and export multi-cloud architecture diagrams in the browser.",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Architecture Playground",
    description: "Drag-and-drop cloud diagrams with animated request flows.",
  },
};

async function loadIcons(): Promise<IconManifestEntry[]> {
  const file = path.join(process.cwd(), "content", "cloud-icons.json");
  const raw = await fs.readFile(file, "utf8");
  const manifest = JSON.parse(raw) as IconManifest;
  return manifest.icons;
}

async function loadTemplates(): Promise<PlaygroundTemplate[]> {
  const dir = path.join(process.cwd(), "content", "playground-templates");
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: PlaygroundTemplate[] = [];
  for (const entry of entries.filter((e) => e.endsWith(".json")).sort()) {
    try {
      const raw = await fs.readFile(path.join(dir, entry), "utf8");
      const parsed = JSON.parse(raw) as ParameterizedTemplate;
      // If the template carries parameters or _when markers, resolve to
      // defaults so the existing playground sees a clean PlaygroundGraph.
      const hasMarkers =
        Array.isArray(parsed.parameters) ||
        parsed.graph.nodes.some((n) => "_when" in n || "_iconChoice" in n) ||
        parsed.graph.edges.some((e) => "_when" in e);
      const resolved: PlaygroundTemplate = hasMarkers
        ? {
            id: parsed.id,
            name: parsed.name,
            description: parsed.description,
            cloud: parsed.cloud,
            graph: resolveTemplateDefaults(parsed),
          }
        : (parsed as unknown as PlaygroundTemplate);
      out.push(resolved);
    } catch {
      // Skip malformed templates rather than failing the page.
    }
  }
  return out;
}

export default async function PlaygroundPage() {
  const [icons, templates] = await Promise.all([loadIcons(), loadTemplates()]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Architecture Playground",
    applicationCategory: "DesignApplication",
    operatingSystem: "Web",
    description:
      "Interactive multi-cloud architecture diagram editor with drag-and-drop Azure, AWS, and GCP icons, animated request sequences, and PNG/JSON/GIF export.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PlaygroundClient icons={icons} templates={templates} />
      <p className="px-4 py-2 text-center text-[10px] text-zinc-500 dark:text-zinc-600">
        Service icons © Microsoft, Amazon, and Google. Used here for architecture demonstration; this playground is not affiliated with any cloud provider.
      </p>
    </>
  );
}
