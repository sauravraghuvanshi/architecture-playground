/**
 * ArchitectureCanvas — React Flow (xyflow) cloud architecture surface.
 *
 * Why React Flow (replaced maxGraph in Phase 2.5):
 *   - maxGraph's image-style + custom-label rendering kept losing either the
 *     icon or the label (browser screenshots showed empty boxes).
 *   - React Flow lets us own a real React component per node — we render the
 *     SVG icon with a plain `<img>` and the label with a `<div>`. Same props
 *     shape, so nothing breaks.
 *   - Animated edges are a one-prop affair (`animated: true`) and they ship
 *     with proper marker arrows, smoothstep routing, MiniMap and viewport
 *     controls out of the box.
 *
 * The exported types (ArchPayload, ArchEdge, ArchEdgeStyle, etc.) are the
 * SAME shape we used with maxGraph so Workspace.tsx, lib/prompt-to-arch.ts
 * and any persisted JSON drafts continue to work without migration.
 */
"use client";

import {
  forwardRef,
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
  MarkerType,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { IconLite } from "../../shared/types";

// ─── Public types (preserved for callers) ─────────────────────────────────

export interface ArchNode {
  id: string;
  label: string;
  iconId: string;
  iconPath: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export type ArchEdgeStyle = "solid" | "dashed" | "flow";

export interface ArchEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  style?: ArchEdgeStyle;
}

export interface ArchPayload {
  nodes: ArchNode[];
  edges: ArchEdge[];
}

export interface ArchitectureCanvasHandle {
  dropIcon: (icon: IconLite, clientX: number, clientY: number) => void;
  addIconAtCenter: (icon: IconLite) => void;
  serialize: () => ArchPayload;
  hydrate: (payload: ArchPayload) => void;
  fit: () => void;
  deleteSelection: () => void;
  undo: () => void;
  redo: () => void;
  setAllEdgeStyle: (style: ArchEdgeStyle) => void;
}

interface Props {
  value: ArchPayload;
  onChange?: (next: ArchPayload) => void;
}

// ─── Custom node ──────────────────────────────────────────────────────────

interface IconNodeData {
  label: string;
  iconPath: string;
  iconId: string;
}

/**
 * Node renders the icon SVG + label inside a rounded card. Four handles
 * (top/right/bottom/left) so users can connect from any side. Lime-300 on
 * selection.
 */
const IconNode = ({ data, selected }: NodeProps) => {
  const d = data as unknown as IconNodeData;
  return (
    <div
      className={`group relative flex h-[110px] w-[120px] flex-col items-center justify-center gap-2 rounded-xl border bg-zinc-900/95 px-2 py-3 text-center shadow-lg backdrop-blur transition ${
        selected ? "border-lime-300 ring-2 ring-lime-300/40" : "border-zinc-700 hover:border-zinc-500"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" />
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" />
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" />
      {d.iconPath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={d.iconPath}
          alt=""
          className="h-10 w-10 select-none object-contain"
          draggable={false}
        />
      ) : (
        <div className="grid h-10 w-10 place-items-center rounded bg-zinc-800 text-xs text-zinc-500">?</div>
      )}
      <div className="line-clamp-2 text-[11px] font-medium leading-tight text-zinc-100">
        {d.label}
      </div>
    </div>
  );
};

const nodeTypes = { icon: IconNode };

// ─── Helpers ──────────────────────────────────────────────────────────────

const STYLE_TO_EDGE_PROPS: Record<ArchEdgeStyle, Partial<Edge>> = {
  solid: {
    animated: false,
    style: { stroke: "#a1a1aa", strokeWidth: 1.6 },
  },
  dashed: {
    animated: false,
    style: { stroke: "#a1a1aa", strokeWidth: 1.6, strokeDasharray: "6 4" },
  },
  flow: {
    animated: true,
    style: { stroke: "#bef264", strokeWidth: 1.8 },
  },
};

const DEFAULT_MARKER = { type: MarkerType.ArrowClosed, color: "#a1a1aa", width: 18, height: 18 };
const FLOW_MARKER = { type: MarkerType.ArrowClosed, color: "#bef264", width: 18, height: 18 };

function edgePropsForStyle(style: ArchEdgeStyle): Partial<Edge> {
  const base = STYLE_TO_EDGE_PROPS[style];
  return {
    ...base,
    type: "smoothstep",
    markerEnd: style === "flow" ? FLOW_MARKER : DEFAULT_MARKER,
    data: { archStyle: style },
  };
}

function archToFlow(payload: ArchPayload): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = (payload.nodes ?? []).map((n) => ({
    id: n.id,
    type: "icon",
    position: { x: n.x, y: n.y },
    data: { label: n.label, iconPath: n.iconPath, iconId: n.iconId },
  }));
  const edges: Edge[] = (payload.edges ?? []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    ...edgePropsForStyle(e.style ?? "flow"),
  }));
  return { nodes, edges };
}

function flowToArch(nodes: Node[], edges: Edge[]): ArchPayload {
  return {
    nodes: nodes.map((n) => {
      const d = n.data as unknown as IconNodeData;
      return {
        id: n.id,
        label: d?.label ?? "",
        iconId: d?.iconId ?? "",
        iconPath: d?.iconPath ?? "",
        x: n.position.x,
        y: n.position.y,
      };
    }),
    edges: edges.map((e) => {
      const archStyle =
        ((e.data as { archStyle?: ArchEdgeStyle } | undefined)?.archStyle) ??
        (e.animated ? "flow" : "solid");
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: typeof e.label === "string" ? e.label : undefined,
        style: archStyle,
      };
    }),
  };
}

// ─── Inner canvas (must live inside ReactFlowProvider) ────────────────────

const CanvasInner = forwardRef<ArchitectureCanvasHandle, Props>(function CanvasInner(
  { value, onChange },
  ref
) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => archToFlow(value), []);
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const defaultEdgeStyle = useRef<ArchEdgeStyle>("flow");

  // Undo/redo: snapshot stacks of {nodes, edges} arrays.
  const past = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const future = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const skipNextSnapshot = useRef(false);

  const { screenToFlowPosition } = useReactFlow();

  const snapshot = useCallback(() => {
    if (skipNextSnapshot.current) {
      skipNextSnapshot.current = false;
      return;
    }
    past.current.push({ nodes, edges });
    if (past.current.length > 100) past.current.shift();
    future.current = [];
  }, [nodes, edges]);

  // Notify parent on every node/edge change (debounced via microtask).
  const notifyRef = useRef<number | null>(null);
  useEffect(() => {
    if (notifyRef.current) cancelAnimationFrame(notifyRef.current);
    notifyRef.current = requestAnimationFrame(() => {
      onChange?.(flowToArch(nodes, edges));
    });
    return () => {
      if (notifyRef.current) cancelAnimationFrame(notifyRef.current);
    };
  }, [nodes, edges, onChange]);

  // External `value` changes (e.g. AI-generated payload) → rehydrate.
  // Keyed by node-count + edge-count + first-id to avoid endless loops with
  // the parent's onChange feedback (parent stores what we serialized).
  const lastHydrateKey = useRef<string>("");
  useEffect(() => {
    const key = `${value.nodes?.length ?? 0}:${value.edges?.length ?? 0}:${value.nodes?.[0]?.id ?? ""}`;
    if (key === lastHydrateKey.current) return;
    // Only hydrate when the payload looks externally seeded — i.e. the local
    // graph is empty or radically different in size.
    const localCount = nodes.length + edges.length;
    const incomingCount = (value.nodes?.length ?? 0) + (value.edges?.length ?? 0);
    if (incomingCount > 0 && Math.abs(incomingCount - localCount) >= 2) {
      const flow = archToFlow(value);
      skipNextSnapshot.current = true;
      setNodes(flow.nodes);
      setEdges(flow.edges);
      lastHydrateKey.current = key;
      // Fit after the next paint so the new graph is centered.
      requestAnimationFrame(() => rfInstance?.fitView({ padding: 0.2, duration: 400 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const hasStructural = changes.some((c) => c.type === "add" || c.type === "remove");
      if (hasStructural) snapshot();
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [snapshot]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const hasStructural = changes.some((c) => c.type === "add" || c.type === "remove");
      if (hasStructural) snapshot();
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [snapshot]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      snapshot();
      const id = `e_${connection.source}_${connection.target}_${Date.now().toString(36)}`;
      const props = edgePropsForStyle(defaultEdgeStyle.current);
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id,
            ...props,
          },
          eds
        )
      );
    },
    [snapshot]
  );

  // ─── Drag-and-drop from palette ─────────────────────────────────────────
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const id = event.dataTransfer.getData("application/x-diagrammatic-icon");
      if (!id) return;
      // Re-emit so Workspace can resolve the IconLite from its manifest map.
      window.dispatchEvent(
        new CustomEvent("diagrammatic-drop", {
          detail: { payload: id, clientX: event.clientX, clientY: event.clientY },
        })
      );
    },
    []
  );

  // ─── Imperative handle ──────────────────────────────────────────────────
  useImperativeHandle(
    ref,
    () => ({
      dropIcon: (icon, clientX, clientY) => {
        const pos = screenToFlowPosition({ x: clientX, y: clientY });
        snapshot();
        setNodes((nds) =>
          nds.concat({
            id: `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            type: "icon",
            position: { x: pos.x - 60, y: pos.y - 55 },
            data: { label: icon.label, iconPath: icon.path, iconId: icon.id },
          })
        );
      },
      addIconAtCenter: (icon) => {
        if (!rfInstance) return;
        const center = rfInstance.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        const jitter = () => (Math.random() - 0.5) * 60;
        snapshot();
        setNodes((nds) =>
          nds.concat({
            id: `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            type: "icon",
            position: { x: center.x - 60 + jitter(), y: center.y - 55 + jitter() },
            data: { label: icon.label, iconPath: icon.path, iconId: icon.id },
          })
        );
      },
      serialize: () => flowToArch(nodes, edges),
      hydrate: (payload) => {
        snapshot();
        const flow = archToFlow(payload);
        setNodes(flow.nodes);
        setEdges(flow.edges);
        requestAnimationFrame(() => rfInstance?.fitView({ padding: 0.2, duration: 400 }));
      },
      fit: () => {
        rfInstance?.fitView({ padding: 0.2, duration: 400 });
      },
      deleteSelection: () => {
        const selNodeIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
        const selEdgeIds = new Set(edges.filter((e) => e.selected).map((e) => e.id));
        if (selNodeIds.size === 0 && selEdgeIds.size === 0) return;
        snapshot();
        setNodes((nds) => nds.filter((n) => !selNodeIds.has(n.id)));
        setEdges((eds) =>
          eds.filter((e) => !selEdgeIds.has(e.id) && !selNodeIds.has(e.source) && !selNodeIds.has(e.target))
        );
      },
      undo: () => {
        const prev = past.current.pop();
        if (!prev) return;
        future.current.push({ nodes, edges });
        skipNextSnapshot.current = true;
        setNodes(prev.nodes);
        setEdges(prev.edges);
      },
      redo: () => {
        const next = future.current.pop();
        if (!next) return;
        past.current.push({ nodes, edges });
        skipNextSnapshot.current = true;
        setNodes(next.nodes);
        setEdges(next.edges);
      },
      setAllEdgeStyle: (style) => {
        defaultEdgeStyle.current = style;
        setEdges((eds) =>
          eds.map((e) => ({
            ...e,
            ...edgePropsForStyle(style),
          }))
        );
      },
    }),
    [nodes, edges, rfInstance, screenToFlowPosition, snapshot]
  );

  return (
    <div
      ref={wrapperRef}
      className="h-full w-full bg-zinc-950"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setRfInstance}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={edgePropsForStyle("flow")}
        snapToGrid
        snapGrid={[12, 12]}
        minZoom={0.2}
        maxZoom={2.5}
        deleteKeyCode={["Backspace", "Delete"]}
        multiSelectionKeyCode={["Meta", "Control", "Shift"]}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#27272a" />
        <Controls
          showInteractive={false}
          className="!bg-zinc-900 !border-zinc-800 [&>button]:!bg-zinc-900 [&>button]:!border-zinc-800 [&>button]:!text-zinc-300 [&>button:hover]:!bg-zinc-800"
        />
        <MiniMap
          pannable
          zoomable
          className="!bg-zinc-900 !border !border-zinc-800"
          nodeColor={() => "#bef264"}
          nodeStrokeColor="#52525b"
          maskColor="rgba(9, 9, 11, 0.7)"
        />
      </ReactFlow>
    </div>
  );
});

export const ArchitectureCanvas = forwardRef<ArchitectureCanvasHandle, Props>(function ArchitectureCanvas(
  props,
  ref
) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} ref={ref} />
    </ReactFlowProvider>
  );
});
