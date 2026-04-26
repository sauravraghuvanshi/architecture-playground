"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Github } from "lucide-react";
import { BRAND, FOOTER_LINKS } from "./copy";

export function FinalCTA() {
  return (
    <section className="py-24 bg-white">
      <div className="mx-auto max-w-5xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-orange-500 p-12 md:p-16 text-center text-white shadow-[0_40px_100px_-20px_rgba(168,85,247,0.5)]"
        >
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />
          <h2 className="relative text-4xl md:text-6xl font-black tracking-tight">
            Ship the diagram.
            <br />
            Not the meeting.
          </h2>
          <p className="relative mt-4 text-lg text-white/90 max-w-xl mx-auto">
            Open the canvas. Drop a prompt. Export to your wiki by lunch.
          </p>
          <div className="relative mt-8 flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/diagrammatic"
              className="inline-flex items-center gap-1.5 px-6 py-3 text-sm font-semibold text-slate-900 rounded-xl bg-white hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Open the canvas
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="https://github.com/sauravraghuvanshi/architecture-playground"
              className="inline-flex items-center gap-1.5 px-6 py-3 text-sm font-semibold text-white rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 transition-colors cursor-pointer"
            >
              <Github className="w-4 h-4" />
              Star on GitHub
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 cursor-pointer">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-500 text-white text-sm font-black shadow-md">
                ◆
              </span>
              <span className="font-bold text-slate-900 tracking-tight">{BRAND.name}</span>
            </Link>
            <p className="mt-4 text-sm text-slate-600 leading-relaxed">
              {BRAND.tagline}
            </p>
          </div>

          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
                {heading}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-700 hover:text-violet-700 transition-colors cursor-pointer"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 flex items-center justify-between flex-wrap gap-4">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} {BRAND.name}. Open source under MIT &amp; Apache-2.0.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="https://github.com/sauravraghuvanshi/architecture-playground"
              className="text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              aria-label="GitHub"
            >
              <Github className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
