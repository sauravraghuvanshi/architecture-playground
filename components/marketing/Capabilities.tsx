/**
 * Capabilities — only behavior that is live and test-covered today.
 *
 * Replaces the old AIToolsGrid + Testimonials + SecuritySection (all of which
 * claimed features that don't exist).
 */
"use client";

import { motion } from "framer-motion";
import { CAPABILITIES } from "./copy";

const STATUS_TONE: Record<"live", { label: string; cls: string }> = {
  live: { label: "Live", cls: "bg-cyan-400/15 text-cyan-300 border-cyan-400/30" },
};

export function Capabilities() {
  return (
    <section id="capabilities" className="border-t border-slate-900 bg-[#07101e] py-24 text-slate-100">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-widest text-cyan-300">
            What it actually does
          </p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-5xl">
            No invented features.
            <br />
            <span className="italic text-zinc-400">Just what works today.</span>
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c, i) => {
            const Icon = c.icon;
            const tone = STATUS_TONE[c.status];
            return (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
                className="rounded-xl border border-slate-800 bg-[#0b1220]/70 p-5 transition hover:border-slate-700 hover:bg-slate-900/80"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone.cls}`}
                  >
                    {tone.label}
                  </span>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-zinc-100">{c.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{c.blurb}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
