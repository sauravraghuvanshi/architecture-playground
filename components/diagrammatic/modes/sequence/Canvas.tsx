/**
 * Sequence Diagram mode.
 *
 * Shape:
 *  - ``participant`` nodes: a header box with a long vertical "lifeline"
 *    rendered below. Participants are arranged in a row at y ≈ 0.
 *  - ``message`` edges: horizontal arrows between two participants at a
 *    specific row index. The custom edge component ignores the default
 *    sourceY/targetY (which would land at the bottom of the participant box)
 *    and instead computes Y = ``HEADER_H + row * ROW_H``.
 *
 * Edge variants (cycled via the toolbar): ``sync`` (solid arrow), ``async``
 * (dashed open arrow), ``return`` (dashed line, no arrow head).
 */
"use client";

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  useReactFlow,
  type Node,
  type Edge,
  type EdgeProps,
  type NodeProps,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import type { BaseCanvasHandle } from "../../shared/modeRegistry";

const PARTICIPANT_W = 160;
const PARTICIPANT_GAP = 80;
const HEADER_H = 56;
const LIFELINE_H = 1400;
const ROW_H = 56;
const ROW_OFFSET_Y = 80;

export type SequenceMessageKind = "sync" | "async" | "return";

export interface SequencePayload {
  participants: Array<{ id: string; label: string }>;
  messages: Array<{
    id: string;
    from: string;
    to: string;
    label: string;
    row: number;
    kind: SequenceMessageKind;
  }>;
}

const DEFAULT_PAYLOAD: SequencePayload = {
  participants: [
    { id: "user", label: "User" },
    { id: "api", label: "API Gateway" },
    { id: "service", label: "Service" },
    { id: "db", label: "Database" },
  ],
  messages: [
    { id: "m1", from: "user", to: "api", label: "POST /order", row: 0, kind: "sync" },
    { id: "m2", from: "api", to: "service", label: "createOrder()", row: 1, kind: "sync" },
    { id: "m3", from: "service", to: "db", label: "INSERT", row: 2, kind: "sync" },
    { id: "m4", from: "db", to: "service", label: "ok", row: 3, kind: "return" },
    { id: "m5", from: "service", to: "api", label: "Order{}", row: 4, kind: "return" },
    { id: "m6", from: "api", to: "user", label: "201 Created", row: 5, kind: "return" },
  ],
};

interface ParticipantData {
  label: string;
  rows: number;
}

const ParticipantImpl = ({ data }: NodeProps) => {
  const d = data as unknown as ParticipantData;
  const lineH = Math.max(LIFELINE_H, ROW_OFFSET_Y + (d.rows + 2) * ROW_H);
  return (
    <div className="relative" style={{ width: PARTICIPANT_W }}>
      <div className="flex h-14 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900/95 px-3 text-center text-sm font-semibold text-zinc-100 shadow-md backdrop-blur">
        {d.label}
      </div>
      <div
        className="pointer-events-none absolute left-1/2 top-14 -translate-x-1/2 border-l-2 border-dashed border-zinc-700"
        style={{ height: lineH }}
        aria-hidden
      />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" />
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" />
    </div>
  );
};
const Participant = memo(ParticipantImpl);

interface MessageData {
  label: string;
  row: number;
  kind: SequenceMessageKind;
}

const MessageEdgeImpl = ({ sourceX, targetX, data, selected }: EdgeProps) => {
  const d = (data ?? {}) as unknown as MessageData;
  const y = HEADER_H + ROW_OFFSET_Y + d.row * ROW_H;
  const arrowMarker =
    d.kind === "async" ? "url(#seq-arrow-open)" : d.kind === "return" ? undefined : "url(#seq-arrow)";
  const dash = d.kind === "async" || d.kind === "return" ? "6 4" : undefined;
  const stroke = selected ? "#bef264" : "#a1a1aa";
  const labelX = (sourceX + targetX) / 2;
  return (
    <>
      <line x1={sourceX} y1={y} x2={targetX} y2={y} stroke={stroke} strokeWidth={1.6} strokeDasharray={dash} markerEnd={arrowMarker} />
      <foreignObject x={labelX - 80} y={y - 22} width={160} height={20} style={{ overflow: "visible" }}>
        <div
          className="inline-block max-w-full truncate rounded border border-zinc-700 bg-zinc-900/95 px-1.5 py-0.5 text-center text-[10px] font-medium text-zinc-200 shadow"
        >
          {d.label || "message"}
        </div>
      </foreignObject>
      <line x1={sourceX} y1={y} x2={targetX} y2={y} stroke="transparent" strokeWidth={12} className="cursor-pointer" />
    </>
  );
};
const MessageEdge = memo(MessageEdgeImpl);

const nodeTypes = { participant: Participant };
const edgeTypes = { message: MessageEdge };

function payloadToFlow(p: SequencePayload): { nodes: Node[]; edges: Edge[] } {
  const rows = p.messages.length;
  const nodes: Node[] = p.participants.map((part, i) => ({
    id: part.id,
    type: "participant",
    position: { x: i * (PARTICIPANT_W + PARTICIPANT_GAP), y: 0 },
    data: { label: part.label, rows },
    draggable: true,
  }));
  const edges: Edge[] = p.messages.map((m) => ({
    id: m.id,
    source: m.from,
    target: m.to,
    type: "message",
    data: { label: m.label, row: m.row, kind: m.kind },
  }));
  return { nodes, edges };
}

function flowToPayload(nodes: Node[], edges: Edge[]): SequencePayload {
  const participants = [...nodes]
    .filter((n) => n.type === "participant")
    .sort((a, b) => a.position.x - b.position.x)
    .map((n) => ({ id: n.id, label: (n.data as unknown as ParticipantData).label }));
  const messages = edges.map((e) => {
    const d = (e.data ?? {}) as unknown as MessageData;
    return {
      id: e.id,
      from: e.source,
      to: e.target,
      label: d.label ?? "",
      row: d.row ?? 0,
      kind: (d.kind ?? "sync") as SequenceMessageKind,
    };
  });
  return { participants, messages };
}

interface Props {
  value: SequencePayload;
  onChange?: (next: SequencePayload) => void;
}

const Inner = forwardRef<BaseCanvasHandle, Props>(function Inner({ value, onChange }, ref) {
  const initial = useMemo(() => payloadToFlow(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [nodes, setNodes] = useState<Node[]>(initial.nodes);
  const [edges, setEdges] = useState<Edge[]>(initial.edges);
  const past = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const future = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const skipNext = useRef(false);
  const { fitView } = useReactFlow();

  const snapshot = useCallback(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    past.current.push({ nodes, edges });
    if (past.current.length > 100) past.current.shift();
    future.current = [];
  }, [nodes, edges]);

  const notifyRef = useRef<number | null>(null);
  useEffect(() => {
    if (notifyRef.current) cancelAnimationFrame(notifyRef.current);
    notifyRef.current = requestAnimationFrame(() => onChange?.(flowToPayload(nodes, edges)));
    return () => { if (notifyRef.current) cancelAnimationFrame(notifyRef.current); };
  }, [nodes, edges, onChange]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    if (changes.some((c) => c.type === "add" || c.type === "remove")) snapshot();
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, [snapshot]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (changes.some((c) => c.type === "add" || c.type === "remove")) snapshot();
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, [snapshot]);

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target) return;
    snapshot();
    setEdges((eds) => {
      const nextRow = eds.length;
      return addEdge(
        { ...c, id: `m_${Date.now().toString(36)}`, type: "message", data: { label: "message", row: nextRow, kind: "sync" } },
        eds
      );
    });
  }, [snapshot]);

  useImperativeHandle(ref, () => ({
    serialize: () => flowToPayload(nodes, edges),
    hydrate: (p) => {
      const flow = payloadToFlow(p as SequencePayload);
      skipNext.current = true;
      setNodes(flow.nodes);
      setEdges(flow.edges);
    },
    fit: () => fitView({ padding: 0.2, duration: 400 }),
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
  }), [nodes, edges, fitView, snapshot]);

  return (
    <div className="h-full w-full bg-zinc-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        proOptions={{ hideAttribution: true }}
        fitView
        minZoom={0.2}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="#27272a" />
        <Controls className="!bg-zinc-900 !border !border-zinc-800" />
        <MiniMap pannable zoomable className="!bg-zinc-900 !border !border-zinc-800" maskColor="rgba(0,0,0,0.6)" nodeColor="#71717a" />
        <svg style={{ position: "absolute", width: 0, height: 0 }}>
          <defs>
            <marker id="seq-arrow" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="10" markerHeight="10" orient="auto">
              <path d="M0,0 L12,6 L0,12 Z" fill="#a1a1aa" />
            </marker>
            <marker id="seq-arrow-open" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="10" markerHeight="10" orient="auto">
              <path d="M0,0 L12,6 L0,12" fill="none" stroke="#a1a1aa" strokeWidth="1.6" />
            </marker>
          </defs>
        </svg>
      </ReactFlow>
    </div>
  );
});

export const SequenceCanvas = forwardRef<BaseCanvasHandle, Props>(function SequenceCanvas(props, ref) {
  return (
    <ReactFlowProvider>
      <Inner {...props} ref={ref} />
    </ReactFlowProvider>
  );
});

export const SEQUENCE_DEFAULT_PAYLOAD = DEFAULT_PAYLOAD;
