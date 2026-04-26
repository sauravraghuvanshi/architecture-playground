"use client";

import { motion } from "framer-motion";
import { TRUST } from "./copy";

export function SecuritySection() {
  return (
    <section id="security" className="py-24 bg-white">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-4">
            Security & openness
          </span>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
            Open core.
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              No vendor lock-in.
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Run it on our cloud, or self-host on yours. Your diagrams export to plain JSON, SVG, and Mermaid.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {TRUST.map((item, i) => {
            const I = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="p-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 hover:shadow-lg transition-shadow"
              >
                <span className="inline-grid place-items-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
                  <I className="w-5 h-5" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.blurb}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
