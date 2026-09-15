/**
 * AiPromptModal — prompt-driven generation UI.
 *
 * For graph modes (everything except whiteboard): POSTs to /api/ai/generate
 * with the active mode and a free-form description; the graph is returned
 * in the mode's native shape and handed back via `onResult`.
 *
 * For whiteboard mode: POSTs to /api/ai/image and consumes the SSE stream
 * (heartbeats keep the connection alive past Azure App Service's 230s LB
 * timeout — gpt-image-2 takes ~3–4 min). The base64 image is handed back
 * via `onImageResult`. While streaming, the modal shows an elapsed-seconds
 * counter driven by both the route's `elapsed` field and a local 1Hz tick
 * so the UI keeps moving even between heartbeats.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import type { DiagrammaticMode } from "./types";
import { consumeSseResponse } from "@/lib/sse-client";
import { IMAGE_STYLES } from "@/lib/image-styles";
import {
  DESIGN_DISCLAIMER,
  DESIGN_REFERENCES,
  designAdviceSchema,
  generatedArchitectureSchema,
  type BusinessConstraints,
  type DesignAssistance,
} from "@/lib/ai-mode-prompts";

type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";

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
  whiteboard: [
    "Hand-drawn cloud architecture sketch with three tiers and arrows between them",
    "Whiteboard diagram of a 3-actor sequence: user, app, database",
    "Concept sketch: a notebook page with arrows linking 'idea → prototype → ship'",
  ],
};

interface Props {
  mode: DiagrammaticMode;
  open: boolean;
  onClose: () => void;
  onResult: (graph: unknown) => void | Promise<void>;
  /** Whiteboard-only. Receives a base64 image (no data: prefix) + mime type. */
  onImageResult?: (b64: string, mime: string) => void;
}

export function AiPromptModal({ mode, open, onClose, onResult, onImageResult }: Props) {
  const isImageMode = mode === "whiteboard";
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<ImageSize>("1024x1024");
  const [imageStyle, setImageStyle] = useState<(typeof IMAGE_STYLES)[number]["id"]>("original");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0); // seconds, image-mode only
  const [constraints, setConstraints] = useState<BusinessConstraints>({});
  const [generated, setGenerated] = useState<{ graph: unknown; guidance: DesignAssistance } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(null);
      setBusy(false);
      setElapsed(0);
      setGenerated(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      // Closing the modal cancels any in-flight request.
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [open]);

  // 1Hz local elapsed-seconds tick while the image request is in flight, so
  // the UI keeps moving between server heartbeats (heartbeats are every 15s).
  useEffect(() => {
    if (!busy || !isImageMode) return;
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy, isImageMode]);

  // Cancel any in-flight stream when the component unmounts (route nav).
  useEffect(() => () => abortRef.current?.abort(), []);

  if (!open) return null;

  const submitGraph = async (trimmed: string) => {
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, mode, ...(mode === "architecture" ? { businessConstraints: constraints } : {}) }),
        signal: ac.signal,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Request failed (${res.status})`);
        return;
      }
      if (ac.signal.aborted) return;
      if (mode === "architecture") {
        const graph = generatedArchitectureSchema.parse(json.graph);
        const advice = designAdviceSchema.parse(json.designAssistance);
        setGenerated({ graph, guidance: { ...advice, kind: "guided-design", references: DESIGN_REFERENCES, disclaimer: DESIGN_DISCLAIMER } });
        return;
      }
      await onResult(json.graph);
      setPrompt("");
      onClose();
    } catch (err) {
      if (!ac.signal.aborted) setError(err instanceof Error ? err.message : "Network error");
    } finally {
      if (abortRef.current === ac) {
        setBusy(false);
        abortRef.current = null;
      }
    }
  };

  const submitImage = async (trimmed: string) => {
    if (!onImageResult) {
      setError("Image insertion not wired for this mode.");
      setBusy(false);
      return;
    }
    const ac = new AbortController();
    abortRef.current = ac;
    let resolved = false;
    try {
      const res = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, size, style: imageStyle }),
        signal: ac.signal,
      });
      if (!res.ok) {
        // Non-200 means we never entered the SSE flow (e.g. 503 not configured,
        // 429 rate-limited at our layer). Try to surface the JSON error.
        const text = await res.text().catch(() => "");
        try {
          const j = JSON.parse(text) as { error?: string };
          setError(j.error ?? `Request failed (${res.status})`);
        } catch {
          setError(`Request failed (${res.status})`);
        }
        setBusy(false);
        return;
      }
      await consumeSseResponse(res, {
        signal: ac.signal,
        onEvent: ({ data }) => {
          let parsed: { type?: string; b64?: string; url?: string; size?: string; message?: string; elapsed?: number };
          try {
            parsed = JSON.parse(data);
          } catch {
            return;
          }
          if (parsed.type === "started") return;
          if (parsed.type === "error") {
            setError(parsed.message ?? "Image generation failed");
            return;
          }
          if (parsed.type === "result") {
            if (parsed.b64) {
              onImageResult(parsed.b64, "image/png");
              resolved = true;
              setPrompt("");
              onClose();
            } else if (parsed.url) {
              setError("Server returned a URL response; only base64 is supported by the whiteboard inserter.");
            } else {
              setError("Server returned no image data");
            }
          }
        },
      });
      if (!resolved && !ac.signal.aborted) {
        // Stream closed without a terminal event.
        setError((prev) => prev ?? "Image generation ended without a result");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User cancelled — modal already closed; no toast needed.
      } else {
        setError(err instanceof Error ? err.message : "Network error");
      }
    } finally {
      if (abortRef.current === ac) {
        setBusy(false);
        abortRef.current = null;
      }
    }
  };

  const submit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    setElapsed(0);
    if (isImageMode) {
      await submitImage(trimmed);
    } else {
      await submitGraph(trimmed);
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  };

  const suggestions = SUGGESTED[mode] ?? [];

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/75 px-4 pt-24 backdrop-blur-sm" onClick={busy ? undefined : onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1220] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="AI Assist"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            <span className="text-sm font-semibold text-zinc-100">
              AI {isImageMode ? "Image" : "Assist"} · {mode}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">
          <label htmlFor="diagrammatic-ai-prompt" className="mb-1 block text-xs font-medium text-zinc-300">
            {isImageMode ? "Describe the image to generate" : "Describe what to build"}
          </label>
          <textarea
            id="diagrammatic-ai-prompt"
            ref={inputRef}
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setGenerated(null); }}
            disabled={busy}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            rows={4}
            maxLength={isImageMode ? 1000 : 2000}
            placeholder={isImageMode ? "e.g. hand-drawn diagram of a 3-tier web app, sketchy lines" : "e.g. user signup with email verification"}
            className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/10 disabled:opacity-50"
          />
          {mode === "architecture" && (
            <details className="mt-3 rounded-xl border border-slate-700 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-200">Business constraints (optional)</summary>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {([
                  ["budget", "Budget"], ["availability", "Availability target"],
                  ["recovery", "RTO / RPO"], ["dataResidency", "Data residency"],
                  ["compliance", "Compliance"], ["scale", "Expected scale"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="text-xs text-slate-300">{label}
                    <input value={constraints[key] ?? ""} maxLength={500} disabled={busy}
                      onChange={(event) => { setConstraints((previous) => ({ ...previous, [key]: event.target.value })); setGenerated(null); }}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100" />
                  </label>
                ))}
              </div>
            </details>
          )}
          {isImageMode && (
            <div className="mt-3">
              <label htmlFor="image-style" className="mb-1 block text-xs text-slate-300">Visual style</label>
              <select id="image-style" value={imageStyle} disabled={busy}
                onChange={(event) => {
                  const selected = IMAGE_STYLES.find((style) => style.id === event.target.value);
                  if (selected) setImageStyle(selected.id);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100">
                {IMAGE_STYLES.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}
              </select>
              <p className="mt-2 text-[11px] text-slate-400">Your prompt is sent to the configured AI service. Avoid secrets and personal data. Generated images remain in your browser draft; review them before sharing.</p>
            </div>
          )}
          {isImageMode && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">Aspect</span>
              {(["1024x1024", "1536x1024", "1024x1536"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => setSize(s)}
                  className={`cursor-pointer rounded-md border px-2 py-0.5 text-[10px] disabled:opacity-50 ${
                    size === s
                      ? "border-cyan-500 bg-cyan-500/15 text-cyan-100"
                      : "border-slate-700 bg-slate-950 text-slate-300 hover:border-cyan-500/60"
                  }`}
                >
                  {s === "1024x1024" ? "Square" : s === "1536x1024" ? "Landscape" : "Portrait"}
                </button>
              ))}
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">Try</div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={busy}
                    onClick={() => { setPrompt(s); setGenerated(null); }}
                    className="cursor-pointer rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-300 hover:border-cyan-500/60 hover:text-cyan-100 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {busy && isImageMode && (
            <div className="mt-3 flex items-center gap-2 rounded border border-cyan-700/40 bg-cyan-950/30 px-3 py-2 text-xs text-cyan-100">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>
                Generating image — {fmtElapsed(elapsed)} elapsed.
                <span className="ml-1 text-cyan-300/70">Generation may take several minutes.</span>
              </span>
            </div>
          )}
          {error && (
            <div role="alert" className="mt-3 rounded border border-rose-700/50 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}
          {generated && (
            <section aria-label="Guided design preview" className="mt-4 space-y-3 rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3 text-xs text-slate-200">
              <h3 className="font-semibold text-cyan-200">Proposed design - review before applying</h3>
              {(["assumptions", "recommendations", "tradeoffs", "nextSteps"] as const).map((key) => (
                <div key={key}>
                  <h4 className="mb-1 font-semibold capitalize">{key === "nextSteps" ? "Next steps" : key}</h4>
                  <ul className="list-disc space-y-1 pl-4">{generated.guidance[key].map((item, index) => <li key={index}>{item}</li>)}</ul>
                </div>
              ))}
              <div className="flex flex-wrap gap-3">{generated.guidance.references.map((reference) => (
                <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer" className="text-cyan-300 underline">{reference.title}</a>
              ))}</div>
              <p className="text-slate-400">{generated.guidance.disclaimer}</p>
              <button type="button" disabled={busy} className="rounded-lg bg-cyan-400 px-3 py-2 font-semibold text-slate-950 disabled:opacity-50"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onResult(generated.graph);
                    setPrompt("");
                    onClose();
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : "The generated design could not be applied.");
                  } finally { setBusy(false); }
                }}>Apply generated design</button>
            </section>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-zinc-800 px-4 py-3">
          <span className="text-[10px] text-zinc-500">⌘↵ to send · {prompt.length}/{isImageMode ? 1000 : 2000}</span>
          <div className="flex items-center gap-2">
            {busy ? (
              <button type="button" onClick={cancel} className="cursor-pointer rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
                Cancel
              </button>
            ) : (
              <button type="button" onClick={onClose} className="cursor-pointer rounded-md px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={busy || !prompt.trim()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-cyan-400 px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {busy ? (isImageMode ? "Generating…" : "Generating…") : (isImageMode ? "Generate image" : "Generate")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtElapsed(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r.toString().padStart(2, "0")}s`;
}
