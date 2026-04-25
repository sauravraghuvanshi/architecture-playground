/**
 * Presentation mode — full-screen sequence walkthrough of a saved diagram.
 *
 * Loads the diagram via the existing GET /api/diagrams/[id] (or 404) and
 * steps through edges with sequenceStep set, advancing on Space/→ and
 * stepping backward on ←. Esc returns to the dashboard. The current edge
 * is highlighted; the rest dims.
 */
"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PlaygroundGraph, PlaygroundEdge } from "@/components/playground/lib/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default function PresentationPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const [graph, setGraph] = useState<PlaygroundGraph | null>(null);
  const [error, setError] = useState<string>("");
  const [step, setStep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/diagrams/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: { graphJson: string; name?: string }) => {
        if (cancelled) return;
        const g = JSON.parse(d.graphJson) as PlaygroundGraph;
        setGraph(g);
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [id]);

  const sequencedEdges = useMemo<PlaygroundEdge[]>(() => {
    if (!graph) return [];
    return graph.edges
      .filter((e) => typeof e.data?.step === "number")
      .sort((a, b) => (a.data!.step! - b.data!.step!));
  }, [graph]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setStep((s) => Math.min(s + 1, sequencedEdges.length));
      } else if (e.key === "ArrowLeft" || e.key === "Backspace") {
        e.preventDefault();
        setStep((s) => Math.max(0, s - 1));
      } else if (e.key === "Escape") {
        router.push("/dashboard");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, sequencedEdges.length]);

  if (error) {
    return (
      <div className="grid h-screen place-items-center bg-zinc-950 text-zinc-100">
        <div className="text-center">
          <p className="mb-2 text-lg">Could not load diagram.</p>
          <p className="text-sm text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!graph) {
    return <div className="grid h-screen place-items-center bg-zinc-950 text-zinc-100">Loading…</div>;
  }

  const current = step > 0 ? sequencedEdges[step - 1] : null;
  const sourceNode = current && graph.nodes.find((n) => n.id === current.source);
  const targetNode = current && graph.nodes.find((n) => n.id === current.target);

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <h1 className="text-base font-semibold">{graph.metadata?.name || "Architecture"}</h1>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span>Step {step} / {sequencedEdges.length}</span>
          <span>← / → to navigate · Esc to exit</span>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-12">
        {sequencedEdges.length === 0 ? (
          <p className="text-zinc-400">
            This diagram has no sequenced edges. Open it in the playground and use the Auto-Sequence button to add steps.
          </p>
        ) : current && sourceNode && targetNode ? (
          <>
            <div className="text-xs uppercase tracking-widest text-zinc-500">Step {step}</div>
            <div className="flex items-center gap-6">
              <NodeBadge label={(sourceNode.data as { label?: string }).label || sourceNode.id} />
              <div className="text-2xl text-indigo-400">→</div>
              <NodeBadge label={(targetNode.data as { label?: string }).label || targetNode.id} />
            </div>
            {current.data?.label && (
              <p className="max-w-2xl text-center text-lg text-zinc-300">{current.data.label}</p>
            )}
          </>
        ) : (
          <p className="text-zinc-400">Press → to begin.</p>
        )}
      </main>

      <footer className="border-t border-zinc-800 px-6 py-3 text-xs text-zinc-500">
        Architecture Playground · Presentation mode
      </footer>
    </div>
  );
}

function NodeBadge({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-indigo-500/50 bg-indigo-500/10 px-6 py-4 text-lg font-medium">
      {label}
    </div>
  );
}
