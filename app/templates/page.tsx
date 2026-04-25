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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Architecture Playground
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              Playground
            </Link>
            <Link href="/templates" className="font-medium text-zinc-900 dark:text-zinc-100">
              Templates
            </Link>
            <Link href="/dashboard" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Template Gallery</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {templates.length} architecture patterns. Pick one to start, then customize on the canvas.
          </p>
        </div>

        <TemplateGalleryClient templates={templates} />
      </main>
    </div>
  );
}
