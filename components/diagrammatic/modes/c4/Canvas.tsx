/**
 * C4 / System mode.
 *
 * Renders C4-model nodes (Person, Software System, Container, Component) on a
 * React Flow canvas. The C4 level (Context / Container / Component) is purely
 * a UI hint today — a future enhancement could filter nodes by level.
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

export type C4Kind = "person" | "system" | "container" | "component";

export interface C4Payload {
  nodes: Array<{ id: string; kind: C4Kind; name: string; description?: string; tech?: string; external?: boolean; x: number; y: number }>;
  edges: Array<{ id: string; from: string; to: string; label?: string; tech?: string }>;
}

const DEFAULT_PAYLOAD: C4Payload = {
  nodes: [
    { id: "user", kind: "person", name: "Customer", description: "Buys books", x: 0, y: 0 },
    { id: "web", kind: "container", name: "Web App", description: "Lists books, accepts orders", tech: "Next.js", x: 280, y: 0 },
    { id: "api", kind: "container", name: "API", description: "REST + auth", tech: "FastAPI", x: 560, y: 0 },
    { id: "db", kind: "container", name: "Database", description: "Catalog + orders", tech: "PostgreSQL", x: 840, y: 0 },
    { id: "stripe", kind: "system", name: "Stripe", description: "Payments", external: true, x: 560, y: 220 },
  ],
  edges: [
    { id: "e1", from: "user", to: "web", label: "Visits", tech: "HTTPS" },
    { id: "e2", from: "web", to: "api", label: "Reads / writes", tech: "JSON / HTTPS" },
    { id: "e3", from: "api", to: "db", label: "SQL", tech: "TCP" },
    { id: "e4", from: "api", to: "stripe", label: "Charges", tech: "HTTPS" },
  ],
};

interface CData { kind: C4Kind; name: string; description?: string; tech?: string; external?: boolean }

const STYLES: Record<C4Kind, { bg: string; border: string; label: string }> = {
  person:    { bg: "bg-zinc-800",  border: "border-zinc-600", label: "Person" },
  system:    { bg: "bg-sky-900/70",   border: "border-sky-500", label: "Software System" },
  container: { bg: "bg-emerald-900/60",border: "border-emerald-500", label: "Container" },
  component: { bg: "bg-amber-900/60", border: "border-amber-500", label: "Component" },
};

const HANDLES = (
  <>
    <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" />
    <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" />
    <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" id="b" />
    <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" id="t" />
  </>
);

const C4NodeImpl = ({ data, selected }: NodeProps) => {
  const d = data as unknown as CData;
  const s = STYLES[d.kind];
  if (d.kind === "person") {
    return (
      <div className={`flex w-44 flex-col items-center rounded-md border ${s.border} ${s.bg} px-3 py-2 text-center shadow ${selected ? "ring-2 ring-lime-300/50" : ""}`}>
        <div className="grid h-8 w-8 place-items-center rounded-full border border-zinc-500 bg-zinc-700 text-xs">👤</div>
        <div className="mt-1 text-[12px] font-bold text-zinc-100">{d.name}</div>
        {d.description && <div className="mt-0.5 text-[10px] text-zinc-300">{d.description}</div>}
        {HANDLES}
      </div>
    );
  }
  return (
    <div className={`w-52 rounded-md border ${s.border} ${s.bg} px-3 py-2 shadow ${selected ? "ring-2 ring-lime-300/50" : ""}`}>
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-300">
        <span>{`«${d.external ? "external " : ""}${s.label}»`}</span>
      </div>
      <div className="mt-1 text-[13px] font-bold text-zinc-100">{d.name}</div>
      {d.tech && <div className="mt-0.5 text-[10px] font-mono text-lime-300">[{d.tech}]</div>}
      {d.description && <div className="mt-1 text-[11px] text-zinc-300">{d.description}</div>}
      {HANDLES}
    </div>
  );
};
const C4Node = memo(C4NodeImpl);
const nodeTypes = { c4: C4Node };

function payloadToFlow(p: C4Payload): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: p.nodes.map((n) => ({
      id: n.id, type: "c4", position: { x: n.x, y: n.y },
      data: { kind: n.kind, name: n.name, description: n.description, tech: n.tech, external: n.external },
    })),
    edges: p.edges.map((e) => ({
      id: e.id, source: e.from, target: e.to, type: "smoothstep",
      label: e.tech ? `${e.label ?? ""} [${e.tech}]` : e.label,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#a1a1aa" },
      style: { stroke: "#a1a1aa", strokeWidth: 1.6 },
      labelStyle: { fill: "#e4e4e7", fontSize: 10, fontWeight: 600 },
      labelBgStyle: { fill: "#18181b", fillOpacity: 0.95 },
      labelBgPadding: [4, 4] as [number, number], labelBgBorderRadius: 4,
      data: { tech: e.tech },
    })),
  };
}

function flowToPayload(nodes: Node[], edges: Edge[]): C4Payload {
  return {
    nodes: nodes.map((n) => {
      const d = n.data as unknown as CData;
      return { id: n.id, kind: d.kind ?? "container", name: d.name ?? n.id, description: d.description, tech: d.tech, external: d.external, x: n.position.x, y: n.position.y };
    }),
    edges: edges.map((e) => ({
      id: e.id, from: e.source, to: e.target,
      label: typeof e.label === "string" ? e.label : undefined,
      tech: (e.data as { tech?: string } | undefined)?.tech,
    })),
  };
}

interface Props { value: C4Payload; onChange?: (p: C4Payload) => void; }

const Inner = forwardRef<BaseCanvasHandle, Props>(function Inner({ value, onChange }, ref) {
  const initial = useMemo(() => payloadToFlow(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const { fitView, screenToFlowPosition } = useReactFlow();
  const innerRef = useRef<BaseCanvasHandle | null>(null);
  const { onNodesChange, onEdgesChange, setNodes, setEdges, snapshot, nodes, edges } = useFlowCanvas<C4Payload>({
    initial, toPayload: flowToPayload, fromPayload: payloadToFlow,
    onChange, fitView: () => fitView({ padding: 0.2, duration: 400 }), ref: innerRef,
  });
  useImperativeHandle(ref, () => innerRef.current as BaseCanvasHandle, []);

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target) return;
    snapshot();
    setEdges((eds) => addEdge({
      ...c, id: `e_${Date.now().toString(36)}`, type: "smoothstep",
      label: "Uses", markerEnd: { type: MarkerType.ArrowClosed, color: "#a1a1aa" },
      style: { stroke: "#a1a1aa", strokeWidth: 1.6 },
    }, eds));
  }, [snapshot, setEdges]);

  // BuilderPalette: add Person / System / Container / Component at viewport center.
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ kind?: C4Kind }>;
      const kind = (ce.detail?.kind ?? "container") as C4Kind;
      const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      const id = `n_${Date.now().toString(36)}`;
      const NAMES: Record<C4Kind, string> = {
        person: "User", system: "External System", container: "New Container", component: "New Component",
      };
      snapshot();
      setNodes((nds) => nds.concat({
        id, type: "c4",
        position: { x: center.x - 100, y: center.y - 40 },
        data: { kind, name: NAMES[kind], description: "", tech: "", external: kind === "system" },
      }));
    };
    window.addEventListener("c4-add-node", handler as EventListener);
    return () => window.removeEventListener("c4-add-node", handler as EventListener);
  }, [snapshot, setNodes, screenToFlowPosition]);

  return (
    <div className="h-full w-full bg-zinc-950">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        proOptions={{ hideAttribution: true }} fitView minZoom={0.2}>
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#27272a" />
        <Controls className="!bg-zinc-900 !border !border-zinc-800" />
        <MiniMap pannable zoomable className="!bg-zinc-900 !border !border-zinc-800" maskColor="rgba(0,0,0,0.6)" nodeColor="#71717a" />
      </ReactFlow>
    </div>
  );
});

export const C4Canvas = forwardRef<BaseCanvasHandle, Props>(function C4Canvas(props, ref) {
  return <ReactFlowProvider><Inner {...props} ref={ref} /></ReactFlowProvider>;
});

export const C4_DEFAULT_PAYLOAD = DEFAULT_PAYLOAD;
