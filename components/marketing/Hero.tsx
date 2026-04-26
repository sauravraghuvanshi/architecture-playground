"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, Play } from "lucide-react";
import { BRAND, HERO_PROMPTS, HERO_CHIPS, STATS } from "./copy";

export function Hero() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % HERO_PROMPTS.length), 2800);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative pt-36 pb-20 overflow-hidden">
      {/* Decorative gradient blobs */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[1100px] h-[1100px] rounded-full bg-gradient-to-tr from-violet-200/50 via-fuchsia-200/40 to-orange-100/30 blur-3xl" />
        <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-violet-300/30 blur-3xl" />
        <div className="absolute top-32 right-10 w-72 h-72 rounded-full bg-fuchsia-300/30 blur-3xl" />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]"
      />

      <div className="mx-auto max-w-6xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-200 bg-violet-50 text-violet-700 text-xs font-semibold mb-6"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Open-source · MIT / Apache-2.0 · Built on maxGraph
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 leading-[1.05]"
        >
          Design any system.
          <br />
          <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 bg-clip-text text-transparent">
            With words. With AI.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-6 text-lg md:text-xl text-slate-600 max-w-2xl mx-auto"
        >
          {BRAND.name} is the AI-native canvas for cloud architecture, flowcharts,
          mind maps, ER, UML, sequence diagrams and whiteboarding — in one tab.
        </motion.p>

        {/* Prompt input */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-10 max-w-2xl mx-auto"
        >
          <div className="group relative rounded-2xl bg-white border border-slate-200 shadow-[0_20px_50px_-20px_rgba(124,58,237,0.35)] hover:shadow-[0_30px_70px_-20px_rgba(124,58,237,0.45)] transition-shadow">
            <div className="flex items-center gap-3 p-3 pl-5">
              <Sparkles className="w-5 h-5 text-violet-500 shrink-0" />
              <div className="flex-1 text-left h-7 overflow-hidden relative">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={idx}
                    initial={{ y: 14, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -14, opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className="absolute inset-0 text-slate-500"
                  >
                    {HERO_PROMPTS[idx]}
                  </motion.span>
                </AnimatePresence>
              </div>
              <Link
                href="/diagrammatic"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-md hover:shadow-lg hover:brightness-110 transition-all cursor-pointer"
              >
                Generate
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3 pt-1 border-t border-slate-100">
              {HERO_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="px-2.5 py-1 text-xs font-medium text-slate-600 rounded-md hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 flex items-center justify-center gap-3 flex-wrap"
        >
          <Link
            href="/diagrammatic"
            className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white rounded-xl bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Open the canvas
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="#tools"
            className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-700 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4" />
            See how it works
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6"
        >
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl md:text-3xl font-black text-slate-900">{s.value}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-slate-500 font-semibold">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
