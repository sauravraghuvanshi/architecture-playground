/**
 * AiPromptModal — minimal prompt-driven generation UI for any mode.
 *
 * Posts to /api/ai/generate with the active mode and a free-form description.
 * The graph is returned in the mode's native shape and handed back via
 * onResult; the caller is responsible for hydrating its canvas.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import type { DiagrammaticMode } from "./types";

const SUGGESTED: Record<DiagrammaticMode, string[]> = {
  architecture: [
    "Three-tier web app on Azure with Front Door, App Service, and SQL Database",
    "Serverless image-processing pipeline on AWS",
  ],
  flowchart: [
    "User signup with email verification and welcome flow",
    "Password reset with rate-limited retry loop",
  ],
  mindmap: [
    "Q4 product roadmap brainstorm",
    "Personal weekly review framework",
  ],
  sequence: [
    "OAuth2 authorization-code login between user, web app, and identity provider",
    "Payment processing across checkout, payment service, and bank",
  ],
  er: [
    "E-commerce schema with users, orders, products, and inventory",
    "Blog platform with users, posts, comments, and tags",
  ],
  uml: [
    "Vehicle hierarchy with Car, Truck, and Motorcycle inheriting from Vehicle",
    "Observer pattern with Subject and Observer",
  ],
  c4: [
    "Internet banking system context: customer, internet banking, mainframe, email",
    "SaaS analytics platform: marketing site, app, API, warehouse, BI",
  ],
  kanban: [
    "Two-week sprint board for shipping a payment refunds feature",
    "Marketing launch workstream: research, draft, review, publish",
  ],
  whiteboard: ["Free-form ideas (whiteboard mode does not support AI generation yet)"],
};

interface Props {
  mode: DiagrammaticMode;
  open: boolean;
  onClose: () => void;
  onResult: (graph: unknown) => void;
}

export function AiPromptModal({ mode, open, onClose, onResult }: Props) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, mode }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Request failed (${res.status})`);
        return;
      }
      onResult(json.graph);
      setPrompt("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(false);
    }
  };

  const suggestions = SUGGESTED[mode] ?? [];

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-zinc-950/70 px-4 pt-24 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="AI Assist"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-300" />
            <span className="text-sm font-semibold text-zinc-100">AI Assist · {mode}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-4">
          <label className="mb-1 block text-xs font-medium text-zinc-300">Describe what to build</label>
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            rows={4}
            maxLength={2000}
            placeholder="e.g. user signup with email verification"
            className="w-full resize-y rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none"
          />
          {suggestions.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">Try</div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPrompt(s)}
                    className="cursor-pointer rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-[10px] text-zinc-300 hover:border-violet-500/60 hover:text-violet-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && (
            <div className="mt-3 rounded border border-rose-700/50 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-zinc-800 px-4 py-3">
          <span className="text-[10px] text-zinc-500">⌘↵ to send · {prompt.length}/2000</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="cursor-pointer rounded-md px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || !prompt.trim()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-400 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {busy ? "Generating…" : "Generate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
