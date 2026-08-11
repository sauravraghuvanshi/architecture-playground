"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Menu, X, Github, CloudCog } from "lucide-react";
import { BRAND, NAV } from "./copy";
import { SignOutButton } from "@/components/shared/SignOutButton";

/**
 * Shared enterprise site header. No sign-in (app is fully open).
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed left-0 right-0 top-0 z-50 border-b transition-all duration-300 ${
        scrolled
          ? "border-slate-800 bg-[#08111f]/95 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.28)]"
          : "border-slate-800 bg-[#08111f]/85 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6">
        <Link href="/" className="group flex cursor-pointer items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/15 transition-transform group-hover:rotate-6">
            <CloudCog className="h-4 w-4" />
          </span>
          <span className="font-semibold tracking-tight text-zinc-100">{BRAND.name}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="https://github.com/sauravraghuvanshi/architecture-playground"
            className="hidden cursor-pointer items-center gap-1.5 rounded-lg p-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100 md:inline-flex"
            aria-label="GitHub"
          >
            <Github className="h-4 w-4" />
          </Link>
          <SignOutButton />
          <Link
            href="/diagrammatic"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
          >
            Open canvas
          </Link>
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
            className="cursor-pointer rounded-lg p-2 transition-colors hover:bg-zinc-900 md:hidden"
          >
            {open ? <X className="h-5 w-5 text-zinc-300" /> : <Menu className="h-5 w-5 text-zinc-300" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-zinc-800 px-3 py-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-900"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </motion.header>
  );
}
