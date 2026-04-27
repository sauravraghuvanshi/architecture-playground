/**
 * ArchitectureCanvas — React Flow (xyflow v12) cloud architecture surface.
 *
 * Phase-3 capabilities (on top of Phase-2 React Flow rewrite):
 *   - Group/swimlane nodes (resizable, named, color-coded by tier)
 *   - Custom LabeledEdge with click-to-edit pill (HTTPS / gRPC / Async / etc.)
 *   - Sequence-mode playback that pulses each edge in BFS-forest order
 *
 * Persistence model is a discriminated union (`kind: "icon" | "group"`) so
 * width/height/parentId round-trip through ArchPayload. Children of a group
 * are stored with parent-relative coordinates AND a `parentId`.
 */
"use client";

import {
  createContext,
  forwardRef,
  memo,
  useCallback,
  useContext,
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
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  MiniMap,
  NodeResizer,
  Position,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  getSmoothStepPath,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { IconLite } from "../../shared/types";

// ─── Public types (preserved + extended for Phase 3) ──────────────────────

export type ArchNode = ArchIconNode | ArchGroupNode;

export interface ArchIconNode {
  kind?: "icon"; // optional for back-compat with pre-phase-3 payloads
  id: string;
  label: string;
  iconId: string;
  iconPath: string;
  /** Absolute coords, OR — if `parentId` is set — coords relative to the parent group. */
  x: number;
  y: number;
  width?: number;
  height?: number;
  parentId?: string;
}

export interface ArchGroupNode {
  kind: "group";
  id: string;
  label: string;
  /** Always absolute. Groups are never nested for now. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Optional named tier (Edge/Frontend/Gateway/Compute/Messaging/Data/Ops). */
  tier?: string;
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
  addGroup: (label: string, tier?: string) => void;
  serialize: () => ArchPayload;
  hydrate: (payload: ArchPayload) => void;
  fit: () => void;
  deleteSelection: () => void;
  undo: () => void;
  redo: () => void;
  setAllEdgeStyle: (style: ArchEdgeStyle) => void;
  playSequence: () => void;
  stopSequence: () => void;
  isPlaying: () => boolean;
}

interface Props {
  value: ArchPayload;
  onChange?: (next: ArchPayload) => void;
  onPlayingChange?: (playing: boolean) => void;
}

// ─── Sequence playback context ────────────────────────────────────────────
// Runtime-only (NOT persisted), so playback never pollutes onChange/undo.

interface SequenceState {
  activeEdgeId: string | null;
  activeNodeId: string | null;
  isPlaying: boolean;
}
const SequenceCtx = createContext<SequenceState>({
  activeEdgeId: null,
  activeNodeId: null,
  isPlaying: false,
});
const useSequence = () => useContext(SequenceCtx);

// ─── Custom icon node ─────────────────────────────────────────────────────

interface IconNodeData {
  label: string;
  iconPath: string;
  iconId: string;
}

const IconNodeImpl = ({ id, data, selected }: NodeProps) => {
  const d = data as unknown as IconNodeData;
  const { activeNodeId, isPlaying } = useSequence();
  const isPulsing = isPlaying && activeNodeId === id;
  return (
    <div
      className={`group relative flex h-[110px] w-[120px] flex-col items-center justify-center gap-2 rounded-xl border bg-zinc-900/95 px-2 py-3 text-center shadow-lg backdrop-blur transition-all ${
        selected
          ? "border-lime-300 ring-2 ring-lime-300/40"
          : isPulsing
          ? "border-lime-300 ring-4 ring-lime-300/60 scale-[1.06]"
          : "border-zinc-700 hover:border-zinc-500"
      }`}
      style={{ transitionDuration: "200ms" }}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" />
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" />
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-lime-300 !border-zinc-950" />
      {d.iconPath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={d.iconPath} alt="" className="h-10 w-10 select-none object-contain" draggable={false} />
      ) : (
        <div className="grid h-10 w-10 place-items-center rounded bg-zinc-800 text-xs text-zinc-500">?</div>
      )}
      <div className="line-clamp-2 text-[11px] font-medium leading-tight text-zinc-100">{d.label}</div>
    </div>
  );
};
const IconNode = memo(IconNodeImpl);

// ─── Group / swimlane node ────────────────────────────────────────────────

interface GroupNodeData {
  label: string;
  tier?: string;
}

const TIER_STYLES: Record<string, { border: string; bg: string; headerBg: string; headerText: string; dot: string }> = {
  Edge:       { border: "border-sky-400/60",     bg: "bg-sky-500/[0.05]",     headerBg: "bg-sky-400/90",     headerText: "text-sky-950",     dot: "bg-sky-300" },
  Frontend:   { border: "border-violet-400/60",  bg: "bg-violet-500/[0.05]",  headerBg: "bg-violet-400/90",  headerText: "text-violet-950",  dot: "bg-violet-300" },
  Gateway:    { border: "border-fuchsia-400/60", bg: "bg-fuchsia-500/[0.05]", headerBg: "bg-fuchsia-400/90", headerText: "text-fuchsia-950", dot: "bg-fuchsia-300" },
  Compute:    { border: "border-lime-400/60",    bg: "bg-lime-500/[0.05]",    headerBg: "bg-lime-300/90",    headerText: "text-lime-950",    dot: "bg-lime-300" },
  Messaging:  { border: "border-amber-400/60",   bg: "bg-amber-500/[0.05]",   headerBg: "bg-amber-400/90",   headerText: "text-amber-950",   dot: "bg-amber-300" },
  Data:       { border: "border-emerald-400/60", bg: "bg-emerald-500/[0.05]", headerBg: "bg-emerald-400/90", headerText: "text-emerald-950", dot: "bg-emerald-300" },
  Ops:        { border: "border-zinc-400/60",    bg: "bg-zinc-500/[0.05]",    headerBg: "bg-zinc-400/90",    headerText: "text-zinc-950",    dot: "bg-zinc-300" },
  Custom:     { border: "border-zinc-500/60",    bg: "bg-zinc-700/[0.06]",    headerBg: "bg-zinc-600/90",    headerText: "text-zinc-50",     dot: "bg-zinc-300" },
};

const GroupNodeImpl = ({ data, selected }: NodeProps) => {
  const d = data as unknown as GroupNodeData;
  const v = TIER_STYLES[d.tier ?? "Custom"] ?? TIER_STYLES.Custom;
  const tierName = d.tier ?? "Group";
  const showSubLabel = d.label && d.label !== d.tier;
  return (
    <div
      className={`relative flex h-full w-full flex-col rounded-2xl border-2 border-dashed ${v.border} ${v.bg} ${
        selected ? "ring-2 ring-lime-300/60" : ""
      }`}
    >
      <NodeResizer
        minWidth={240}
        minHeight={160}
        isVisible={selected}
        lineClassName="!border-lime-300"
        handleClassName="!bg-lime-300 !border-zinc-950"
      />
      {/* Header band — solid, prominent, always inside bounds */}
      <div
        className={`flex shrink-0 items-center gap-2 rounded-t-xl px-3 py-1.5 ${v.headerBg} ${v.headerText}`}
        style={{ pointerEvents: "none" }}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${v.dot} ring-2 ring-white/30`} />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em]">{tierName}</span>
        {showSubLabel && (
          <span className="ml-auto truncate text-[10px] font-medium opacity-80">{d.label}</span>
        )}
      </div>
      {/* Soft inner gradient for depth */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 rounded-b-2xl bg-gradient-to-t from-zinc-950/40 to-transparent"
        aria-hidden
      />
    </div>
  );
};
const GroupNode = memo(GroupNodeImpl);

const nodeTypes = { icon: IconNode, group: GroupNode };

// ─── Custom labeled edge ──────────────────────────────────────────────────

interface LabeledEdgeData {
  archStyle?: ArchEdgeStyle;
  label?: string;
}

const LabeledEdgeImpl = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
  style,
}: EdgeProps) => {
  const d = (data ?? {}) as LabeledEdgeData;
  const archStyle = d.archStyle ?? "flow";
  const { activeEdgeId, isPlaying } = useSequence();
  const isActive = activeEdgeId === id;

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
    borderRadius: 12,
  });

  const baseStroke = archStyle === "flow" ? "#bef264" : "#a1a1aa";
  const stroke = isActive ? "#bef264" : selected ? "#bef264" : baseStroke;
  const strokeWidth = isActive ? 3 : selected ? 2.2 : 1.6;
  const dashArray =
    archStyle === "dashed" || archStyle === "flow" || isActive ? "8 4" : undefined;
  const animated = archStyle === "flow" || isActive;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke,
          strokeWidth,
          strokeDasharray: dashArray,
          animation: animated ? "diagrammaticDash 1.2s linear infinite" : undefined,
          opacity: isPlaying && !isActive ? 0.35 : 1,
          transition: "stroke 120ms ease, stroke-width 120ms ease, opacity 200ms ease",
        }}
      />
      {d.label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute rounded-md border border-zinc-700 bg-zinc-900/95 px-2 py-0.5 text-[10px] font-semibold text-zinc-200 shadow-md backdrop-blur"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {d.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
const LabeledEdge = memo(LabeledEdgeImpl);

const edgeTypes = { labeled: LabeledEdge };

// ─── Edge style helpers ──────────────────────────────────────────────────

const DEFAULT_MARKER = { type: MarkerType.ArrowClosed, color: "#a1a1aa", width: 18, height: 18 };
const FLOW_MARKER = { type: MarkerType.ArrowClosed, color: "#bef264", width: 18, height: 18 };

function edgePropsForStyle(style: ArchEdgeStyle): Partial<Edge> {
  return {
    type: "labeled",
    animated: false, // visual animation happens in LabeledEdge via CSS
    markerEnd: style === "flow" ? FLOW_MARKER : DEFAULT_MARKER,
    data: { archStyle: style },
  };
}

// ─── Serialization ────────────────────────────────────────────────────────

function archToFlow(payload: ArchPayload): { nodes: Node[]; edges: Edge[] } {
  const groupIds = new Set(
    (payload.nodes ?? []).filter((n) => n.kind === "group").map((n) => n.id)
  );
  const nodes: Node[] = (payload.nodes ?? []).map((n) => {
    if (n.kind === "group") {
      return {
        id: n.id,
        type: "group",
        position: { x: n.x, y: n.y },
        data: { label: n.label, tier: n.tier },
        style: { width: n.width, height: n.height },
        zIndex: -1,
        selectable: true,
      };
    }
    const parentId = n.parentId && groupIds.has(n.parentId) ? n.parentId : undefined;
    return {
      id: n.id,
      type: "icon",
      position: { x: n.x, y: n.y },
      data: { label: n.label, iconPath: n.iconPath, iconId: n.iconId },
      ...(parentId ? { parentId, extent: "parent" as const } : {}),
    };
  });
  const edges: Edge[] = (payload.edges ?? []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: undefined,
    ...edgePropsForStyle(e.style ?? "flow"),
    data: { archStyle: e.style ?? "flow", label: e.label },
  }));
  return { nodes, edges };
}

function flowToArch(nodes: Node[], edges: Edge[]): ArchPayload {
  return {
    nodes: nodes.map((n): ArchNode => {
      if (n.type === "group") {
        const d = n.data as unknown as GroupNodeData;
        const w =
          (n.measured?.width as number | undefined) ??
          ((n.style?.width as number | undefined)) ??
          280;
        const h =
          (n.measured?.height as number | undefined) ??
          ((n.style?.height as number | undefined)) ??
          200;
        return {
          kind: "group",
          id: n.id,
          label: d?.label ?? "",
          tier: d?.tier,
          x: n.position.x,
          y: n.position.y,
          width: w,
          height: h,
        };
      }
      const d = n.data as unknown as IconNodeData;
      return {
        kind: "icon",
        id: n.id,
        label: d?.label ?? "",
        iconId: d?.iconId ?? "",
        iconPath: d?.iconPath ?? "",
        x: n.position.x,
        y: n.position.y,
        ...(n.parentId ? { parentId: n.parentId } : {}),
      };
    }),
    edges: edges.map((e) => {
      const d = (e.data ?? {}) as LabeledEdgeData;
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: d.label,
        style: d.archStyle ?? "flow",
      };
    }),
  };
}

// ─── BFS forest traversal for sequence playback ──────────────────────────
// Visits roots first (no incoming edges), then any unvisited node, so
// disconnected cycles still get covered.

function computeEdgePlaybackOrder(nodes: Node[], edges: Edge[]): string[] {
  const iconIds = new Set(nodes.filter((n) => n.type !== "group").map((n) => n.id));
  const incoming = new Map<string, number>();
  const adj = new Map<string, Array<{ edgeId: string; target: string }>>();
  for (const id of iconIds) {
    incoming.set(id, 0);
    adj.set(id, []);
  }
  for (const e of edges) {
    if (!iconIds.has(e.source) || !iconIds.has(e.target)) continue;
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
    adj.get(e.source)!.push({ edgeId: e.id, target: e.target });
  }
  const order: string[] = [];
  const visitedNodes = new Set<string>();
  const visitedEdges = new Set<string>();

  const bfsFrom = (start: string) => {
    const queue = [start];
    visitedNodes.add(start);
    while (queue.length) {
      const cur = queue.shift()!;
      const outs = adj.get(cur) ?? [];
      for (const { edgeId, target } of outs) {
        if (visitedEdges.has(edgeId)) continue;
        visitedEdges.add(edgeId);
        order.push(edgeId);
        if (!visitedNodes.has(target)) {
          visitedNodes.add(target);
          queue.push(target);
        }
      }
    }
  };

  // Roots first (insertion-stable).
  for (const n of nodes) {
    if (n.type === "group") continue;
    if ((incoming.get(n.id) ?? 0) === 0 && !visitedNodes.has(n.id)) {
      bfsFrom(n.id);
    }
  }
  // Catch disconnected cycles.
  for (const n of nodes) {
    if (n.type === "group") continue;
    if (!visitedNodes.has(n.id)) bfsFrom(n.id);
  }
  return order;
}

// ─── Inner canvas ────────────────────────────────────────────────────────

const STEP_MS = 700;

const CanvasInner = forwardRef<ArchitectureCanvasHandle, Props>(function CanvasInner(
  { value, onChange, onPlayingChange },
  ref
) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => archToFlow(value), []);
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const defaultEdgeStyle = useRef<ArchEdgeStyle>("flow");

  const past = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const future = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const skipNextSnapshot = useRef(false);

  // Sequence playback (runtime-only).
  const [seq, setSeq] = useState<SequenceState>({
    activeEdgeId: null,
    activeNodeId: null,
    isPlaying: false,
  });
  const seqTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const lastHydrateKey = useRef<string>("");
  useEffect(() => {
    const key = `${value.nodes?.length ?? 0}:${value.edges?.length ?? 0}:${value.nodes?.[0]?.id ?? ""}`;
    if (key === lastHydrateKey.current) return;
    const localCount = nodes.length + edges.length;
    const incomingCount = (value.nodes?.length ?? 0) + (value.edges?.length ?? 0);
    if (incomingCount > 0 && (localCount === 0 || Math.abs(incomingCount - localCount) >= 2)) {
      const flow = archToFlow(value);
      skipNextSnapshot.current = true;
      setNodes(flow.nodes);
      setEdges(flow.edges);
      lastHydrateKey.current = key;
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

  // Find the smallest group node whose bounding box contains the given
  // (flow-space) point. Returns null if none.
  const groupAtPosition = useCallback(
    (flowX: number, flowY: number): Node | null => {
      const groups = nodes.filter((n) => n.type === "group");
      let best: Node | null = null;
      let bestArea = Infinity;
      for (const g of groups) {
        const w = (g.measured?.width as number | undefined) ?? ((g.style?.width as number | undefined) ?? 280);
        const h = (g.measured?.height as number | undefined) ?? ((g.style?.height as number | undefined) ?? 200);
        if (
          flowX >= g.position.x &&
          flowX <= g.position.x + w &&
          flowY >= g.position.y &&
          flowY <= g.position.y + h
        ) {
          const area = w * h;
          if (area < bestArea) {
            bestArea = area;
            best = g;
          }
        }
      }
      return best;
    },
    [nodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("application/x-diagrammatic-icon");
    if (!id) return;
    window.dispatchEvent(
      new CustomEvent("diagrammatic-drop", {
        detail: { payload: id, clientX: event.clientX, clientY: event.clientY },
      })
    );
  }, []);

  // ─── Sequence playback ────────────────────────────────────────────────
  const stopSequence = useCallback(() => {
    if (seqTimer.current) clearTimeout(seqTimer.current);
    seqTimer.current = null;
    setSeq({ activeEdgeId: null, activeNodeId: null, isPlaying: false });
    onPlayingChange?.(false);
  }, [onPlayingChange]);

  const playSequence = useCallback(() => {
    const order = computeEdgePlaybackOrder(nodes, edges);
    if (order.length === 0) return;
    if (seqTimer.current) clearTimeout(seqTimer.current);
    onPlayingChange?.(true);
    let i = 0;
    const step = () => {
      if (i >= order.length) {
        stopSequence();
        return;
      }
      const edgeId = order[i];
      const e = edges.find((x) => x.id === edgeId);
      setSeq({
        activeEdgeId: edgeId,
        activeNodeId: e?.target ?? null,
        isPlaying: true,
      });
      i += 1;
      seqTimer.current = setTimeout(step, STEP_MS);
    };
    step();
  }, [nodes, edges, onPlayingChange, stopSequence]);

  useEffect(() => {
    return () => {
      if (seqTimer.current) clearTimeout(seqTimer.current);
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      dropIcon: (icon, clientX, clientY) => {
        const pos = screenToFlowPosition({ x: clientX, y: clientY });
        const groupHit = groupAtPosition(pos.x, pos.y);
        snapshot();
        const localPos = groupHit
          ? { x: pos.x - groupHit.position.x - 60, y: pos.y - groupHit.position.y - 55 }
          : { x: pos.x - 60, y: pos.y - 55 };
        setNodes((nds) =>
          nds.concat({
            id: `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            type: "icon",
            position: localPos,
            data: { label: icon.label, iconPath: icon.path, iconId: icon.id },
            ...(groupHit ? { parentId: groupHit.id, extent: "parent" as const } : {}),
          })
        );
      },
      addIconAtCenter: (icon) => {
        if (!rfInstance) return;
        const center = rfInstance.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        // Click-to-add never auto-parents into a group — that caused the icon
        // to render with negative local coords, hidden under the group surface.
        // Drag-drop still parents intentionally via dropIcon.
        const jitter = () => (Math.random() - 0.5) * 80;
        snapshot();
        setNodes((nds) =>
          nds.concat({
            id: `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            type: "icon",
            position: { x: center.x - 60 + jitter(), y: center.y - 55 + jitter() },
            data: { label: icon.label, iconPath: icon.path, iconId: icon.id },
            zIndex: 10,
          })
        );
      },
      addGroup: (label, tier) => {
        if (!rfInstance) return;
        const center = rfInstance.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        snapshot();
        // Place the group OFFSET from the canvas center so it doesn't land
        // directly on top of existing icons. zIndex stays low so icons render
        // above the group surface.
        setNodes((nds) =>
          nds.concat({
            id: `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            type: "group",
            position: { x: center.x - 220, y: center.y + 80 },
            data: { label, tier: tier ?? "Custom" },
            style: { width: 440, height: 220 },
            zIndex: 0,
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
        setNodes((nds) => nds.filter((n) => !selNodeIds.has(n.id) && (!n.parentId || !selNodeIds.has(n.parentId))));
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
        const props = edgePropsForStyle(style);
        setEdges((eds) =>
          eds.map((e) => {
            const prevData = (e.data ?? {}) as LabeledEdgeData;
            return {
              ...e,
              ...props,
              data: { ...prevData, archStyle: style },
            };
          })
        );
      },
      playSequence,
      stopSequence,
      isPlaying: () => seq.isPlaying,
    }),
    [
      nodes,
      edges,
      rfInstance,
      screenToFlowPosition,
      snapshot,
      groupAtPosition,
      playSequence,
      stopSequence,
      seq.isPlaying,
    ]
  );

  return (
    <SequenceCtx.Provider value={seq}>
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
          edgeTypes={edgeTypes}
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
            nodeColor={(n) => (n.type === "group" ? "#3f3f46" : "#bef264")}
            nodeStrokeColor="#52525b"
            maskColor="rgba(9, 9, 11, 0.7)"
          />
        </ReactFlow>
      </div>
    </SequenceCtx.Provider>
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
