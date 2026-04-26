"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { BRAND, NAV } from "./copy";

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
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-3 left-3 right-3 z-50 mx-auto max-w-7xl rounded-2xl border transition-all duration-300 ${
        scrolled
          ? "bg-white/85 border-slate-200 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl"
          : "bg-white/60 border-white/60 backdrop-blur-md"
      }`}
    >
      <div className="flex items-center justify-between px-5 py-3">
        <Link href="/" className="flex items-center gap-2 cursor-pointer group">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-500 text-white text-sm font-black shadow-md transition-transform group-hover:rotate-6">
            ◆
          </span>
          <span className="font-bold text-slate-900 tracking-tight">{BRAND.name}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/api/auth/signin"
            className="hidden md:inline-flex px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
          >
            Sign in
          </Link>
          <Link
            href="/diagrammatic"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-md hover:shadow-lg hover:brightness-110 transition-all cursor-pointer"
          >
            Try it free
          </Link>
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {open ? <X className="w-5 h-5 text-slate-700" /> : <Menu className="w-5 h-5 text-slate-700" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-slate-200 px-3 py-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </motion.header>
  );
}
