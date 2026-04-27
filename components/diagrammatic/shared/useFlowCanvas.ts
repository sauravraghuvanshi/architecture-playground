/**
 * Shared React Flow boilerplate for Diagrammatic modes (flowchart, mindmap,
 * ER, UML, C4, sequence). Wraps:
 *
 *   - controlled-ish nodes/edges state with applyNodeChanges/applyEdgeChanges
 *   - undo/redo stacks (max 100)
 *   - debounced onChange notification
 *   - hydrate() that suppresses the next snapshot
 *   - deleteSelection()
 *
 * Architecture mode does NOT use this — it has additional concerns
 * (sequence playback, GIF recording, edge-style cycle, tier groups) and
 * carries its own more elaborate version.
 */
"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type RefObject } from "react";
import {
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import type { BaseCanvasHandle } from "./modeRegistry";

export interface UseFlowCanvasArgs<P> {
  initial: { nodes: Node[]; edges: Edge[] };
  toPayload: (nodes: Node[], edges: Edge[]) => P;
  fromPayload: (payload: P) => { nodes: Node[]; edges: Edge[] };
  onChange?: (next: P) => void;
  fitView?: () => void;
  /** Optional textual export (SQL DDL, TS, MD, …). */
  exportText?: (nodes: Node[], edges: Edge[], format: string) => string | null;
  ref: RefObject<BaseCanvasHandle | null>;
}

export interface UseFlowCanvasResult {
  nodes: Node[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  /** Push the current (nodes, edges) onto the undo stack. */
  snapshot: () => void;
}

export function useFlowCanvas<P>({
  initial,
  toPayload,
  fromPayload,
  onChange,
  fitView,
  exportText,
  ref,
}: UseFlowCanvasArgs<P>): UseFlowCanvasResult {
  const [nodes, setNodes] = useState<Node[]>(initial.nodes);
  const [edges, setEdges] = useState<Edge[]>(initial.edges);
  const past = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const future = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const skipNext = useRef(false);

  const snapshot = useCallback(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    past.current.push({ nodes, edges });
    if (past.current.length > 100) past.current.shift();
    future.current = [];
  }, [nodes, edges]);

  const notifyRef = useRef<number | null>(null);
  useEffect(() => {
    if (!onChange) return;
    if (notifyRef.current) cancelAnimationFrame(notifyRef.current);
    notifyRef.current = requestAnimationFrame(() => onChange(toPayload(nodes, edges)));
    return () => { if (notifyRef.current) cancelAnimationFrame(notifyRef.current); };
  }, [nodes, edges, onChange, toPayload]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    if (changes.some((c) => c.type === "add" || c.type === "remove")) snapshot();
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, [snapshot]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (changes.some((c) => c.type === "add" || c.type === "remove")) snapshot();
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, [snapshot]);

  useImperativeHandle(ref, () => ({
    serialize: () => toPayload(nodes, edges),
    hydrate: (p) => {
      const flow = fromPayload(p as P);
      skipNext.current = true;
      setNodes(flow.nodes);
      setEdges(flow.edges);
    },
    fit: () => fitView?.(),
    undo: () => {
      const prev = past.current.pop();
      if (!prev) return;
      future.current.push({ nodes, edges });
      skipNext.current = true;
      setNodes(prev.nodes); setEdges(prev.edges);
    },
    redo: () => {
      const next = future.current.pop();
      if (!next) return;
      past.current.push({ nodes, edges });
      skipNext.current = true;
      setNodes(next.nodes); setEdges(next.edges);
    },
    deleteSelection: () => {
      snapshot();
      setNodes((nds) => nds.filter((n) => !n.selected));
      setEdges((eds) => eds.filter((e) => !e.selected));
    },
    exportText: exportText ? (format: string) => exportText(nodes, edges, format) : undefined,
  }), [nodes, edges, fitView, snapshot, toPayload, fromPayload, exportText]);

  return { nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange, snapshot };
}
