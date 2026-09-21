/**
 * AI Assist panel — collapsible side panel with prompt + quick actions
 * (Generate, Describe, Review). Hits /api/ai/* endpoints. Hides itself if
 * /api/ai/status reports `configured: false` (env vars not set).
 *
 * Prompt history is device-local only after explicit opt-in. Candidates stay in memory.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Wand2, FileText, ShieldCheck, Loader2 } from "lucide-react";
import { AiPrivacyNotice } from "@/components/diagrammatic/shared/AiPrivacyNotice";
import { clearAiLocalHistory, readAiLocalHistory, rememberAiPrompt } from "@/lib/ai-local-history";
import type { PlaygroundGraph } from "./lib/types";

interface Props {
  graph: PlaygroundGraph;
  open: boolean;
  onClose: () => void;
  onApplyGenerated: (graph: PlaygroundGraph) => void;
}

type Status = "idle" | "loading" | "error";
type Intent = "describe" | "review" | "generate";

export function AiAssistPanel({ graph, open, onClose, onApplyGenerated }: Props) {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [output, setOutput] = useState<string>("");
  const [outputKind, setOutputKind] = useState<"none" | Intent>("none");
  const [generatedGraph, setGeneratedGraph] = useState<PlaygroundGraph | null>(null);
  const [remember, setRemember] = useState(false);
  const [historyState, setHistoryState] = useState<{ history: string[]; error: string; ready: boolean }>(() => {
    if (typeof window === "undefined") return { history: [], error: "", ready: true };
    try {
      return { history: readAiLocalHistory(), error: "", ready: true };
    } catch (cause) {
      return { history: [], error: cause instanceof Error ? cause.message : "Could not read saved AI prompt history.", ready: false };
    }
  });
  const { history, error: storageError, ready: historyReady } = historyState;
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active && !request.current) setStatus("idle");
    });
    return () => {
      active = false;
      request.current?.abort();
      request.current = null;
    };
  }, [open]);

  function cancelRequest() {
    request.current?.abort();
    request.current = null;
    setStatus("idle");
  }

  function closePanel() {
    cancelRequest();
    onClose();
  }

  function clearSession() {
    cancelRequest();
    setPrompt("");
    setOutput("");
    setOutputKind("none");
    setGeneratedGraph(null);
    setRemember(false);
    setError("");
    try {
      clearAiLocalHistory();
      setHistoryState({ history: [], error: "", ready: true });
    } catch (cause) {
      setHistoryState({ history: [], error: cause instanceof Error ? cause.message : "Some saved AI data could not be removed.", ready: false });
    }
  }

  async function runRequest(intent: Intent) {
    if (!open || request.current || (intent === "generate" && !prompt.trim())) return;
    const controller = new AbortController();
    request.current = controller;
    const isCurrent = () => request.current === controller && !controller.signal.aborted;
    setStatus("loading");
    setError("");
    setOutput("");
    setOutputKind("none");
    setGeneratedGraph(null);
    if (intent === "generate" && remember && historyReady) {
      try {
        setHistoryState({ history: rememberAiPrompt(prompt, history, true), error: "", ready: true });
      } catch (cause) {
        setHistoryState((current) => ({ ...current, error: cause instanceof Error ? cause.message : "Could not save AI prompt history." }));
      }
    }
    try {
      const res = await fetch(`/api/ai/${intent}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intent === "generate" ? { prompt } : { graph }),
        signal: controller.signal,
      });
      const json = await res.json();
      if (!isCurrent()) return;
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      if (intent === "generate") {
        if (!json.graph || !Array.isArray(json.graph.nodes) || !Array.isArray(json.graph.edges)) {
          throw new Error("The AI response did not contain a valid diagram.");
        }
        setGeneratedGraph(json.graph as PlaygroundGraph);
        setOutput(`Generated diagram with ${json.graph.nodes.length} nodes. Click "Apply to canvas" to load it.`);
      } else {
        if (typeof json.markdown !== "string") throw new Error("The AI response did not contain readable output.");
        setOutput(json.markdown);
      }
      setOutputKind(intent);
      setStatus("idle");
    } catch (cause) {
      if (!isCurrent()) return;
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Request failed");
    } finally {
      if (request.current === controller) request.current = null;
    }
  }

  function applyGenerated() {
    if (!generatedGraph) return;
    try {
      onApplyGenerated(generatedGraph);
      setGeneratedGraph(null);
      setError("");
      setStatus("idle");
      setOutput("Applied to canvas.");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Apply failed");
    }
  }

  if (!open) return null;

  return (
    <aside
      role="complementary"
      aria-label="AI Assist"
      className="fixed right-4 top-20 z-40 flex max-h-[calc(100vh-6rem)] w-96 max-w-[calc(100vw-2rem)] flex-col overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <Sparkles className="h-4 w-4 text-indigo-500" /> AI Assist
        </h2>
        <button
          onClick={closePanel}
          aria-label="Close AI Assist"
          className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-3 p-3">
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Prompts are not saved by default. Opt in below to keep up to 10 prompts in this browser&apos;s
          local storage until you clear them. Existing saved prompts remain available without enabling
          new saves. Generated candidates stay in panel memory; closing cancels pending requests.
        </p>
        <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" checked={remember} disabled={!historyReady} onChange={(event) => setRemember(event.target.checked)} />
          Remember prompts on this device
        </label>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          This opt-in resets on reload. Turning it off stops future saves but does not erase existing
          history. Clear AI session removes this panel&apos;s prompt, output, candidate and saved AI
          history, including any legacy parked candidate. It does not delete diagrams, comments,
          versions or copies already applied to the canvas, and cannot erase provider-retained data.
        </p>
        <button
          type="button"
          onClick={clearSession}
          className="self-start rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Clear AI session
        </button>
        <AiPrivacyNotice capability="chat" active={open} />
        <AiPrivacyNotice capability="review" active={open} />
        <textarea
          aria-label="Architecture prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the architecture you want, e.g. 'Three-tier web app on Azure with App Service, SQL DB, and Front Door'"
          rows={3}
          className="w-full resize-y rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void runRequest("generate")}
            disabled={status === "loading" || !prompt.trim()}
            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {status === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
            Generate
          </button>
          <button
            onClick={() => void runRequest("describe")}
            disabled={status === "loading" || graph.nodes.length === 0}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <FileText className="h-3 w-3" /> Describe
          </button>
          <button
            onClick={() => void runRequest("review")}
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

      {(error || storageError) && (
        <div role="alert" className="border-t border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/30 dark:text-red-300">
          {storageError && <p>{storageError}</p>}
          {error && <p>{error}</p>}
        </div>
      )}

      {output && (
        <div className="flex min-h-0 flex-1 flex-col border-t border-zinc-200 dark:border-zinc-800">
          {outputKind === "generate" && generatedGraph && (
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
