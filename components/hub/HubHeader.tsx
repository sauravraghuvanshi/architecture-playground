"use client";

import Link from "next/link";
import { useState } from "react";
import { Search, Plus, Github } from "lucide-react";

/**
 * Compact, IDE-grade top header for the project hub.
 *
 * Phase-2 changes:
 *   - Removed the violet→fuchsia gradient logo square (now lime-on-zinc).
 *   - Removed the violet "beta" pill (now neutral zinc).
 *   - Removed the entire `signedIn` / Sign-in branch — the app is fully open.
 *   - Removed the `Settings` link to `/dashboard` (route is being deprecated).
 *
 * Props are gone — the header has no auth state to display.
 */
export function HubHeader() {
  const [q, setQ] = useState("");

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-6">
        <Link href="/" className="flex shrink-0 cursor-pointer items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-zinc-950 text-xs font-black text-lime-300 shadow-sm">
            ◆
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-zinc-900">
            Diagrammatic
          </span>
          <span className="ml-2 hidden rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 md:inline">
            beta
          </span>
        </Link>

        <div className="relative mx-auto max-w-xl flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search diagrams, templates, icons…"
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-16 text-sm transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-lime-300"
          />
          <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 md:inline-flex">
            ⌘K
          </kbd>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          <Link
            href="/about"
            className="cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            About
          </Link>
          <Link
            href="https://github.com/sauravraghuvanshi/architecture-playground"
            className="cursor-pointer rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="GitHub"
          >
            <Github className="h-4 w-4" />
          </Link>
        </nav>

        <Link
          href="/diagrammatic"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-lime-300 transition-colors hover:bg-zinc-800"
        >
          <Plus className="h-3.5 w-3.5" />
          New diagram
        </Link>
      </div>
    </header>
  );
}
