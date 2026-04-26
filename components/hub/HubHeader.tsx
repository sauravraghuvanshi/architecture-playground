"use client";

import Link from "next/link";
import { useState } from "react";
import { Search, Plus, Github, BookOpen, Settings } from "lucide-react";

interface Props {
  signedIn?: boolean;
  userName?: string | null;
  userImage?: string | null;
}

/**
 * Compact, IDE-grade top header for the project hub.
 * Linear/Notion vibe: dense, monochrome, no marketing fluff.
 */
export function HubHeader({ signedIn, userName, userImage }: Props) {
  const [q, setQ] = useState("");

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-md">
      <div className="mx-auto max-w-[1400px] px-6 h-14 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 cursor-pointer shrink-0">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-500 text-white text-xs font-black shadow-sm">
            ◆
          </span>
          <span className="font-semibold text-slate-900 tracking-tight text-[15px]">Diagrammatic</span>
          <span className="hidden md:inline ml-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700 bg-violet-50 rounded">
            beta
          </span>
        </Link>

        <div className="flex-1 max-w-xl mx-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search diagrams, templates, icons…"
            className="w-full pl-9 pr-16 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 focus:bg-white transition-colors"
          />
          <kbd className="hidden md:inline-flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-white border border-slate-200 rounded">
            ⌘K
          </kbd>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/about"
            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
          >
            About
          </Link>
          <Link
            href="https://github.com/sauravraghuvanshi/architecture-playground"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            aria-label="GitHub"
          >
            <Github className="w-4 h-4" />
          </Link>
          <Link
            href="/dashboard"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
        </nav>

        <Link
          href="/diagrammatic"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          New diagram
        </Link>

        {signedIn ? (
          userImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={userImage}
              alt={userName ?? "Account"}
              className="w-7 h-7 rounded-full ring-2 ring-white shadow-sm"
            />
          ) : (
            <span className="grid place-items-center w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white text-xs font-bold">
              {(userName ?? "U").slice(0, 1).toUpperCase()}
            </span>
          )
        ) : (
          <Link
            href="/api/auth/signin"
            className="hidden sm:inline-flex px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
