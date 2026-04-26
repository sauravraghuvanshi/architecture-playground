"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Quote } from "lucide-react";
import { TESTIMONIALS } from "./copy";

export function Testimonials() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % TESTIMONIALS.length), 6500);
    return () => clearInterval(t);
  }, []);

  const current = TESTIMONIALS[idx];

  return (
    <section className="py-24 bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-4xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-violet-50 text-violet-700 text-xs font-semibold mb-4">
            What teams say
          </span>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">
            From the people shipping with it.
          </h2>
        </motion.div>

        <div className="relative min-h-[300px]">
          <AnimatePresence mode="wait">
            <motion.figure
              key={idx}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.5 }}
              className="rounded-3xl bg-white border border-slate-200 p-10 md:p-14 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.15)]"
            >
              <Quote className="w-10 h-10 text-violet-300" />
              <blockquote className="mt-4 text-xl md:text-2xl font-medium text-slate-800 leading-snug">
                &ldquo;{current.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <span className="grid place-items-center w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white font-bold">
                  {current.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
                <div>
                  <div className="font-bold text-slate-900">{current.name}</div>
                  <div className="text-sm text-slate-600">
                    {current.role} · {current.company}
                  </div>
                </div>
              </figcaption>
            </motion.figure>
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-center gap-2">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to testimonial ${i + 1}`}
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  i === idx ? "w-8 bg-violet-600" : "w-2 bg-slate-300 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
