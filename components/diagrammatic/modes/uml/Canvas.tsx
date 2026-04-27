/**
 * UML class mode.
 *
 * Each node is a 3-section box: name (with optional «stereotype»),
 * fields, methods. Edges represent inheritance / implementation /
 * composition / association.
 *
 * Textual export: TypeScript. ``«interface»`` stereotype emits an
 * ``interface``; otherwise a ``class``. Methods emit signatures with their
 * declared return type. Fields emit typed properties.
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
  addEdge,
  MarkerType,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
} from "@xyflow/react";
import type { BaseCanvasHandle } from "../../shared/modeRegistry";
import { useFlowCanvas } from "../../shared/useFlowCanvas";

export type UMLEdgeKind = "inheritance" | "implementation" | "composition" | "association";

export interface UMLField { name: string; type: string; visibility?: "+" | "-" | "#"; }
export interface UMLMethod { name: string; returns: string; params?: string; visibility?: "+" | "-" | "#"; }

export interface UMLPayload {
  classes: Array<{
    id: string;
    name: string;
    stereotype?: string;
    fields: UMLField[];
    methods: UMLMethod[];
    x: number;
    y: number;
  }>;
  relations: Array<{ id: string; from: string; to: string; kind: UMLEdgeKind }>;
}

const DEFAULT_PAYLOAD: UMLPayload = {
  classes: [
    { id: "Animal", name: "Animal", x: 0, y: 0,
      fields: [{ name: "name", type: "string", visibility: "+" }, { name: "age", type: "number", visibility: "+" }],
      methods: [{ name: "speak", returns: "void", visibility: "+" }] },
    { id: "Dog", name: "Dog", x: -200, y: 220,
      fields: [{ name: "breed", type: "string", visibility: "+" }],
      methods: [{ name: "fetch", returns: "void", visibility: "+" }] },
    { id: "Cat", name: "Cat", x: 200, y: 220,
      fields: [{ name: "indoor", type: "boolean", visibility: "+" }],
      methods: [{ name: "purr", returns: "void", visibility: "+" }] },
    { id: "Trainable", name: "Trainable", stereotype: "interface", x: -440, y: 0,
      fields: [], methods: [{ name: "train", returns: "void", params: "cmd: string", visibility: "+" }] },
  ],
  relations: [
    { id: "r1", from: "Dog", to: "Animal", kind: "inheritance" },
    { id: "r2", from: "Cat", to: "Animal", kind: "inheritance" },
    { id: "r3", from: "Dog", to: "Trainable", kind: "implementation" },
  ],
};

interface CData {
  name: string; stereotype?: string;
  fields: UMLField[]; methods: UMLMethod[];
}

const HANDLES = (
  <>
    <Handle type="source" position={Position.Top} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" id="t" />
    <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" id="tT" />
    <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" id="b" />
    <Handle type="target" position={Position.Bottom} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" id="bT" />
    <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" id="r" />
    <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" id="l" />
  </>
);

const ClassNodeImpl = ({ data, selected }: NodeProps) => {
  const d = data as unknown as CData;
  return (
    <div className={`min-w-[240px] overflow-hidden rounded-md border bg-zinc-900/95 shadow-lg ${selected ? "border-lime-300 ring-2 ring-lime-300/40" : "border-zinc-700"}`}>
      <div className="bg-zinc-800/80 px-3 py-2 text-center">
        {d.stereotype && <div className="text-[10px] italic text-zinc-400">«{d.stereotype}»</div>}
        <div className="text-sm font-bold text-zinc-100">{d.name}</div>
      </div>
      <div className="border-t border-zinc-700 px-3 py-1.5 text-[11px] font-mono">
        {d.fields.length === 0 && <div className="text-zinc-600">—</div>}
        {d.fields.map((f, i) => (
          <div key={i} className="text-zinc-200">
            <span className="text-zinc-500">{f.visibility ?? "+"}</span> {f.name}: <span className="text-lime-300">{f.type}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-700 px-3 py-1.5 text-[11px] font-mono">
        {d.methods.length === 0 && <div className="text-zinc-600">—</div>}
        {d.methods.map((m, i) => (
          <div key={i} className="text-zinc-200">
            <span className="text-zinc-500">{m.visibility ?? "+"}</span> {m.name}({m.params ?? ""}): <span className="text-sky-300">{m.returns}</span>
          </div>
        ))}
      </div>
      {HANDLES}
    </div>
  );
};
const ClassNode = memo(ClassNodeImpl);
const nodeTypes = { uml: ClassNode };

function edgeStyleFor(kind: UMLEdgeKind): Edge {
  const base = { type: "smoothstep" as const, style: { stroke: "#a1a1aa", strokeWidth: 1.6 }, label: "" };
  if (kind === "inheritance")
    return { ...base, id: "", source: "", target: "", markerEnd: { type: MarkerType.ArrowClosed, color: "#a1a1aa" }, label: "extends" };
  if (kind === "implementation")
    return { ...base, id: "", source: "", target: "", markerEnd: { type: MarkerType.ArrowClosed, color: "#a1a1aa" }, style: { stroke: "#a1a1aa", strokeWidth: 1.6, strokeDasharray: "6 4" }, label: "implements" };
  if (kind === "composition")
    return { ...base, id: "", source: "", target: "", markerStart: { type: MarkerType.Arrow, color: "#a1a1aa", width: 16, height: 16 } as unknown as Edge["markerStart"], label: "owns" };
  return { ...base, id: "", source: "", target: "", markerEnd: { type: MarkerType.Arrow, color: "#a1a1aa" }, label: "uses" };
}

function payloadToFlow(p: UMLPayload): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: p.classes.map((c) => ({
      id: c.id, type: "uml", position: { x: c.x, y: c.y },
      data: { name: c.name, stereotype: c.stereotype, fields: c.fields, methods: c.methods },
    })),
    edges: p.relations.map((r) => {
      const tmpl = edgeStyleFor(r.kind);
      return { ...tmpl, id: r.id, source: r.from, target: r.to,
        labelStyle: { fill: "#e4e4e7", fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: "#18181b", fillOpacity: 0.95 },
        labelBgPadding: [4, 4] as [number, number], labelBgBorderRadius: 4,
        data: { kind: r.kind },
      };
    }),
  };
}

function flowToPayload(nodes: Node[], edges: Edge[]): UMLPayload {
  return {
    classes: nodes.map((n) => {
      const d = n.data as unknown as CData;
      return { id: n.id, name: d.name ?? n.id, stereotype: d.stereotype, fields: d.fields ?? [], methods: d.methods ?? [], x: n.position.x, y: n.position.y };
    }),
    relations: edges.map((e) => ({ id: e.id, from: e.source, to: e.target, kind: ((e.data as { kind?: UMLEdgeKind } | undefined)?.kind ?? "association") })),
  };
}

function exportTypeScript(p: UMLPayload): string {
  const lines: string[] = ["// Generated by Diagrammatic — TypeScript", ""];
  // Build inheritance/implementation maps.
  const extendsMap = new Map<string, string>();
  const implementsMap = new Map<string, string[]>();
  for (const r of p.relations) {
    if (r.kind === "inheritance") extendsMap.set(r.from, r.to);
    if (r.kind === "implementation") {
      const arr = implementsMap.get(r.from) ?? [];
      arr.push(r.to);
      implementsMap.set(r.from, arr);
    }
  }
  for (const c of p.classes) {
    if (c.stereotype === "interface") {
      lines.push(`export interface ${c.name} {`);
      for (const f of c.fields) lines.push(`  ${f.name}: ${f.type};`);
      for (const m of c.methods) lines.push(`  ${m.name}(${m.params ?? ""}): ${m.returns};`);
      lines.push("}", "");
    } else {
      const ext = extendsMap.get(c.id);
      const imps = implementsMap.get(c.id) ?? [];
      let head = `export class ${c.name}`;
      if (ext) head += ` extends ${ext}`;
      if (imps.length) head += ` implements ${imps.join(", ")}`;
      lines.push(`${head} {`);
      for (const f of c.fields) lines.push(`  ${f.visibility === "-" ? "private " : f.visibility === "#" ? "protected " : ""}${f.name}: ${f.type};`);
      for (const m of c.methods) {
        const vis = m.visibility === "-" ? "private " : m.visibility === "#" ? "protected " : "";
        lines.push(`  ${vis}${m.name}(${m.params ?? ""}): ${m.returns} { /* TODO */ throw new Error("not implemented"); }`);
      }
      lines.push("}", "");
    }
  }
  return lines.join("\n");
}

interface Props { value: UMLPayload; onChange?: (p: UMLPayload) => void; }

const Inner = forwardRef<BaseCanvasHandle, Props>(function Inner({ value, onChange }, ref) {
  const initial = useMemo(() => payloadToFlow(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const { fitView } = useReactFlow();
  const innerRef = useRef<BaseCanvasHandle | null>(null);
  const exportText = useCallback((nodes: Node[], edges: Edge[], format: string) => {
    if (format === "ts") return exportTypeScript(flowToPayload(nodes, edges));
    return null;
  }, []);
  const { onNodesChange, onEdgesChange, setEdges, snapshot, nodes, edges } = useFlowCanvas<UMLPayload>({
    initial, toPayload: flowToPayload, fromPayload: payloadToFlow,
    onChange, fitView: () => fitView({ padding: 0.2, duration: 400 }),
    exportText, ref: innerRef,
  });
  useImperativeHandle(ref, () => innerRef.current as BaseCanvasHandle, []);

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target) return;
    snapshot();
    const tmpl = edgeStyleFor("association");
    setEdges((eds) => addEdge({ ...tmpl, ...c, id: `r_${Date.now().toString(36)}`,
      labelStyle: { fill: "#e4e4e7", fontSize: 10, fontWeight: 600 },
      labelBgStyle: { fill: "#18181b", fillOpacity: 0.95 },
      data: { kind: "association" as UMLEdgeKind } }, eds));
  }, [snapshot, setEdges]);

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

export const UMLCanvas = forwardRef<BaseCanvasHandle, Props>(function UMLCanvas(props, ref) {
  return <ReactFlowProvider><Inner {...props} ref={ref} /></ReactFlowProvider>;
});

export const UML_DEFAULT_PAYLOAD = DEFAULT_PAYLOAD;
