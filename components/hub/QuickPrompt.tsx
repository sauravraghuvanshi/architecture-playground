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
          className="group relative rounded-2xl bg-white border border-slate-200 shadow-[0_10px_40px_-15px_rgba(124,58,237,0.25)] focus-within:border-violet-400 focus-within:shadow-[0_20px_60px_-15px_rgba(124,58,237,0.4)] transition-all"
        >
          <div className="flex items-center gap-2 p-2 pl-4">
            <Sparkles className="w-5 h-5 text-violet-500 shrink-0" />
            <div className="flex-1 relative h-9">
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="absolute inset-0 bg-transparent outline-none text-[15px] text-slate-900 placeholder:text-transparent"
                aria-label="Describe a system"
              />
              {!value && (
                <div className="pointer-events-none absolute inset-0 flex items-center text-[15px] text-slate-400 overflow-hidden">
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
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-md hover:shadow-lg hover:brightness-110 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
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
              className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      </form>
    </section>
  );
}
