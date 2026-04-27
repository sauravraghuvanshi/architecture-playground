/**
 * Dark editorial hero — distinct from Cloudairy's pastel/glass aesthetic.
 *
 * What's gone (vs. the previous version):
 *   - Violet→fuchsia→orange gradient on the title and CTA
 *   - Pastel glow blobs in the background
 *   - "Stats" row (numbers were padding, not real)
 *   - References to replacing Lucid/Miro (marketing fiction, removed)
 *
 * What's here now:
 *   - Near-black canvas, large editorial italic display H1
 *   - Lime accent on the only colored interactive element
 *   - Prompt input that submits to /diagrammatic?prompt=… (real generation)
 */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, Github } from "lucide-react";
import { BRAND, HERO_PROMPTS, HERO_CHIPS } from "./copy";

export function Hero() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % HERO_PROMPTS.length), 3000);
    return () => clearInterval(t);
  }, []);

  const submit = (text: string) => {
    if (!text.trim()) return;
    router.push(`/diagrammatic?prompt=${encodeURIComponent(text.trim())}`);
  };

  return (
    <section className="relative overflow-hidden bg-zinc-950 pt-32 pb-24 text-zinc-50">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(190,242,100,0.08),transparent_55%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]"
      />

      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400 backdrop-blur"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-lime-300" />
          Open source · MIT · React Flow engine
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="mt-8 text-balance text-5xl font-semibold leading-[1.04] tracking-tight md:text-7xl"
        >
          An open architect&apos;s canvas.
          <br />
          <span className="italic text-zinc-400">Type a system,</span>
          <span className="text-lime-300"> watch it draw itself.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mx-auto mt-6 max-w-2xl text-balance text-base text-zinc-400 md:text-lg"
        >
          {BRAND.name} is a single canvas for cloud architecture today, with mind maps,
          flowcharts, sequences, ER, UML, whiteboarding and Kanban arriving phase by
          phase. No sign-in. Drafts stay in your browser.
        </motion.p>

        <motion.form
          onSubmit={(e) => {
            e.preventDefault();
            submit(value);
          }}
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mx-auto mt-12 max-w-2xl"
        >
          <div className="group relative rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur transition focus-within:border-lime-300/60">
            <div className="flex items-center gap-3 p-2.5 pl-4">
              <Sparkles className="h-4 w-4 shrink-0 text-lime-300" />
              <div className="relative h-9 flex-1 text-left">
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="absolute inset-0 bg-transparent text-[15px] text-zinc-100 outline-none placeholder:text-transparent"
                  aria-label="Describe a system"
                />
                {!value && (
                  <div className="pointer-events-none absolute inset-0 flex items-center overflow-hidden text-[15px] text-zinc-500">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={idx}
                        initial={{ y: 12, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -12, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        {HERO_PROMPTS[idx]}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-lime-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-lime-200"
              >
                Generate
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 border-t border-zinc-800 px-3 pt-2 pb-2.5">
              {HERO_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    setValue(chip);
                    submit(chip);
                  }}
                  className="cursor-pointer rounded-md px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </motion.form>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            href="/diagrammatic"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800 cursor-pointer"
          >
            Open the canvas
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="https://github.com/sauravraghuvanshi/architecture-playground"
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-zinc-400 transition hover:text-zinc-100 cursor-pointer"
          >
            <Github className="h-4 w-4" />
            View source
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
