"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { TEMPLATE_PREVIEW } from "./copy";

export function TemplatesPreview() {
  return (
    <section id="templates" className="py-24 bg-white">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex items-end justify-between gap-6 flex-wrap mb-12"
        >
          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-semibold mb-4">
              Templates
            </span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">
              Start from a battle-tested
              <br />
              <span className="bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent">
                template.
              </span>
            </h2>
          </div>
          <Link
            href="/templates"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-violet-900 transition-colors cursor-pointer"
          >
            Browse all templates
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {TEMPLATE_PREVIEW.map((t, i) => (
            <motion.div
              key={t.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              whileHover={{ y: -4 }}
              className="group cursor-pointer rounded-2xl overflow-hidden border border-slate-200 bg-white hover:shadow-xl transition-shadow"
            >
              <div className={`relative h-40 bg-gradient-to-br ${t.accent} overflow-hidden`}>
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.15)_1px,transparent_1px)] bg-[size:20px_20px]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex gap-2">
                    <span className="w-12 h-8 rounded bg-white/80 backdrop-blur" />
                    <span className="w-12 h-8 rounded bg-white/60 backdrop-blur" />
                    <span className="w-12 h-8 rounded bg-white/80 backdrop-blur" />
                  </div>
                </div>
              </div>
              <div className="p-4">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                  {t.tag}
                </span>
                <h3 className="mt-1 text-sm font-bold text-slate-900 group-hover:text-violet-700 transition-colors">
                  {t.title}
                </h3>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
