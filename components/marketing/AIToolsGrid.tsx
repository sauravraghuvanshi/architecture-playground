"use client";

import { motion } from "framer-motion";
import { AI_TOOLS } from "./copy";

export function AIToolsGrid() {
  return (
    <section id="ai" className="py-24 bg-white">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-fuchsia-50 text-fuchsia-700 text-xs font-semibold mb-4">
            AI Toolkit
          </span>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
            Nine AI superpowers.
            <br />
            <span className="bg-gradient-to-r from-fuchsia-600 to-orange-500 bg-clip-text text-transparent">
              Built into the canvas.
            </span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {AI_TOOLS.map((tool, i) => {
            const Icon = tool.icon;
            return (
              <motion.div
                key={tool.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                whileHover={{ y: -4 }}
                className="group relative p-6 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-xl transition-all cursor-pointer overflow-hidden"
              >
                <div
                  className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${tool.accent} opacity-0 group-hover:opacity-20 blur-2xl transition-opacity`}
                />
                <span
                  className={`relative inline-grid place-items-center w-11 h-11 rounded-xl bg-gradient-to-br ${tool.accent} text-white shadow-md`}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <h3 className="relative mt-4 text-lg font-bold text-slate-900">{tool.title}</h3>
                <p className="relative mt-1.5 text-sm text-slate-600 leading-relaxed">{tool.blurb}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
