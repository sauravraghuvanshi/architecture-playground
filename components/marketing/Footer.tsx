"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Github } from "lucide-react";
import { BRAND, FOOTER_LINKS } from "./copy";

export function FinalCTA() {
  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-5xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 p-12 text-center md:p-16"
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(190,242,100,0.10),transparent_60%)]"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]"
          />
          <h2 className="relative text-balance text-4xl font-semibold tracking-tight text-zinc-50 md:text-6xl">
            Ship the diagram.
            <br />
            <span className="italic text-zinc-400">Not the meeting.</span>
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-base text-zinc-400">
            Open the canvas. Drop a prompt. Sketch the architecture. No sign-in,
            no paywall, drafts stay in your browser.
          </p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/diagrammatic"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-lime-300 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-lime-200"
            >
              Open the canvas
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="https://github.com/sauravraghuvanshi/architecture-playground"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-950 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
            >
              <Github className="h-4 w-4" />
              View source
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-900 bg-zinc-950 py-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex cursor-pointer items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-800 bg-zinc-900 text-sm font-black text-lime-300">
                ◆
              </span>
              <span className="font-semibold tracking-tight text-zinc-100">{BRAND.name}</span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-zinc-500">{BRAND.tagline}</p>
          </div>

          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">
                {heading}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="cursor-pointer text-sm text-zinc-400 transition-colors hover:text-lime-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-900 pt-8">
          <p className="text-xs text-zinc-500">
            © {new Date().getFullYear()} {BRAND.name}. Open source under MIT &amp; Apache-2.0.
          </p>
          <Link
            href="https://github.com/sauravraghuvanshi/architecture-playground"
            className="cursor-pointer text-zinc-500 transition-colors hover:text-zinc-200"
            aria-label="GitHub"
          >
            <Github className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </footer>
  );
}
