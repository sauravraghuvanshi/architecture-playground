"use client";

import { motion } from "framer-motion";
import { ArrowRight, FileText, Image as ImageIcon, Code2, Mic } from "lucide-react";

const INPUTS = [
  { icon: FileText, label: "Text prompt", color: "from-violet-500 to-fuchsia-500" },
  { icon: ImageIcon, label: "Photo / sketch", color: "from-orange-500 to-rose-500" },
  { icon: Code2, label: "Terraform / Bicep", color: "from-emerald-500 to-teal-500" },
  { icon: Mic, label: "Voice (soon)", color: "from-sky-500 to-cyan-500" },
];

export function ConceptToClarity() {
  return (
    <section className="py-24 bg-slate-950 text-white relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-0 opacity-50">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-violet-600/30 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full bg-fuchsia-600/20 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-14"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-violet-200 text-xs font-semibold mb-4 border border-white/10">
            Concept → Clarity
          </span>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight">
            Any input.
            <br />
            <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-orange-200 bg-clip-text text-transparent">
              Editable diagram.
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-300">
            Stop drawing boxes. Describe the system, drop a photo, or paste IaC — we render it
            and hand you the editable canvas.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-[1fr_auto_1fr] items-center gap-8">
          {/* Inputs */}
          <div className="grid grid-cols-2 gap-3">
            {INPUTS.map((inp, i) => {
              const I = inp.icon;
              return (
                <motion.div
                  key={inp.label}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="rounded-xl bg-white/5 border border-white/10 backdrop-blur p-4 hover:bg-white/10 transition-colors"
                >
                  <span
                    className={`inline-grid place-items-center w-9 h-9 rounded-lg bg-gradient-to-br ${inp.color} text-white shadow-lg`}
                  >
                    <I className="w-4 h-4" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-white">{inp.label}</p>
                </motion.div>
              );
            })}
          </div>

          {/* Arrow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="hidden lg:flex flex-col items-center"
          >
            <span className="grid place-items-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-[0_0_40px_rgba(168,85,247,0.5)]">
              <ArrowRight className="w-6 h-6 text-white" />
            </span>
            <span className="mt-2 text-xs uppercase tracking-widest text-violet-300 font-semibold">AI</span>
          </motion.div>

          {/* Output: mock canvas */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="rounded-2xl bg-white text-slate-900 shadow-[0_30px_80px_-20px_rgba(168,85,247,0.6)] overflow-hidden"
          >
            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 border-b border-slate-200">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="ml-3 text-[11px] font-mono text-slate-500">order-pipeline.diagram</span>
            </div>
            <div className="relative aspect-[16/10] bg-[linear-gradient(to_right,rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[size:20px_20px]">
              {/* Three connected nodes */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 }}
                className="absolute top-1/2 left-[12%] -translate-y-1/2 px-3 py-2 rounded-lg bg-white border border-violet-300 shadow-md text-xs font-semibold text-slate-700"
              >
                API Gateway
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.8 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-2 rounded-lg bg-white border border-fuchsia-300 shadow-md text-xs font-semibold text-slate-700"
              >
                Function App
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 1.0 }}
                className="absolute top-1/2 right-[12%] -translate-y-1/2 px-3 py-2 rounded-lg bg-white border border-orange-300 shadow-md text-xs font-semibold text-slate-700"
              >
                Cosmos DB
              </motion.div>
              {/* Connectors */}
              <svg className="absolute inset-0 w-full h-full" aria-hidden>
                <motion.line
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.7, duration: 0.6 }}
                  x1="22%" y1="50%" x2="42%" y2="50%"
                  stroke="#a855f7" strokeWidth="2" strokeDasharray="0 1"
                  pathLength={1}
                />
                <motion.line
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.9, duration: 0.6 }}
                  x1="58%" y1="50%" x2="78%" y2="50%"
                  stroke="#d946ef" strokeWidth="2"
                  pathLength={1}
                />
              </svg>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
