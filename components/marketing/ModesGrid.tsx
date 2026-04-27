/**
 * Modes section — replaces the old ToolsShowcase tab pattern.
 *
 * The old version pushed comparisons to Lucid/Miro and an "all in one place"
 * pitch with a tab-state mock UI. This version is honest: cards in a grid,
 * each with a clear "Live" / "Soon" label that reflects the real codebase.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Lock } from "lucide-react";
import { TOOLS } from "./copy";

export function ModesGrid() {
  return (
    <section id="modes" className="border-t border-zinc-900 bg-zinc-950 py-24 text-zinc-100">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-widest text-lime-300">
            One canvas, nine modes
          </p>
          <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-5xl">
            Cloud architecture today.
            <br />
            <span className="italic text-zinc-400">Eight more modes shipping by phase.</span>
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t, i) => {
            const Icon = t.icon;
            const card = (
              <div
                className={`group/card relative h-full overflow-hidden rounded-xl border bg-zinc-900/40 p-6 transition ${
                  t.ready
                    ? "border-zinc-800 hover:border-lime-300/40 hover:bg-zinc-900/90 cursor-pointer"
                    : "border-zinc-900 cursor-not-allowed opacity-70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`grid h-10 w-10 place-items-center rounded-lg border ${
                      t.ready
                        ? "border-lime-300/30 bg-lime-300/10 text-lime-300"
                        : "border-zinc-800 bg-zinc-950 text-zinc-500"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      t.ready
                        ? "border-lime-300/30 bg-lime-300/15 text-lime-300"
                        : "border-zinc-700 bg-zinc-900 text-zinc-500"
                    }`}
                  >
                    {t.ready ? "Live" : "Soon"}
                  </span>
                </div>
                <h3 className="mt-5 text-base font-semibold text-zinc-100">{t.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{t.blurb}</p>
                <ul className="mt-4 space-y-1.5">
                  {t.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-xs text-zinc-500">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
                      {b}
                    </li>
                  ))}
                </ul>
                {t.ready ? (
                  <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-lime-300 transition group-hover/card:gap-2">
                    Open the canvas <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <span className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-zinc-500">
                    <Lock className="h-3 w-3" /> Phase{" "}
                    {t.id === "sequence" ? "4" : t.id === "whiteboard" || t.id === "mindmap" || t.id === "flowchart" ? "5" : "6+"}
                  </span>
                )}
              </div>
            );
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
              >
                {t.ready ? (
                  <Link href={t.href} className="block h-full">
                    {card}
                  </Link>
                ) : (
                  card
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
