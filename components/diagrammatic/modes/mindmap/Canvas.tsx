/**
 * Mind map mode.
 *
 * A simple radial tree: one root in the center, children laid out around it
 * by polar coordinates, sub-children follow the same scheme outward. Adding
 * a child uses the selected node as the parent and inserts at a free angle.
 *
 * Each node carries a ``color`` index (0-4) → one of 5 themed palettes.
 */
"use client";

import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
} from "@xyflow/react";
import type { BaseCanvasHandle } from "../../shared/modeRegistry";
import { useFlowCanvas } from "../../shared/useFlowCanvas";

const COLORS = [
  { bg: "bg-lime-300", text: "text-zinc-950", ring: "ring-lime-300" },
  { bg: "bg-sky-400", text: "text-zinc-950", ring: "ring-sky-400" },
  { bg: "bg-fuchsia-400", text: "text-zinc-950", ring: "ring-fuchsia-400" },
  { bg: "bg-amber-300", text: "text-zinc-950", ring: "ring-amber-300" },
  { bg: "bg-emerald-400", text: "text-zinc-950", ring: "ring-emerald-400" },
] as const;

export interface MindMapPayload {
  nodes: Array<{ id: string; label: string; x: number; y: number; color: number; isRoot?: boolean }>;
  edges: Array<{ id: string; from: string; to: string }>;
}

const DEFAULT_PAYLOAD: MindMapPayload = {
  nodes: [
    { id: "root", label: "Product strategy", x: 0, y: 0, color: 0, isRoot: true },
    { id: "c1", label: "Discovery", x: -260, y: -160, color: 1 },
    { id: "c2", label: "Roadmap", x: 260, y: -160, color: 2 },
    { id: "c3", label: "Metrics", x: -260, y: 160, color: 3 },
    { id: "c4", label: "Launch plan", x: 260, y: 160, color: 4 },
    { id: "c5", label: "User research", x: -480, y: -260, color: 1 },
    { id: "c6", label: "OKRs", x: 480, y: -260, color: 2 },
  ],
  edges: [
    { id: "e1", from: "root", to: "c1" }, { id: "e2", from: "root", to: "c2" },
    { id: "e3", from: "root", to: "c3" }, { id: "e4", from: "root", to: "c4" },
    { id: "e5", from: "c1", to: "c5" }, { id: "e6", from: "c2", to: "c6" },
  ],
};

interface MMData { label: string; color: number; isRoot?: boolean }

const HANDLES = (
  <>
    <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-zinc-300 !border-zinc-950" id="l" />
    <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-zinc-300 !border-zinc-950" id="r" />
    <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-zinc-300 !border-zinc-950" id="t" />
    <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-zinc-300 !border-zinc-950" id="b" />
  </>
);

const MindNodeImpl = ({ data, selected }: NodeProps) => {
  const d = data as unknown as MMData;
  const c = COLORS[d.color % COLORS.length];
  const size = d.isRoot ? "px-5 py-3 text-sm font-bold" : "px-4 py-2 text-[13px] font-semibold";
  return (
    <div className={`rounded-full shadow ${c.bg} ${c.text} ${size} ${selected ? `ring-2 ${c.ring}` : ""}`}>
      {d.label}
      {HANDLES}
    </div>
  );
};
const MindNode = memo(MindNodeImpl);
const nodeTypes = { mind: MindNode };

function payloadToFlow(p: MindMapPayload): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: p.nodes.map((n) => ({
      id: n.id, type: "mind", position: { x: n.x, y: n.y },
      data: { label: n.label, color: n.color, isRoot: n.isRoot },
    })),
    edges: p.edges.map((e) => ({
      id: e.id, source: e.from, target: e.to, type: "default",
      style: { stroke: "#52525b", strokeWidth: 2 },
    })),
  };
}

function flowToPayload(nodes: Node[], edges: Edge[]): MindMapPayload {
  return {
    nodes: nodes.map((n) => {
      const d = n.data as unknown as MMData;
      return { id: n.id, label: d.label ?? "", x: n.position.x, y: n.position.y, color: d.color ?? 0, isRoot: d.isRoot };
    }),
    edges: edges.map((e) => ({ id: e.id, from: e.source, to: e.target })),
  };
}

interface Props { value: MindMapPayload; onChange?: (p: MindMapPayload) => void; }

const Inner = forwardRef<BaseCanvasHandle, Props>(function Inner({ value, onChange }, ref) {
  const initial = useMemo(() => payloadToFlow(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const { fitView } = useReactFlow();
  const innerRef = useRef<BaseCanvasHandle | null>(null);
  const { onNodesChange, onEdgesChange, setEdges, setNodes, snapshot, nodes, edges } = useFlowCanvas<MindMapPayload>({
    initial, toPayload: flowToPayload, fromPayload: payloadToFlow,
    onChange, fitView: () => fitView({ padding: 0.2, duration: 400 }), ref: innerRef,
  });
  useImperativeHandle(ref, () => innerRef.current as BaseCanvasHandle, []);

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target) return;
    snapshot();
    setEdges((eds) => addEdge({ ...c, id: `e_${Date.now().toString(36)}`, type: "default", style: { stroke: "#52525b", strokeWidth: 2 } }, eds));
  }, [snapshot, setEdges]);

  // Add child of currently-selected node at a fresh angle.
  // If no parent is provided and no nodes exist, seeds a root at (0, 0).
  const onAddNode = useCallback((kind: "root" | "child") => {
    const id = `n_${Date.now().toString(36)}`;
    if (kind === "root" || nodes.length === 0) {
      snapshot();
      setNodes((nds) => nds.concat({
        id, type: "mind",
        position: { x: 0, y: 0 },
        data: { label: "Topic", color: 0, isRoot: nds.length === 0 },
      }));
      return;
    }
    const parent = nodes.find((n) => n.selected) ?? nodes[0];
    const px = parent.position.x;
    const py = parent.position.y;
    const angle = Math.random() * Math.PI * 2;
    const r = 200;
    snapshot();
    setNodes((nds) => nds.concat({
      id, type: "mind",
      position: { x: px + Math.cos(angle) * r, y: py + Math.sin(angle) * r },
      data: { label: "Idea", color: ((parent.data as unknown as MMData).color + 1) % COLORS.length },
    }));
    setEdges((eds) => eds.concat({ id: `e_${id}`, source: parent.id, target: id, type: "default", style: { stroke: "#52525b", strokeWidth: 2 } }));
  }, [nodes, snapshot, setNodes, setEdges]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ kind?: "root" | "child" }>;
      onAddNode(ce.detail?.kind === "root" ? "root" : "child");
    };
    // New event name from BuilderPalette + legacy alias for back-compat.
    window.addEventListener("mindmap-add-node", handler as EventListener);
    window.addEventListener("mindmap-add-child", handler as EventListener);
    return () => {
      window.removeEventListener("mindmap-add-node", handler as EventListener);
      window.removeEventListener("mindmap-add-child", handler as EventListener);
    };
  }, [onAddNode]);

  return (
    <div className="h-full w-full bg-zinc-950">
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        proOptions={{ hideAttribution: true }} fitView minZoom={0.2}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#27272a" />
        <Controls className="!bg-zinc-900 !border !border-zinc-800" />
        <MiniMap pannable zoomable className="!bg-zinc-900 !border !border-zinc-800" maskColor="rgba(0,0,0,0.6)" nodeColor="#71717a" />
      </ReactFlow>
    </div>
  );
});

export const MindMapCanvas = forwardRef<BaseCanvasHandle, Props>(function MindMapCanvas(props, ref) {
  return <ReactFlowProvider><Inner {...props} ref={ref} /></ReactFlowProvider>;
});

export const MINDMAP_DEFAULT_PAYLOAD = DEFAULT_PAYLOAD;
