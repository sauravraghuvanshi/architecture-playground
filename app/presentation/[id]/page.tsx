/**
 * Presentation mode — full-screen sequence walkthrough of a saved diagram.
 *
 * Reads a saved architecture from this browser without changing its original.
 * Native edge steps advance together on Space/→ and backward on ←.
 * Esc returns to the saved diagram, or to My diagrams if loading failed.
 */
"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseArchitectureDocument } from "@/lib/architecture-document";
import type { ArchEdge, VersionedArchitecture } from "@/lib/architecture-model";
import { DiagramLibraryError, getDiagram } from "@/lib/diagram-library";

interface Props {
  params: Promise<{ id: string }>;
}

export default function PresentationPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const [result, setResult] = useState<{
    id: string;
    name?: string;
    graph?: VersionedArchitecture;
    error?: string;
  } | null>(null);
  const [step, setStep] = useState(0);
  const graph = result?.id === id ? result.graph : undefined;
  const error = result?.id === id ? result.error : undefined;
  const returnHref = graph
    ? `/diagrammatic?mode=architecture&document=${encodeURIComponent(id)}`
    : "/diagrammatic?mode=architecture&library=1";

  useEffect(() => {
    let cancelled = false;
    getDiagram(id)
      .then((document) => {
        if (cancelled) return;
        if (document.mode !== "architecture") {
          throw new Error("Presentation supports saved Cloud Architecture diagrams only. Open My diagrams to choose an architecture.");
        }
        let graph: VersionedArchitecture;
        try {
          graph = parseArchitectureDocument(document.payload);
        } catch {
          throw new Error("The saved architecture is invalid or uses an unsupported format. Open My diagrams to recover it or import a valid architecture. The saved original has not been changed.");
        }
        setResult({ id, name: document.name, graph });
        setStep(0);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        const message = cause instanceof DiagramLibraryError && cause.code === "not-found"
          ? "This diagram is not saved in this browser. Open My diagrams to choose or save a local architecture before presenting."
          : cause instanceof Error ? cause.message : "Browser storage could not be read. Check browser privacy settings and try again.";
        setResult({ id, error: message });
      });
    return () => { cancelled = true; };
  }, [id]);

  const sequenceSteps = useMemo(() => {
    if (!graph) return [];
    const groups = new Map<number, ArchEdge[]>();
    for (const edge of graph.edges) {
      if (edge.step === undefined) continue;
      const edges = groups.get(edge.step) ?? [];
      edges.push(edge);
      groups.set(edge.step, edges);
    }
    return [...groups].sort(([left], [right]) => left - right)
      .map(([number, edges]) => ({ number, edges }));
  }, [graph]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        router.push(returnHref);
        return;
      }
      if (e.target instanceof Element && e.target.closest("a, button, input, textarea, select, [contenteditable=true]")) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setStep((s) => Math.min(s + 1, sequenceSteps.length));
      } else if (e.key === "ArrowLeft" || e.key === "Backspace") {
        e.preventDefault();
        setStep((s) => Math.max(0, s - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, returnHref, sequenceSteps.length]);

  if (error) {
    return (
      <div className="grid h-screen place-items-center bg-zinc-950 text-zinc-100">
        <div role="alert" aria-labelledby="presentation-error-title" className="max-w-xl p-6 text-center">
          <h1 id="presentation-error-title" className="mb-2 text-lg">Could not load diagram.</h1>
          <p className="text-sm text-zinc-400">{error}</p>
          <Link href={returnHref} className="mt-4 inline-block text-indigo-300 underline">Open My diagrams</Link>
        </div>
      </div>
    );
  }

  if (!graph) {
    return <div className="grid h-screen place-items-center bg-zinc-950 text-zinc-100">Loading…</div>;
  }

  const current = step > 0 ? sequenceSteps[step - 1] : null;

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-6 py-3">
        <h1 className="text-base font-semibold">{result?.name || graph.metadata?.name || "Architecture"}</h1>
        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
          <span>Step {step} / {sequenceSteps.length}</span>
          <span>← / → / Space to navigate · Esc to exit</span>
          <Link href={returnHref} className="text-indigo-300 underline">Return to diagram</Link>
        </div>
      </header>

      <main aria-live="polite" className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-6 sm:p-12">
        {sequenceSteps.length === 0 ? (
          <p className="text-zinc-400">
            This diagram has no sequenced edges. Return to the diagram and use Auto-Sequence to add steps.
          </p>
        ) : current ? (
          <>
            <div className="text-xs uppercase tracking-widest text-zinc-500">Sequence step {current.number}</div>
            {current.edges.map((edge) => {
              const source = graph.nodes.find((node) => node.id === edge.source)!;
              const target = graph.nodes.find((node) => node.id === edge.target)!;
              return (
                <section key={edge.id} aria-label={edge.label || `${source.label || source.id} to ${target.label || target.id}`} className="flex max-w-full flex-col items-center gap-3">
                  <div className="flex max-w-full items-center gap-3 sm:gap-6">
                    <NodeBadge label={source.label || source.id} />
                    <div className="text-2xl text-indigo-400">→</div>
                    <NodeBadge label={target.label || target.id} />
                  </div>
                  {edge.label && <p className="max-w-2xl text-center text-lg text-zinc-300">{edge.label}</p>}
                </section>
              );
            })}
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
    <div className="min-w-0 break-words rounded-lg border border-indigo-500/50 bg-indigo-500/10 px-4 py-4 text-lg font-medium sm:px-6">
      {label}
    </div>
  );
}
