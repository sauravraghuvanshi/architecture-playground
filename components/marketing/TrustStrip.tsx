"use client";

import { motion } from "framer-motion";
import { TRUST_LOGOS } from "./copy";

export function TrustStrip() {
  return (
    <section className="py-12 border-y border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold mb-8">
          Trusted by architects shipping production systems
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-6 items-center">
          {TRUST_LOGOS.map((name, i) => (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              className="text-center"
            >
              <span className="text-sm font-bold text-slate-400 hover:text-slate-700 transition-colors tracking-tight">
                {name}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
