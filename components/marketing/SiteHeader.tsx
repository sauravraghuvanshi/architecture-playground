"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Menu, X, Github } from "lucide-react";
import { BRAND, NAV } from "./copy";

/**
 * Editorial-dark site header. No sign-in (app is fully open). No gradient
 * logo. Single lime CTA into the canvas.
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
      className={`fixed top-3 left-3 right-3 z-50 mx-auto max-w-7xl rounded-2xl border transition-all duration-300 ${
        scrolled
          ? "border-zinc-800 bg-zinc-950/85 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
          : "border-zinc-900 bg-zinc-950/60 backdrop-blur-md"
      }`}
    >
      <div className="flex items-center justify-between px-5 py-3">
        <Link href="/" className="group flex cursor-pointer items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-800 bg-zinc-900 text-sm font-black text-lime-300 transition-transform group-hover:rotate-6">
            ◆
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
          <Link
            href="/diagrammatic"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-lime-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-lime-200"
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
