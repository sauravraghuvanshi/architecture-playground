/**
 * Capabilities — what's real today, what's next, what's planned. No fiction.
 *
 * Replaces the old AIToolsGrid + Testimonials + SecuritySection (all of which
 * claimed features that don't exist).
 */
"use client";

import { motion } from "framer-motion";
import { CAPABILITIES, ROADMAP } from "./copy";

const STATUS_TONE: Record<"live" | "next" | "planned", { label: string; cls: string }> = {
  live: { label: "Live", cls: "bg-lime-300/15 text-lime-300 border-lime-300/30" },
  next: { label: "Next", cls: "bg-amber-300/15 text-amber-300 border-amber-300/30" },
  planned: { label: "Planned", cls: "bg-zinc-700/40 text-zinc-400 border-zinc-700" },
};

export function Capabilities() {
  return (
    <section id="capabilities" className="border-t border-zinc-900 bg-zinc-950 py-24 text-zinc-100">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-widest text-lime-300">
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
                className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-zinc-700 hover:bg-zinc-900/80"
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

export function Roadmap() {
  return (
    <section id="roadmap" className="border-t border-zinc-900 bg-zinc-950 py-24 text-zinc-100">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-widest text-lime-300">
            Roadmap
          </p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-5xl">
            Honest about what&apos;s built.
            <br />
            <span className="italic text-zinc-400">Honest about what&apos;s not.</span>
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {ROADMAP.map((col, i) => (
            <motion.div
              key={col.phase}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {col.phase}
              </p>
              <ul className="mt-3 space-y-2">
                {col.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-zinc-300">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
