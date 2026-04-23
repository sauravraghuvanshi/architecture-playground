/**
 * Outline — accessibility companion: flat node list + connection summary.
 * Activating an item selects + focuses the corresponding node on the canvas.
 */
"use client";

import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { ServiceNodeData } from "./lib/types";

interface Props {
  nodes: Node[];
  edges: Edge[];
  onFocusNode: (id: string) => void;
}

export function Outline({ nodes, edges, onFocusNode }: Props) {
  const summary = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return nodes.map((n) => {
      const incoming = edges.filter((e) => e.target === n.id);
      const outgoing = edges.filter((e) => e.source === n.id);
      return {
        id: n.id,
        label: (n.data as { label?: string }).label ?? n.type,
        type: n.type,
        cloud: n.type === "service" ? (n.data as unknown as ServiceNodeData).cloud : undefined,
        incoming: incoming.map((e) => ({ id: e.id, from: byId.get(e.source)?.data })),
        outgoing: outgoing.map((e) => ({ id: e.id, to: byId.get(e.target)?.data })),
      };
    });
  }, [nodes, edges]);

  return (
    <details className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900">
        Diagram outline ({nodes.length} nodes, {edges.length} edges)
      </summary>
      <ul className="max-h-48 overflow-y-auto px-3 pb-3 text-[11px] text-zinc-700 dark:text-zinc-300">
        {summary.length === 0 && <li className="text-zinc-500">Empty diagram.</li>}
        {summary.map((s) => (
          <li key={s.id} className="border-t border-zinc-100 py-1 first:border-t-0 dark:border-zinc-900">
            <button
              type="button"
              onClick={() => onFocusNode(s.id)}
              className="block w-full text-left font-medium text-zinc-900 hover:underline dark:text-zinc-100"
            >
              {s.label || `(unnamed ${s.type})`}
              {s.cloud && <span className="ml-1 text-[9px] uppercase text-zinc-400">{s.cloud}</span>}
            </button>
            {(s.incoming.length > 0 || s.outgoing.length > 0) && (
              <p className="text-[10px] text-zinc-500">
                in {s.incoming.length} · out {s.outgoing.length}
              </p>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
