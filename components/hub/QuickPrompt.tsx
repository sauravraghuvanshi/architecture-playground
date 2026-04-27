"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";

const ROTATING = [
  "A serverless image-resize pipeline on AWS",
  "Multi-region active-active Postgres on Azure",
  "Event-driven order workflow with Kafka & GCP",
  "Sequence diagram of an OAuth 2.0 PKCE flow",
  "C4 container view of a notifications service",
];

const SUGGESTIONS = [
  "Three-tier web app on Azure",
  "Event-driven microservices",
  "Serverless image pipeline",
  "Real-time chat with WebSockets",
  "Data lakehouse on GCP",
];

/**
 * Hero "command line" for new diagrams. Dark editorial — matches
 * the marketing Hero so the hub and landing page feel like one app.
 */
export function QuickPrompt() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % ROTATING.length), 3000);
    return () => clearInterval(t);
  }, []);

  const submit = (text: string) => {
    if (!text.trim()) return;
    setBusy(true);
    const params = new URLSearchParams({ prompt: text.trim() });
    router.push(`/diagrammatic?${params.toString()}`);
  };

  return (
    <section className="pt-12 pb-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center mb-6"
      >
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-100">
          What are you architecting today?
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Describe a system. We&apos;ll scaffold the canvas — every node editable.
        </p>
      </motion.div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="relative max-w-3xl mx-auto"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="group relative rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur transition-all focus-within:border-lime-300/60 focus-within:shadow-[0_20px_60px_-15px_rgba(190,242,100,0.25)]"
        >
          <div className="flex items-center gap-2 p-2 pl-4">
            <Sparkles className="h-5 w-5 shrink-0 text-lime-300" />
            <div className="relative h-9 flex-1">
              <input
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
                      {ROTATING[idx]}
                    </motion.span>
                  </AnimatePresence>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={busy || !value.trim()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-lime-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Generate
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-3 flex items-center justify-center gap-1.5 flex-wrap"
        >
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setValue(s);
                submit(s);
              }}
              className="cursor-pointer rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
            >
              {s}
            </button>
          ))}
        </motion.div>
      </form>
    </section>
  );
}
