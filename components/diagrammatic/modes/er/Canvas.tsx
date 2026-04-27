/**
 * ER Diagram mode.
 *
 * Each ``entity`` node is a table-shaped box with a header (entity name) and
 * a list of column rows: ``name : type`` with PK / FK / NULL flags.
 * Edges represent relationships and carry a cardinality (1:1, 1:N, N:M).
 *
 * Textual export: PostgreSQL-flavored ``CREATE TABLE`` DDL with primary keys
 * and foreign-key constraints inferred from edges. Column types passed
 * through verbatim.
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
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
} from "@xyflow/react";
import type { BaseCanvasHandle } from "../../shared/modeRegistry";
import { useFlowCanvas } from "../../shared/useFlowCanvas";

export type Cardinality = "1:1" | "1:N" | "N:M";

export interface ERColumn { name: string; type: string; pk?: boolean; fk?: boolean; nullable?: boolean; }
export interface ERPayload {
  entities: Array<{ id: string; name: string; columns: ERColumn[]; x: number; y: number }>;
  relationships: Array<{ id: string; from: string; to: string; cardinality: Cardinality; label?: string }>;
}

const DEFAULT_PAYLOAD: ERPayload = {
  entities: [
    { id: "user", name: "User", x: 0, y: 0, columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "email", type: "text" },
      { name: "created_at", type: "timestamptz" },
    ]},
    { id: "order", name: "Order", x: 360, y: 0, columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "user_id", type: "uuid", fk: true },
      { name: "total_cents", type: "int" },
      { name: "status", type: "text" },
    ]},
    { id: "item", name: "OrderItem", x: 720, y: 0, columns: [
      { name: "id", type: "uuid", pk: true },
      { name: "order_id", type: "uuid", fk: true },
      { name: "sku", type: "text" },
      { name: "qty", type: "int" },
    ]},
  ],
  relationships: [
    { id: "r1", from: "user", to: "order", cardinality: "1:N" },
    { id: "r2", from: "order", to: "item", cardinality: "1:N" },
  ],
};

interface EData { name: string; columns: ERColumn[] }

const EntityNodeImpl = ({ data, selected }: NodeProps) => {
  const d = data as unknown as EData;
  return (
    <div className={`min-w-[220px] overflow-hidden rounded-lg border bg-zinc-900/95 shadow-lg ${selected ? "border-lime-300 ring-2 ring-lime-300/40" : "border-zinc-700"}`}>
      <div className="flex items-center gap-2 bg-zinc-800/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-100">
        <span className="h-1.5 w-1.5 rounded-full bg-lime-300" />
        {d.name}
      </div>
      <div className="divide-y divide-zinc-800">
        {(d.columns ?? []).map((c, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-1 text-[11px]">
            {c.pk ? <span className="rounded bg-amber-300 px-1 text-[8px] font-bold text-zinc-950">PK</span>
              : c.fk ? <span className="rounded bg-sky-400 px-1 text-[8px] font-bold text-zinc-950">FK</span>
              : <span className="w-4" />}
            <span className="font-mono text-zinc-100">{c.name}</span>
            <span className="ml-auto font-mono text-[10px] text-zinc-500">{c.type}{c.nullable ? "?" : ""}</span>
          </div>
        ))}
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" />
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" />
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" id="b" />
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" id="t" />
    </div>
  );
};
const EntityNode = memo(EntityNodeImpl);
const nodeTypes = { entity: EntityNode };

function payloadToFlow(p: ERPayload): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: p.entities.map((e) => ({
      id: e.id, type: "entity", position: { x: e.x, y: e.y },
      data: { name: e.name, columns: e.columns },
    })),
    edges: p.relationships.map((r) => ({
      id: r.id, source: r.from, target: r.to, type: "smoothstep",
      label: r.label ?? r.cardinality,
      style: { stroke: "#a1a1aa", strokeWidth: 1.6 },
      labelStyle: { fill: "#e4e4e7", fontSize: 11, fontWeight: 600 },
      labelBgStyle: { fill: "#18181b", fillOpacity: 0.95 },
      labelBgPadding: [4, 4] as [number, number], labelBgBorderRadius: 4,
      data: { cardinality: r.cardinality },
    })),
  };
}

function flowToPayload(nodes: Node[], edges: Edge[]): ERPayload {
  return {
    entities: nodes.map((n) => {
      const d = n.data as unknown as EData;
      return { id: n.id, name: d.name ?? "Entity", columns: d.columns ?? [], x: n.position.x, y: n.position.y };
    }),
    relationships: edges.map((e) => {
      const c = ((e.data as { cardinality?: Cardinality } | undefined)?.cardinality ?? "1:N");
      return { id: e.id, from: e.source, to: e.target, cardinality: c, label: typeof e.label === "string" ? e.label : undefined };
    }),
  };
}

function exportSqlDdl(payload: ERPayload): string {
  const lines: string[] = ["-- Generated by Diagrammatic — PostgreSQL DDL", ""];
  for (const ent of payload.entities) {
    lines.push(`CREATE TABLE ${ent.name.toLowerCase()} (`);
    const cols = ent.columns.map((c) => {
      const parts = [`  ${c.name}`, c.type];
      if (c.pk) parts.push("PRIMARY KEY");
      if (!c.nullable && !c.pk) parts.push("NOT NULL");
      return parts.join(" ");
    });
    lines.push(cols.join(",\n"));
    // FK constraints inferred from relationships ending at this entity
    const fks = payload.relationships.filter((r) => r.to === ent.id);
    for (const fk of fks) {
      const parent = payload.entities.find((e) => e.id === fk.from);
      const fkCol = ent.columns.find((c) => c.name === `${parent?.name?.toLowerCase()}_id`);
      if (parent && fkCol) {
        lines.push(`  ,FOREIGN KEY (${fkCol.name}) REFERENCES ${parent.name.toLowerCase()}(id)`);
      }
    }
    lines.push(");", "");
  }
  return lines.join("\n");
}

interface Props { value: ERPayload; onChange?: (p: ERPayload) => void; }

const Inner = forwardRef<BaseCanvasHandle, Props>(function Inner({ value, onChange }, ref) {
  const initial = useMemo(() => payloadToFlow(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const { fitView } = useReactFlow();
  const innerRef = useRef<BaseCanvasHandle | null>(null);
  const exportText = useCallback((nodes: Node[], edges: Edge[], format: string) => {
    if (format === "sql") return exportSqlDdl(flowToPayload(nodes, edges));
    return null;
  }, []);
  const { onNodesChange, onEdgesChange, setEdges, snapshot, nodes, edges } = useFlowCanvas<ERPayload>({
    initial, toPayload: flowToPayload, fromPayload: payloadToFlow,
    onChange, fitView: () => fitView({ padding: 0.2, duration: 400 }),
    exportText, ref: innerRef,
  });
  useImperativeHandle(ref, () => innerRef.current as BaseCanvasHandle, []);

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target) return;
    snapshot();
    setEdges((eds) => addEdge({
      ...c, id: `r_${Date.now().toString(36)}`, type: "smoothstep",
      label: "1:N", style: { stroke: "#a1a1aa", strokeWidth: 1.6 },
      labelStyle: { fill: "#e4e4e7", fontSize: 11, fontWeight: 600 },
      labelBgStyle: { fill: "#18181b", fillOpacity: 0.95 },
      data: { cardinality: "1:N" as Cardinality },
    }, eds));
  }, [snapshot, setEdges]);

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

export const ERCanvas = forwardRef<BaseCanvasHandle, Props>(function ERCanvas(props, ref) {
  return <ReactFlowProvider><Inner {...props} ref={ref} /></ReactFlowProvider>;
});

export const ER_DEFAULT_PAYLOAD = DEFAULT_PAYLOAD;
