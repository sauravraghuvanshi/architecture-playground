"use client";

import Link from "next/link";
import { useState } from "react";
import { Search, Plus, Github, CloudCog } from "lucide-react";

/**
 * Compact, IDE-grade top header for the project hub.
 *
 * Shared enterprise header language: deep navy shell, slate borders, and
 * cyan primary actions match the workspace and public pages.
 */
export function HubHeader() {
  const [q, setQ] = useState("");

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#08111f]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-6">
        <Link href="/" className="flex shrink-0 cursor-pointer items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/15">
            <CloudCog className="h-4 w-4" />
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
            className="w-full rounded-xl border border-slate-800 bg-slate-950/60 py-2 pl-9 pr-16 text-sm text-slate-100 placeholder:text-slate-500 transition-colors focus:border-cyan-400/60 focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-cyan-400/10"
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
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-bold text-slate-950 transition-colors hover:bg-cyan-300"
        >
          <Plus className="h-3.5 w-3.5" />
          New diagram
        </Link>
      </div>
    </header>
  );
}
