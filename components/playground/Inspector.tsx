/**
 * Inspector — edits the currently selected node or edge.
 * Updates flow back to the parent via callbacks; parent handles history push.
 */
"use client";

import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { GroupNodeData, ServiceNodeData, StickyNodeData } from "./lib/types";
import { usePlaygroundUI } from "./PlaygroundUIContext";

interface Props {
  nodes: Node[];
  edges: Edge[];
  onUpdateNode: (id: string, patch: Partial<Node>) => void;
  onUpdateEdge: (id: string, patch: Partial<Edge>) => void;
  onDeleteSelected: () => void;
}

export function Inspector({ nodes, edges, onUpdateNode, onUpdateEdge, onDeleteSelected }: Props) {
  const { selectedNodeIds, selectedEdgeIds } = usePlaygroundUI();
  const selectedNode = useMemo(
    () => (selectedNodeIds.length === 1 ? nodes.find((n) => n.id === selectedNodeIds[0]) : null),
    [nodes, selectedNodeIds]
  );
  const selectedEdge = useMemo(
    () => (selectedEdgeIds.length === 1 ? edges.find((e) => e.id === selectedEdgeIds[0]) : null),
    [edges, selectedEdgeIds]
  );

  if (!selectedNode && !selectedEdge) {
    return (
      <aside className="hidden h-full w-64 flex-col border-l border-zinc-200 bg-white p-4 text-xs text-zinc-500 lg:flex dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Inspector</h2>
        <p>Select a node or edge to edit its properties.</p>
        <div className="mt-6 space-y-1.5 rounded-md bg-zinc-50 p-3 text-[11px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          <p className="font-medium text-zinc-900 dark:text-zinc-200">Tips</p>
          <p>• Drag from the palette to place a service.</p>
          <p>• Drag a connection from one handle to another.</p>
          <p>• Set edge <span className="font-mono">step</span> numbers to define a sequence and press Play.</p>
          <p>• Drop a node onto a Group container to nest it.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden h-full w-64 flex-col gap-4 overflow-y-auto border-l border-zinc-200 bg-white p-4 lg:flex dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Inspector</h2>

      {selectedNode && (
        <div className="space-y-3">
          <Field label="Label">
            <input
              type="text"
              maxLength={200}
              value={(selectedNode.data as { label?: string }).label ?? ""}
              onChange={(e) =>
                onUpdateNode(selectedNode.id, { data: { ...selectedNode.data, label: e.target.value } })
              }
              className={inputCls}
            />
          </Field>

          {selectedNode.type === "group" && (
            <Field label="Variant">
              <select
                value={(selectedNode.data as unknown as GroupNodeData).variant}
                onChange={(e) =>
                  onUpdateNode(selectedNode.id, {
                    data: { ...selectedNode.data, variant: e.target.value as GroupNodeData["variant"] },
                  })
                }
                className={inputCls}
              >
                <option value="vpc">VPC</option>
                <option value="resource-group">Resource Group</option>
                <option value="project">GCP Project</option>
                <option value="subnet">Subnet</option>
                <option value="region">Region</option>
                <option value="custom">Custom</option>
              </select>
            </Field>
          )}

          {selectedNode.type === "sticky" && (
            <Field label="Color">
              <input
                type="color"
                value={(selectedNode.data as unknown as StickyNodeData).color ?? "#fef9c3"}
                onChange={(e) =>
                  onUpdateNode(selectedNode.id, { data: { ...selectedNode.data, color: e.target.value } })
                }
                className="h-8 w-full rounded border border-zinc-200 dark:border-zinc-700"
              />
            </Field>
          )}

          {selectedNode.type === "service" && (
            <p className="rounded-md bg-zinc-50 p-2 text-[10px] text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              Service: <span className="font-mono">{(selectedNode.data as unknown as ServiceNodeData).iconId}</span>
            </p>
          )}

          <button onClick={onDeleteSelected} className={dangerBtn}>Delete node</button>
        </div>
      )}

      {selectedEdge && (
        <div className="space-y-3">
          <Field label="Label">
            <input
              type="text"
              maxLength={200}
              value={(selectedEdge.data as { label?: string })?.label ?? ""}
              onChange={(e) =>
                onUpdateEdge(selectedEdge.id, {
                  data: { ...(selectedEdge.data ?? {}), label: e.target.value },
                })
              }
              className={inputCls}
              placeholder="e.g. HTTP request"
            />
          </Field>
          <Field label="Sequence step (1–100)">
            <input
              type="number"
              min={1}
              max={100}
              value={(selectedEdge.data as { step?: number })?.step ?? ""}
              onChange={(e) => {
                const v = e.target.value === "" ? undefined : Math.max(1, Math.min(100, Number(e.target.value)));
                onUpdateEdge(selectedEdge.id, {
                  data: { ...(selectedEdge.data ?? {}), step: v },
                });
              }}
              className={inputCls}
              placeholder="leave blank to exclude"
            />
          </Field>
          <Field label="Color">
            <input
              type="color"
              value={(selectedEdge.data as { color?: string })?.color ?? "#64748b"}
              onChange={(e) =>
                onUpdateEdge(selectedEdge.id, {
                  data: { ...(selectedEdge.data ?? {}), color: e.target.value },
                })
              }
              className="h-8 w-full rounded border border-zinc-200 dark:border-zinc-700"
            />
          </Field>
          <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={Boolean((selectedEdge.data as { animated?: boolean })?.animated)}
              onChange={(e) =>
                onUpdateEdge(selectedEdge.id, {
                  data: { ...(selectedEdge.data ?? {}), animated: e.target.checked },
                })
              }
              className="rounded border-zinc-300"
            />
            Always animate (marching dashes)
          </label>
          <button onClick={onDeleteSelected} className={dangerBtn}>Delete edge</button>
        </div>
      )}
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

const dangerBtn =
  "w-full rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950";
