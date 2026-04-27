/**
 * Template gallery — shared page (no auth required) showing all available
 * architecture templates with search, category, provider, and difficulty
 * filters. Clicking "Use this template" stores the resolved graph in
 * sessionStorage and navigates to the playground, which picks it up on mount.
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { TemplateGalleryClient } from "./GalleryClient";
import type { ParameterizedTemplate } from "@/components/playground/lib/template-engine";

export const metadata: Metadata = { title: "Template Gallery" };

async function loadParameterizedTemplates(): Promise<ParameterizedTemplate[]> {
  const dir = path.join(process.cwd(), "content", "playground-templates");
  const out: ParameterizedTemplate[] = [];
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  for (const entry of entries.filter((e) => e.endsWith(".json")).sort()) {
    try {
      const raw = await fs.readFile(path.join(dir, entry), "utf8");
      out.push(JSON.parse(raw) as ParameterizedTemplate);
    } catch {
      // skip malformed
    }
  }
  return out;
}

export default async function TemplatesPage() {
  const templates = await loadParameterizedTemplates();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/85 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2 cursor-pointer">
            <span className="grid h-7 w-7 place-items-center rounded-md border border-zinc-800 bg-zinc-900 text-xs font-black text-lime-300">
              ◆
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-zinc-100">
              Diagrammatic
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/" className="cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 transition-colors">
              Hub
            </Link>
            <Link href="/templates" className="cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-100 bg-zinc-900 border border-zinc-800">
              Templates
            </Link>
            <Link href="/diagrammatic" className="cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 transition-colors">
              Canvas
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">Template Gallery</h1>
          <p className="mt-2 text-sm text-zinc-500">
            {templates.length} architecture patterns. Pick one to start, then customize on the canvas.
          </p>
        </div>

        <TemplateGalleryClient templates={templates} />
      </main>
    </div>
  );
}
