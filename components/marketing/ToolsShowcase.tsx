"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, Lock } from "lucide-react";
import { TOOLS } from "./copy";

export function ToolsShowcase() {
  const [active, setActive] = useState(TOOLS[0].id);
  const tool = TOOLS.find((t) => t.id === active) ?? TOOLS[0];
  const Icon = tool.icon;

  return (
    <section id="tools" className="py-24 bg-gradient-to-b from-white to-slate-50">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-violet-50 text-violet-700 text-xs font-semibold mb-4">
            One canvas. Nine modes.
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
            All your diagrams.
            <br />
            <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
              In one place.
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Stop paying for Lucidchart, Miro, draw.io and Whimsical separately.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-8">
          {/* Tabs */}
          <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {TOOLS.map((t) => {
              const TIcon = t.icon;
              const isActive = t.id === active;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActive(t.id)}
                  className={`shrink-0 lg:w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                    isActive
                      ? "bg-white border-slate-200 shadow-md"
                      : "bg-transparent border-transparent hover:bg-white/60"
                  }`}
                >
                  <span
                    className={`grid place-items-center w-9 h-9 rounded-lg bg-gradient-to-br ${t.accent} text-white shrink-0`}
                  >
                    <TIcon className="w-4 h-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-slate-900 truncate">{t.title}</span>
                    <span className="block text-xs text-slate-500 truncate">
                      {t.ready ? "Available" : "Coming soon"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Preview */}
          <AnimatePresence mode="wait">
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="rounded-2xl bg-white border border-slate-200 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.15)] overflow-hidden"
            >
              <div className={`h-2 bg-gradient-to-r ${tool.accent}`} />
              <div className="p-8">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className={`grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br ${tool.accent} text-white shadow-md`}>
                      <Icon className="w-6 h-6" />
                    </span>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">{tool.title}</h3>
                      <p className="text-sm text-slate-600 mt-0.5">{tool.blurb}</p>
                    </div>
                  </div>
                  {tool.ready ? (
                    <Link
                      href={tool.href}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Open
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 rounded-lg bg-slate-100">
                      <Lock className="w-3.5 h-3.5" />
                      Coming soon
                    </span>
                  )}
                </div>

                <ul className="mt-6 grid sm:grid-cols-3 gap-3">
                  {tool.bullets.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-100"
                    >
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-700">{b}</span>
                    </li>
                  ))}
                </ul>

                {/* Mock canvas preview */}
                <div className="mt-6 relative aspect-[16/9] rounded-xl border border-slate-200 bg-[linear-gradient(to_right,rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.04)_1px,transparent_1px)] bg-[size:24px_24px] overflow-hidden">
                  <div className={`absolute inset-0 bg-gradient-to-br ${tool.accent} opacity-[0.06]`} />
                  <div className="absolute inset-0 grid place-items-center">
                    <Icon className={`w-24 h-24 text-slate-300`} strokeWidth={1} />
                  </div>
                  <div className="absolute bottom-3 left-3 px-2 py-1 rounded-md bg-white/90 backdrop-blur text-[10px] font-mono text-slate-600 border border-slate-200">
                    {tool.title.toLowerCase().replace(/\s+/g, "-")}.diagram
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
