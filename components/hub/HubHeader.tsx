"use client";

import Link from "next/link";
import { useState } from "react";
import { Search, Plus, Github } from "lucide-react";

/**
 * Compact, IDE-grade top header for the project hub.
 *
 * Phase-3 dark editorial: now matches the marketing/SiteHeader and the
 * Workspace toolbar palette — zinc-950 surface, zinc-800 borders,
 * lime-300 accent on the only primary CTA.
 */
export function HubHeader() {
  const [q, setQ] = useState("");

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-6">
        <Link href="/" className="flex shrink-0 cursor-pointer items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md border border-zinc-800 bg-zinc-900 text-xs font-black text-lime-300 shadow-sm">
            ◆
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-zinc-100">
            Diagrammatic
          </span>
          <span className="ml-2 hidden rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 md:inline">
            beta
          </span>
        </Link>

        <div className="relative mx-auto max-w-xl flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search diagrams, templates, icons…"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 py-2 pl-9 pr-16 text-sm text-zinc-100 placeholder:text-zinc-500 transition-colors focus:border-lime-300/60 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-lime-300/40"
          />
          <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 md:inline-flex">
            ⌘K
          </kbd>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          <Link
            href="/about"
            className="cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
          >
            About
          </Link>
          <Link
            href="/templates"
            className="cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
          >
            Templates
          </Link>
          <Link
            href="https://github.com/sauravraghuvanshi/architecture-playground"
            className="cursor-pointer rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="GitHub"
          >
            <Github className="h-4 w-4" />
          </Link>
        </nav>

        <Link
          href="/diagrammatic"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-lime-300 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-lime-200"
        >
          <Plus className="h-3.5 w-3.5" />
          New diagram
        </Link>
      </div>
    </header>
  );
}
