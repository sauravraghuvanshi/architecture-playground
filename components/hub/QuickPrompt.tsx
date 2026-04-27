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
 * Hero "command line" for new diagrams: type a system, AI scaffolds it.
 * For now the submit just deep-links into /diagrammatic with the prompt;
 * the AI generation lands in the next phase.
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
    <section className="pt-10 pb-8">
      <div className="text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">
          What are you architecting today?
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Describe a system. We&apos;ll scaffold the canvas — every node editable.
        </p>
      </div>

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
          transition={{ duration: 0.4 }}
          className="group relative rounded-2xl border border-zinc-200 bg-white shadow-[0_10px_40px_-15px_rgba(15,23,42,0.18)] transition-all focus-within:border-lime-300 focus-within:shadow-[0_20px_60px_-15px_rgba(190,242,100,0.35)]"
        >
            <div className="flex items-center gap-2 p-2 pl-4">
              <Sparkles className="h-5 w-5 shrink-0 text-lime-500" />
              <div className="relative h-9 flex-1">
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="absolute inset-0 bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-transparent"
                  aria-label="Describe a system"
                />
                {!value && (
                  <div className="pointer-events-none absolute inset-0 flex items-center overflow-hidden text-[15px] text-zinc-400">
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
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-lime-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Generate
              </button>
            </div>
          </motion.div>

        <div className="mt-3 flex items-center justify-center gap-1.5 flex-wrap">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setValue(s);
                submit(s);
              }}
              className="cursor-pointer rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200 hover:text-zinc-900"
            >
              {s}
            </button>
          ))}
        </div>
      </form>
    </section>
  );
}
