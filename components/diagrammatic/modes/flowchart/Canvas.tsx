/**
 * Flowchart / BPMN-style mode.
 *
 * Shapes:
 *  - ``startend`` (oval) — process start / end
 *  - ``process`` (rectangle) — generic action
 *  - ``decision`` (diamond) — Yes / No branching
 *  - ``io`` (parallelogram) — input or output
 *  - ``subprocess`` (double-bordered rectangle) — call to another flow
 *
 * Edges are smooth-step with optional label (e.g. "Yes" / "No" on decision
 * branches), styled as a single arrowed flow.
 */
"use client";

import { forwardRef, memo, useCallback, useImperativeHandle, useMemo, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  addEdge,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
} from "@xyflow/react";
import type { BaseCanvasHandle } from "../../shared/modeRegistry";
import { useFlowCanvas } from "../../shared/useFlowCanvas";

export type FlowShape = "startend" | "process" | "decision" | "io" | "subprocess";

export interface FlowchartPayload {
  nodes: Array<{ id: string; shape: FlowShape; label: string; x: number; y: number }>;
  edges: Array<{ id: string; from: string; to: string; label?: string }>;
}

const DEFAULT_PAYLOAD: FlowchartPayload = {
  nodes: [
    { id: "n1", shape: "startend", label: "Start", x: 360, y: 0 },
    { id: "n2", shape: "process", label: "Receive request", x: 340, y: 110 },
    { id: "n3", shape: "decision", label: "Authorized?", x: 340, y: 230 },
    { id: "n4", shape: "process", label: "Handle request", x: 140, y: 380 },
    { id: "n5", shape: "process", label: "Reject 401", x: 540, y: 380 },
    { id: "n6", shape: "startend", label: "End", x: 360, y: 510 },
  ],
  edges: [
    { id: "e1", from: "n1", to: "n2" },
    { id: "e2", from: "n2", to: "n3" },
    { id: "e3", from: "n3", to: "n4", label: "Yes" },
    { id: "e4", from: "n3", to: "n5", label: "No" },
    { id: "e5", from: "n4", to: "n6" },
    { id: "e6", from: "n5", to: "n6" },
  ],
};

interface FCData { shape: FlowShape; label: string }

const HANDLES = (
  <>
    <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" />
    <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" />
    <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" id="l" />
    <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" id="r" />
  </>
);

const ShapeNodeImpl = ({ data, selected }: NodeProps) => {
  const d = data as unknown as FCData;
  const ring = selected ? "ring-2 ring-lime-300/50" : "";
  if (d.shape === "decision") {
    return (
      <div className={`relative ${ring}`} style={{ width: 160, height: 110 }}>
        <svg viewBox="0 0 160 110" className="absolute inset-0 h-full w-full">
          <polygon points="80,4 156,55 80,106 4,55" fill="rgba(24,24,27,0.95)" stroke={selected ? "#bef264" : "#3f3f46"} strokeWidth={1.6} />
        </svg>
        <div className="absolute inset-0 grid place-items-center px-4 text-center text-[12px] font-semibold text-zinc-100">{d.label}</div>
        {HANDLES}
      </div>
    );
  }
  if (d.shape === "startend") {
    return (
      <div className={`flex h-12 w-44 items-center justify-center rounded-full border bg-zinc-900/95 px-3 text-center text-sm font-semibold text-zinc-100 shadow ${selected ? "border-lime-300" : "border-zinc-700"} ${ring}`}>
        {d.label}
        {HANDLES}
      </div>
    );
  }
  if (d.shape === "io") {
    return (
      <div className={`relative ${ring}`} style={{ width: 180, height: 60 }}>
        <svg viewBox="0 0 180 60" className="absolute inset-0 h-full w-full">
          <polygon points="20,4 176,4 160,56 4,56" fill="rgba(24,24,27,0.95)" stroke={selected ? "#bef264" : "#3f3f46"} strokeWidth={1.6} />
        </svg>
        <div className="absolute inset-0 grid place-items-center px-6 text-center text-[12px] font-semibold text-zinc-100">{d.label}</div>
        {HANDLES}
      </div>
    );
  }
  if (d.shape === "subprocess") {
    return (
      <div className={`flex h-14 w-44 items-center justify-center rounded-md border-2 bg-zinc-900/95 px-3 text-center text-sm font-semibold text-zinc-100 shadow ${selected ? "border-lime-300" : "border-zinc-700"} ${ring}`}
           style={{ boxShadow: "inset 0 0 0 3px rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.4)" }}>
        {d.label}
        {HANDLES}
      </div>
    );
  }
  return (
    <div className={`flex h-14 w-44 items-center justify-center rounded-md border bg-zinc-900/95 px-3 text-center text-sm font-semibold text-zinc-100 shadow ${selected ? "border-lime-300" : "border-zinc-700"} ${ring}`}>
      {d.label}
      {HANDLES}
    </div>
  );
};
const ShapeNode = memo(ShapeNodeImpl);
const nodeTypes = { shape: ShapeNode };

function payloadToFlow(p: FlowchartPayload): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = p.nodes.map((n) => ({
    id: n.id, type: "shape", position: { x: n.x, y: n.y }, data: { shape: n.shape, label: n.label },
  }));
  const edges: Edge[] = p.edges.map((e) => ({
    id: e.id, source: e.from, target: e.to, label: e.label,
    type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed, color: "#a1a1aa" },
    style: { stroke: "#a1a1aa", strokeWidth: 1.6 },
    labelStyle: { fill: "#e4e4e7", fontSize: 11, fontWeight: 600 },
    labelBgStyle: { fill: "#18181b", fillOpacity: 0.95 },
    labelBgPadding: [4, 4] as [number, number],
    labelBgBorderRadius: 4,
  }));
  return { nodes, edges };
}

function flowToPayload(nodes: Node[], edges: Edge[]): FlowchartPayload {
  return {
    nodes: nodes.map((n) => {
      const d = n.data as unknown as FCData;
      return { id: n.id, shape: d.shape ?? "process", label: d.label ?? "", x: n.position.x, y: n.position.y };
    }),
    edges: edges.map((e) => ({ id: e.id, from: e.source, to: e.target, label: typeof e.label === "string" ? e.label : undefined })),
  };
}

interface Props { value: FlowchartPayload; onChange?: (p: FlowchartPayload) => void; }

const Inner = forwardRef<BaseCanvasHandle, Props>(function Inner({ value, onChange }, ref) {
  const initial = useMemo(() => payloadToFlow(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const { fitView, screenToFlowPosition } = useReactFlow();
  const internalRef = useRef<BaseCanvasHandle | null>(null);
  const { onNodesChange, onEdgesChange, setNodes, setEdges, snapshot, nodes, edges } = useFlowCanvas<FlowchartPayload>({
    initial, toPayload: flowToPayload, fromPayload: payloadToFlow,
    onChange, fitView: () => fitView({ padding: 0.2, duration: 400 }), ref: internalRef,
  });
  useImperativeHandle(ref, () => internalRef.current as BaseCanvasHandle, []);

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target) return;
    snapshot();
    setEdges((eds) => addEdge({
      ...c, id: `e_${Date.now().toString(36)}`,
      type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed, color: "#a1a1aa" },
      style: { stroke: "#a1a1aa", strokeWidth: 1.6 },
    }, eds));
  }, [snapshot, setEdges]);

  // Listen for "flowchart-add-shape" events from a palette / toolbar.
  const onAddShape = useCallback((shape: FlowShape, label: string) => {
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    snapshot();
    setNodes((nds) => nds.concat({
      id: `n_${Date.now().toString(36)}`, type: "shape",
      position: { x: center.x - 80 + (Math.random() - 0.5) * 60, y: center.y - 30 + (Math.random() - 0.5) * 60 },
      data: { shape, label },
    }));
  }, [snapshot, setNodes, screenToFlowPosition]);

  useImperativeHandle(ref, () => ({
    ...(internalRef.current as BaseCanvasHandle),
    // Custom shape adder — invoked via window event from the toolbar.
  }), []);

  // Wire window events (super-light "palette") for shape addition.
  useMemo(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ shape: FlowShape; label: string }>;
      onAddShape(ce.detail.shape, ce.detail.label);
    };
    if (typeof window !== "undefined") window.addEventListener("flowchart-add-shape", handler as EventListener);
    return () => { if (typeof window !== "undefined") window.removeEventListener("flowchart-add-shape", handler as EventListener); };
  }, [onAddShape]);

  return (
    <div className="h-full w-full bg-zinc-950">
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        proOptions={{ hideAttribution: true }} fitView snapToGrid snapGrid={[12, 12]} minZoom={0.2}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#27272a" />
        <Controls className="!bg-zinc-900 !border !border-zinc-800" />
        <MiniMap pannable zoomable className="!bg-zinc-900 !border !border-zinc-800" maskColor="rgba(0,0,0,0.6)" nodeColor="#71717a" />
      </ReactFlow>
    </div>
  );
});

export const FlowchartCanvas = forwardRef<BaseCanvasHandle, Props>(function FlowchartCanvas(props, ref) {
  return <ReactFlowProvider><Inner {...props} ref={ref} /></ReactFlowProvider>;
});

export const FLOWCHART_DEFAULT_PAYLOAD = DEFAULT_PAYLOAD;
