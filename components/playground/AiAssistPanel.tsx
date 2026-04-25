/**
 * AI Assist panel — collapsible side panel with prompt + quick actions
 * (Generate, Describe, Review). Hits /api/ai/* endpoints. Hides itself if
 * /api/ai/status reports `configured: false` (env vars not set).
 *
 * Prompt history is persisted in localStorage under AI_HISTORY_KEY.
 */
"use client";

import { useState } from "react";
import { Sparkles, X, Wand2, FileText, ShieldCheck, Loader2 } from "lucide-react";
import type { PlaygroundGraph } from "./lib/types";

const AI_HISTORY_KEY = "architecture-playground:ai-history";
const MAX_HISTORY = 10;

interface Props {
  graph: PlaygroundGraph;
  open: boolean;
  onClose: () => void;
  onApplyGenerated: (graph: PlaygroundGraph) => void;
}

type Status = "idle" | "loading" | "error";

export function AiAssistPanel({ graph, open, onClose, onApplyGenerated }: Props) {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [output, setOutput] = useState<string>("");
  const [outputKind, setOutputKind] = useState<"none" | "describe" | "review" | "generate">("none");
  const [history, setHistory] = useState<string[]>(() => {
    if (typeof localStorage === "undefined") return [];
    try {
      const raw = localStorage.getItem(AI_HISTORY_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  function pushHistory(p: string) {
    const next = [p, ...history.filter((h) => h !== p)].slice(0, MAX_HISTORY);
    setHistory(next);
    try {
      localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  async function callApi(path: string, body: object) {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setStatus("idle");
      return json;
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Request failed");
      throw err;
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;
    pushHistory(prompt.trim());
    try {
      const json = (await callApi("/api/ai/generate", { prompt })) as { graph: PlaygroundGraph };
      setOutputKind("generate");
      setOutput(`Generated diagram with ${json.graph.nodes?.length ?? 0} nodes. Click "Apply to canvas" to load it.`);
      // Park the generated graph for one-click apply
      sessionStorage.setItem("architecture-playground:ai-generated", JSON.stringify(json.graph));
    } catch {
      /* surfaced via error state */
    }
  }

  function applyGenerated() {
    try {
      const raw = sessionStorage.getItem("architecture-playground:ai-generated");
      if (!raw) return;
      const g = JSON.parse(raw) as PlaygroundGraph;
      onApplyGenerated(g);
      sessionStorage.removeItem("architecture-playground:ai-generated");
      setOutput("Applied to canvas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed");
    }
  }

  async function handleDescribe() {
    try {
      const json = (await callApi("/api/ai/describe", { graph })) as { markdown: string };
      setOutputKind("describe");
      setOutput(json.markdown);
    } catch {
      /* surfaced */
    }
  }

  async function handleReview() {
    try {
      const json = (await callApi("/api/ai/review", { graph })) as { markdown: string };
      setOutputKind("review");
      setOutput(json.markdown);
    } catch {
      /* surfaced */
    }
  }

  if (!open) return null;

  return (
    <aside
      role="complementary"
      aria-label="AI Assist"
      className="fixed right-4 top-20 z-40 flex max-h-[calc(100vh-6rem)] w-96 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <Sparkles className="h-4 w-4 text-indigo-500" /> AI Assist
        </h2>
        <button
          onClick={onClose}
          aria-label="Close AI Assist"
          className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-3 p-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the architecture you want, e.g. 'Three-tier web app on Azure with App Service, SQL DB, and Front Door'"
          rows={3}
          className="w-full resize-y rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleGenerate}
            disabled={status === "loading" || !prompt.trim()}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {status === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
            Generate
          </button>
          <button
            onClick={handleDescribe}
            disabled={status === "loading" || graph.nodes.length === 0}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <FileText className="h-3 w-3" /> Describe
          </button>
          <button
            onClick={handleReview}
            disabled={status === "loading" || graph.nodes.length === 0}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <ShieldCheck className="h-3 w-3" /> Review
          </button>
        </div>

        {history.length > 0 && (
          <details className="text-xs text-zinc-600 dark:text-zinc-400">
            <summary className="cursor-pointer">Recent prompts</summary>
            <ul className="mt-1 space-y-1">
              {history.map((h, i) => (
                <li key={i}>
                  <button
                    onClick={() => setPrompt(h)}
                    className="text-left text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {h.slice(0, 80)}
                    {h.length > 80 ? "…" : ""}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {error && (
        <div className="border-t border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {output && (
        <div className="flex min-h-0 flex-1 flex-col border-t border-zinc-200 dark:border-zinc-800">
          {outputKind === "generate" && (
            <div className="border-b border-zinc-200 bg-indigo-50 p-2 dark:border-zinc-800 dark:bg-indigo-900/30">
              <button
                onClick={applyGenerated}
                className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500"
              >
                Apply to canvas
              </button>
            </div>
          )}
          <pre className="m-0 flex-1 overflow-auto whitespace-pre-wrap p-3 text-xs text-zinc-800 dark:text-zinc-200">
            {output}
          </pre>
        </div>
      )}
    </aside>
  );
}
