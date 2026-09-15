"use client";

import Link from "next/link";
import { Plus, Github, CloudCog, FolderOpen } from "lucide-react";
import { SignOutButton } from "@/components/shared/SignOutButton";

/**
 * Compact, IDE-grade top header for the project hub.
 *
 * Shared enterprise header language: deep navy shell, slate borders, and
 * cyan primary actions match the workspace and public pages.
 */
export function HubHeader() {
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

        <Link href="/diagrammatic?library=1" className="mr-auto inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800">
          <FolderOpen className="h-4 w-4" /> My diagrams
        </Link>

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
            Starting designs
          </Link>
          <Link
            href="https://github.com/sauravraghuvanshi/architecture-playground"
            className="cursor-pointer rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="GitHub"
          >
            <Github className="h-4 w-4" />
          </Link>
          <SignOutButton />
        </nav>

        <Link
          href="/diagrammatic?library=1"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-bold text-slate-950 transition-colors hover:bg-cyan-300"
        >
          <Plus className="h-3.5 w-3.5" />
          New diagram
        </Link>
      </div>
    </header>
  );
}
