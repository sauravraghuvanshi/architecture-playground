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
  useRef,
  useState,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  BaseEdge,
  ConnectionMode,
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
  type OnSelectionChangeParams,
  type ReactFlowInstance,
} from "@xyflow/react";
import {
  Box,
  Circle,
  Database,
  Diamond,
  FileText,
  Globe2,
  Square,
  UserRound,
} from "lucide-react";

import type { IconLite } from "../../shared/types";

// ─── Public types (preserved + extended for Phase 3) ──────────────────────

export type ArchNode = ArchIconNode | ArchGroupNode | ArchShapeNode;

export type ArchShape =
  | "rectangle"
  | "circle"
  | "diamond"
  | "database"
  | "person"
  | "document"
  | "internet";

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
  subtitle?: string;
}

export interface ArchShapeNode {
  kind: "shape";
  id: string;
  label: string;
  shape: ArchShape;
  x: number;
  y: number;
  width?: number;
  height?: number;
  parentId?: string;
  subtitle?: string;
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
  /** Explicit 1-based playback/GIF order. Lower steps animate first. */
  step?: number;
}

export interface ArchPayload {
  nodes: ArchNode[];
  edges: ArchEdge[];
}

export interface ArchitectureCanvasHandle {
  dropIcon: (icon: IconLite, clientX: number, clientY: number) => void;
  addIconAtCenter: (icon: IconLite) => void;
  dropShape: (shape: ArchShape, clientX: number, clientY: number) => void;
  addShapeAtCenter: (shape: ArchShape) => void;
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
  updateElement: (id: string, patch: ArchitectureSelectionPatch) => void;
  focusElement: (id: string) => void;
  getExportBounds: () => { x: number; y: number; width: number; height: number };
  /**
   * Step through the configured sequence, await a paint, and yield each
   * highlighted state to the caller. Edges sharing a step render together.
   * Calls `onFrame()` for: an initial idle frame, every configured step,
   * and a final idle frame. Returns the number of frames produced.
   */
  recordSequence: (onFrame: (label: string) => Promise<void>) => Promise<number>;
}

export interface ArchitectureSelection {
  kind: "node" | "edge";
  id: string;
  label: string;
  nodeKind?: "icon" | "shape" | "group";
  subtitle?: string;
  tier?: string;
  style?: ArchEdgeStyle;
  step?: number;
}

export interface ArchitectureSelectionPatch {
  label?: string;
  subtitle?: string;
  style?: ArchEdgeStyle;
  step?: number;
}

interface Props {
  value: ArchPayload;
  onChange?: (next: ArchPayload) => void;
  onPlayingChange?: (playing: boolean) => void;
  onSelectionChange?: (selection: ArchitectureSelection | null) => void;
}

// ─── Sequence playback context ────────────────────────────────────────────
// Runtime-only (NOT persisted), so playback never pollutes onChange/undo.

interface SequenceState {
  activeEdgeIds: string[];
  isPlaying: boolean;
  /** Non-null only during GIF capture; drives deterministic dash movement. */
  capturePhase: number | null;
}
const SequenceCtx = createContext<SequenceState>({
  activeEdgeIds: [],
  isPlaying: false,
  capturePhase: null,
});
const useSequence = () => useContext(SequenceCtx);

// ─── Custom icon node ─────────────────────────────────────────────────────

interface IconNodeData {
  label: string;
  iconPath: string;
  iconId: string;
  subtitle?: string;
}

function ConnectionHandles() {
  const base =
    "!h-3.5 !w-3.5 !border-[3px] !border-white !bg-sky-600 !shadow-[0_0_0_1px_rgba(15,23,42,0.24)] transition-transform hover:!scale-125";
  return (
    <>
      <Handle id="top" type="source" position={Position.Top} className={base} />
      <Handle id="right" type="source" position={Position.Right} className={base} />
      <Handle id="left" type="source" position={Position.Left} className={base} />
      <Handle id="bottom" type="source" position={Position.Bottom} className={base} />
    </>
  );
}

const IconNodeImpl = ({ data, selected }: NodeProps) => {
  const d = data as unknown as IconNodeData;
  // Defensive: track img load failure so the node ALWAYS shows something
  // identifiable, even if the SVG 404s under load or a stale path slipped in.
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const imgFailed = failedPath === d.iconPath;
  const cloudColor = d.iconId?.startsWith("aws/") ? "text-orange-300"
    : d.iconId?.startsWith("azure/") ? "text-sky-300"
    : d.iconId?.startsWith("gcp/") ? "text-emerald-300"
    : "text-zinc-300";
  return (
    <div
      className={`group relative flex h-[116px] w-[132px] flex-col items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-3 text-center shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)] transition-all ${
        selected
          ? "border-sky-500 ring-4 ring-sky-500/15"
          : "border-slate-200 hover:border-sky-300 hover:shadow-[0_14px_36px_-18px_rgba(2,132,199,0.45)]"
      }`}
      style={{ transitionDuration: "200ms" }}
    >
      <ConnectionHandles />
      {d.iconPath && !imgFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={d.iconPath}
          src={d.iconPath}
          alt=""
          className="h-11 w-11 select-none object-contain"
          draggable={false}
          loading="eager"
          decoding="sync"
          onError={() => setFailedPath(d.iconPath)}
        />
      ) : (
        <div className={`grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-[10px] font-bold ${cloudColor}`}>
          {d.iconId?.split("/")[0]?.toUpperCase().slice(0, 3) ?? "SVC"}
        </div>
      )}
      <div className="line-clamp-2 text-[11px] font-semibold leading-tight text-slate-800">{d.label}</div>
      {d.subtitle && (
        <div className="-mt-1 line-clamp-1 text-[9px] font-medium uppercase tracking-wide text-slate-400">
          {d.subtitle}
        </div>
      )}
    </div>
  );
};
const IconNode = memo(IconNodeImpl);

interface ShapeNodeData {
  label: string;
  shape: ArchShape;
  subtitle?: string;
}

const SHAPE_ICONS = {
  rectangle: Square,
  circle: Circle,
  diamond: Diamond,
  database: Database,
  person: UserRound,
  document: FileText,
  internet: Globe2,
} satisfies Record<ArchShape, typeof Box>;

const ShapeNodeImpl = ({ data, selected }: NodeProps) => {
  const d = data as unknown as ShapeNodeData;
  const Icon = SHAPE_ICONS[d.shape] ?? Box;
  const shapeClass =
    d.shape === "circle"
      ? "rounded-full aspect-square"
      : d.shape === "diamond"
        ? "[clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)]"
        : d.shape === "database"
          ? "rounded-[50%/14%]"
          : d.shape === "document"
            ? "rounded-lg [clip-path:polygon(0_0,82%_0,100%_18%,100%_100%,0_100%)]"
            : "rounded-xl";
  return (
    <div
      className={`relative flex h-[104px] w-[128px] flex-col items-center justify-center gap-2 border bg-white px-3 text-center shadow-[0_10px_28px_-18px_rgba(15,23,42,0.4)] ${shapeClass} ${
        selected ? "border-sky-500 ring-4 ring-sky-500/15" : "border-slate-300 hover:border-sky-300"
      }`}
    >
      <ConnectionHandles />
      <Icon className="h-7 w-7 text-slate-500" strokeWidth={1.65} />
      <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-slate-800">{d.label}</span>
      {d.subtitle && <span className="-mt-1 text-[9px] uppercase tracking-wide text-slate-400">{d.subtitle}</span>}
    </div>
  );
};
const ShapeNode = memo(ShapeNodeImpl);

// ─── Group / swimlane node ────────────────────────────────────────────────

interface GroupNodeData {
  label: string;
  tier?: string;
}

const TIER_STYLES: Record<string, { border: string; bg: string; headerBg: string; headerText: string; dot: string }> = {
  Edge:       { border: "border-sky-300",     bg: "bg-sky-50/70",     headerBg: "bg-sky-100",     headerText: "text-sky-900",     dot: "bg-sky-500" },
  Frontend:   { border: "border-indigo-300",  bg: "bg-indigo-50/70",  headerBg: "bg-indigo-100",  headerText: "text-indigo-900",  dot: "bg-indigo-500" },
  Gateway:    { border: "border-cyan-300",    bg: "bg-cyan-50/70",    headerBg: "bg-cyan-100",    headerText: "text-cyan-900",    dot: "bg-cyan-500" },
  Compute:    { border: "border-blue-300",    bg: "bg-blue-50/70",    headerBg: "bg-blue-100",    headerText: "text-blue-900",    dot: "bg-blue-500" },
  Messaging:  { border: "border-amber-300",   bg: "bg-amber-50/70",   headerBg: "bg-amber-100",   headerText: "text-amber-900",   dot: "bg-amber-500" },
  Data:       { border: "border-emerald-300", bg: "bg-emerald-50/70", headerBg: "bg-emerald-100", headerText: "text-emerald-900", dot: "bg-emerald-500" },
  Ops:        { border: "border-slate-300",   bg: "bg-slate-50/80",   headerBg: "bg-slate-100",   headerText: "text-slate-900",   dot: "bg-slate-500" },
  Custom:     { border: "border-slate-300",   bg: "bg-white/70",      headerBg: "bg-slate-100",   headerText: "text-slate-900",   dot: "bg-slate-500" },
};

const GroupNodeImpl = ({ data, selected }: NodeProps) => {
  const d = data as unknown as GroupNodeData;
  const v = TIER_STYLES[d.tier ?? "Custom"] ?? TIER_STYLES.Custom;
  const tierName = d.tier ?? "Group";
  const showSubLabel = d.label && d.label !== d.tier;
  return (
    <div
      className={`relative flex h-full w-full flex-col rounded-2xl border border-dashed ${v.border} ${v.bg} ${
        selected ? "ring-2 ring-sky-500/40" : ""
      }`}
    >
      <ConnectionHandles />
      <NodeResizer
        minWidth={240}
        minHeight={160}
        isVisible={selected}
        lineClassName="!border-sky-500"
        handleClassName="!bg-sky-500 !border-white"
      />
      {/* Header band — solid, prominent, always inside bounds */}
      <div
        className={`flex shrink-0 items-center gap-2 rounded-t-xl px-3 py-1.5 ${v.headerBg} ${v.headerText}`}
        style={{ pointerEvents: "none" }}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${v.dot}`} />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em]">{tierName}</span>
        {showSubLabel && (
          <span className="ml-auto truncate text-[10px] font-medium opacity-80">{d.label}</span>
        )}
      </div>
      {/* Soft inner gradient for depth */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 rounded-b-2xl bg-gradient-to-t from-white/45 to-transparent"
        aria-hidden
      />
    </div>
  );
};
const GroupNode = memo(GroupNodeImpl);

const nodeTypes = { icon: IconNode, shape: ShapeNode, group: GroupNode };

// ─── Custom labeled edge ──────────────────────────────────────────────────

interface LabeledEdgeData {
  archStyle?: ArchEdgeStyle;
  label?: string;
  /** Auto-assigned playback order index (1-based). Rendered as a chip. */
  step?: number;
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
  const { activeEdgeIds, isPlaying, capturePhase } = useSequence();
  const { setEdges: setFlowEdges, setNodes: setFlowNodes } = useReactFlow();
  const isActive = activeEdgeIds.includes(id);

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
    borderRadius: 12,
  });

  const baseStroke = archStyle === "flow" ? "#0284c7" : "#64748b";
  const stroke = isActive ? "#0891b2" : selected ? "#0284c7" : baseStroke;
  const strokeWidth = isActive ? 3 : selected ? 2.2 : 1.6;
  const dashArray =
    archStyle === "dashed" || archStyle === "flow" || isActive ? "8 4" : undefined;
  // During playback/GIF recording only the current ordered edge moves.
  // Outside playback, "flow" edges retain their ambient animation.
  const animated = isPlaying
    ? isActive && capturePhase === null
    : archStyle === "flow";
  const selectEdge = () => {
    setFlowNodes((current) => current.map((node) => ({ ...node, selected: false })));
    setFlowEdges((current) =>
      current.map((edge) => ({ ...edge, selected: edge.id === id }))
    );
  };

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
          strokeDashoffset:
            isActive && capturePhase !== null
              ? -24 * capturePhase
              : undefined,
          opacity: isPlaying && !isActive ? 0.35 : 1,
          transition: "stroke 120ms ease, stroke-width 120ms ease, opacity 200ms ease",
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute flex cursor-pointer items-center gap-1.5 rounded-lg p-1 outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          role="button"
          tabIndex={0}
          aria-label={`Select connection ${d.step ?? ""} ${d.label ?? ""}`.trim()}
          onClick={(event) => {
            event.stopPropagation();
            selectEdge();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              selectEdge();
            }
          }}
        >
          {typeof d.step === "number" && (
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold shadow-md ${
                isActive
                  ? "border-cyan-600 bg-cyan-600 text-white"
                  : "border-slate-300 bg-white text-sky-700"
              }`}
            >
              {d.step}
            </span>
          )}
          {d.label && (
            <span className="rounded-md border border-slate-200 bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-sm backdrop-blur">
              {d.label}
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
const LabeledEdge = memo(LabeledEdgeImpl);

const edgeTypes = { labeled: LabeledEdge };

// ─── Edge style helpers ──────────────────────────────────────────────────

const DEFAULT_MARKER = { type: MarkerType.ArrowClosed, color: "#64748b", width: 18, height: 18 };
const FLOW_MARKER = { type: MarkerType.ArrowClosed, color: "#0284c7", width: 18, height: 18 };

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
        zIndex: 0,
        selectable: true,
      };
    }
    if (n.kind === "shape") {
      const parentId = n.parentId && groupIds.has(n.parentId) ? n.parentId : undefined;
      return {
        id: n.id,
        type: "shape",
        position: { x: n.x, y: n.y },
        data: { label: n.label, shape: n.shape, subtitle: n.subtitle },
        style: {
          width: n.width ?? 128,
          height: n.height ?? 104,
        },
        zIndex: 2,
        ...(parentId ? { parentId, extent: "parent" as const } : {}),
      };
    }
    const parentId = n.parentId && groupIds.has(n.parentId) ? n.parentId : undefined;
    return {
      id: n.id,
      type: "icon",
      position: { x: n.x, y: n.y },
      data: { label: n.label, iconPath: n.iconPath, iconId: n.iconId, subtitle: n.subtitle },
      zIndex: 2,
      ...(parentId ? { parentId, extent: "parent" as const } : {}),
    };
  });
  const edges: Edge[] = (payload.edges ?? []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: undefined,
    ...edgePropsForStyle(e.style ?? "flow"),
    data: { archStyle: e.style ?? "flow", label: e.label, step: e.step },
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
      if (n.type === "shape") {
        const d = n.data as unknown as ShapeNodeData;
        return {
          kind: "shape",
          id: n.id,
          label: d?.label ?? "",
          shape: d?.shape ?? "rectangle",
          subtitle: d?.subtitle,
          x: n.position.x,
          y: n.position.y,
          width: (n.measured?.width as number | undefined) ?? (n.style?.width as number | undefined),
          height: (n.measured?.height as number | undefined) ?? (n.style?.height as number | undefined),
          ...(n.parentId ? { parentId: n.parentId } : {}),
        };
      }
      const d = n.data as unknown as IconNodeData;
      return {
        kind: "icon",
        id: n.id,
        label: d?.label ?? "",
        iconId: d?.iconId ?? "",
        iconPath: d?.iconPath ?? "",
        subtitle: d?.subtitle,
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
        step: d.step,
      };
    }),
  };
}

// ─── BFS forest traversal for sequence playback ──────────────────────────
// Visits roots first (no incoming edges), then any unvisited node, so
// disconnected cycles still get covered.

function computeEdgePlaybackOrder(nodes: Node[], edges: Edge[]): string[] {
  const hasExplicitOrder = edges.some((edge) => {
    const step = (edge.data as LabeledEdgeData | undefined)?.step;
    return typeof step === "number" && Number.isFinite(step) && step > 0;
  });
  if (hasExplicitOrder) {
    return edges
      .map((edge, index) => ({
        id: edge.id,
        index,
        step: (edge.data as LabeledEdgeData | undefined)?.step,
      }))
      .sort((a, b) => {
        const aStep = typeof a.step === "number" && a.step > 0 ? a.step : Number.MAX_SAFE_INTEGER;
        const bStep = typeof b.step === "number" && b.step > 0 ? b.step : Number.MAX_SAFE_INTEGER;
        return aStep - bStep || a.index - b.index;
      })
      .map((entry) => entry.id);
  }

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

interface EdgePlaybackFrame {
  step: number;
  edgeIds: string[];
}

function computeEdgePlaybackFrames(nodes: Node[], edges: Edge[]): EdgePlaybackFrame[] {
  const order = computeEdgePlaybackOrder(nodes, edges);
  if (!order.length) return [];
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]));
  const hasExplicitSteps = order.some((id) => {
    const step = (edgeById.get(id)?.data as LabeledEdgeData | undefined)?.step;
    return typeof step === "number" && Number.isFinite(step) && step > 0;
  });
  if (!hasExplicitSteps) {
    return order.map((id, index) => ({ step: index + 1, edgeIds: [id] }));
  }

  const frames = new Map<number, string[]>();
  let fallbackStep =
    edges.reduce((max, edge) => {
      const step = (edge.data as LabeledEdgeData | undefined)?.step;
      return typeof step === "number" && Number.isFinite(step) ? Math.max(max, step) : max;
    }, 0) + 1;
  for (const id of order) {
    const edge = edgeById.get(id);
    const configured = (edge?.data as LabeledEdgeData | undefined)?.step;
    const step =
      typeof configured === "number" && Number.isFinite(configured) && configured > 0
        ? configured
        : fallbackStep++;
    const frame = frames.get(step);
    if (frame) frame.push(id);
    else frames.set(step, [id]);
  }
  return Array.from(frames.entries())
    .sort(([a], [b]) => a - b)
    .map(([step, edgeIds]) => ({ step, edgeIds }));
}

// ─── Inner canvas ────────────────────────────────────────────────────────

const STEP_MS = 700;

const CanvasInner = forwardRef<ArchitectureCanvasHandle, Props>(function CanvasInner(
  { value, onChange, onPlayingChange, onSelectionChange },
  ref
) {
  const [nodes, setNodes] = useState<Node[]>(() => archToFlow(value).nodes);
  const [edges, setEdges] = useState<Edge[]>(() => archToFlow(value).edges);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const defaultEdgeStyle = useRef<ArchEdgeStyle>("flow");

  const past = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const future = useRef<Array<{ nodes: Node[]; edges: Edge[] }>>([]);
  const skipNextSnapshot = useRef(false);

  // Sequence playback (runtime-only).
  const [seq, setSeq] = useState<SequenceState>({
    activeEdgeIds: [],
    isPlaying: false,
    capturePhase: null,
  });
  const seqTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { screenToFlowPosition, getNodesBounds: getFlowNodesBounds } = useReactFlow();

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
      requestAnimationFrame(() => {
        setNodes(flow.nodes);
        setEdges(flow.edges);
        requestAnimationFrame(() => rfInstance?.fitView({ padding: 0.2, duration: 400 }));
      });
    }
    // ALWAYS update the key so subsequent local edits (which produce a new
    // value reference but identical counts) don't keep retripping this effect
    // and risking a stale-rehydrate on a future legitimate change.
    lastHydrateKey.current = key;
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
      if (!connection.source || !connection.target || connection.source === connection.target) return;
      const duplicate = edges.some(
        (edge) => edge.source === connection.source && edge.target === connection.target
      );
      if (duplicate) return;
      snapshot();
      const id = `e_${connection.source}_${connection.target}_${Date.now().toString(36)}`;
      const props = edgePropsForStyle(defaultEdgeStyle.current);
      const nextStep =
        edges.reduce((max, edge) => {
          const step = (edge.data as LabeledEdgeData | undefined)?.step;
          return typeof step === "number" && Number.isFinite(step) ? Math.max(max, step) : max;
        }, 0) + 1;
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id,
            ...props,
            data: {
              ...((props.data ?? {}) as object),
              label: "HTTPS",
              step: nextStep,
            },
          },
          eds
        )
      );
    },
    [edges, snapshot]
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
    if (id) {
      window.dispatchEvent(
        new CustomEvent("diagrammatic-drop", {
          detail: { payload: id, clientX: event.clientX, clientY: event.clientY },
        })
      );
      return;
    }
    const shape = event.dataTransfer.getData("application/x-diagrammatic-shape") as ArchShape;
    if (shape) {
      window.dispatchEvent(
        new CustomEvent("diagrammatic-drop-shape", {
          detail: { shape, clientX: event.clientX, clientY: event.clientY },
        })
      );
    }
  }, []);

  // Assign order only to new/unordered edges. Explicit user-defined step
  // values are never normalized or overwritten.
  useEffect(() => {
    const order = computeEdgePlaybackOrder(nodes, edges);
    if (order.length === 0) return;
    const orderedSteps = edges
      .map((edge) => (edge.data as LabeledEdgeData | undefined)?.step)
      .filter((step): step is number => typeof step === "number" && Number.isFinite(step) && step > 0);
    let nextStep = orderedSteps.length ? Math.max(...orderedSteps) + 1 : 1;
    let changed = false;
    const next = edges.map((e) => {
      const have = (e.data as LabeledEdgeData | undefined)?.step;
      if (typeof have === "number" && Number.isFinite(have) && have > 0) return e;
      changed = true;
      const assigned = nextStep;
      nextStep += 1;
      return { ...e, data: { ...(e.data as object), step: assigned } };
    });
    if (changed) {
      skipNextSnapshot.current = true;
      requestAnimationFrame(() => setEdges(next));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges.length, nodes.length, edges.map((e) => `${e.source}>${e.target}`).join("|")]);

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: OnSelectionChangeParams) => {
      const edge = selectedEdges[0];
      if (edge) {
        const d = (edge.data ?? {}) as LabeledEdgeData;
        onSelectionChange?.({
          kind: "edge",
          id: edge.id,
          label: d.label ?? "",
          style: d.archStyle ?? "flow",
          step: d.step,
        });
        return;
      }
      const node = selectedNodes[0];
      if (node) {
        const d = node.data as unknown as IconNodeData & ShapeNodeData & GroupNodeData;
        onSelectionChange?.({
          kind: "node",
          id: node.id,
          label: d.label ?? "",
          nodeKind: node.type === "group" ? "group" : node.type === "shape" ? "shape" : "icon",
          subtitle: d.subtitle,
          tier: d.tier,
        });
        return;
      }
      onSelectionChange?.(null);
    },
    [onSelectionChange]
  );

  // ─── Sequence playback ────────────────────────────────────────────────
  const stopSequence = useCallback(() => {
    if (seqTimer.current) clearTimeout(seqTimer.current);
    seqTimer.current = null;
    setSeq({ activeEdgeIds: [], isPlaying: false, capturePhase: null });
    onPlayingChange?.(false);
  }, [onPlayingChange]);

  const playSequence = useCallback(() => {
    const frames = computeEdgePlaybackFrames(nodes, edges);
    if (frames.length === 0) return;
    if (seqTimer.current) clearTimeout(seqTimer.current);
    onPlayingChange?.(true);
    let i = 0;
    const step = () => {
      if (i >= frames.length) {
        stopSequence();
        return;
      }
      setSeq({
        activeEdgeIds: frames[i].edgeIds,
        isPlaying: true,
        capturePhase: null,
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
            zIndex: 2,
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
            zIndex: 2,
          })
        );
      },
      dropShape: (shape, clientX, clientY) => {
        const pos = screenToFlowPosition({ x: clientX, y: clientY });
        const groupHit = groupAtPosition(pos.x, pos.y);
        snapshot();
        const localPos = groupHit
          ? { x: pos.x - groupHit.position.x - 64, y: pos.y - groupHit.position.y - 52 }
          : { x: pos.x - 64, y: pos.y - 52 };
        setNodes((nds) =>
          nds.concat({
            id: `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            type: "shape",
            position: localPos,
            data: {
              label: shape === "person" ? "Actor" : shape === "internet" ? "Internet" : "Component",
              shape,
            },
            style: { width: 128, height: 104 },
            zIndex: 2,
            ...(groupHit ? { parentId: groupHit.id, extent: "parent" as const } : {}),
          })
        );
      },
      addShapeAtCenter: (shape) => {
        if (!rfInstance) return;
        const center = rfInstance.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        snapshot();
        setNodes((nds) =>
          nds.concat({
            id: `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            type: "shape",
            position: { x: center.x - 64, y: center.y - 52 },
            data: {
              label: shape === "person" ? "Actor" : shape === "internet" ? "Internet" : "Component",
              shape,
            },
            style: { width: 128, height: 104 },
            zIndex: 2,
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
        const removedNodeIds = new Set(
          nodes
            .filter(
              (node) =>
                selNodeIds.has(node.id) ||
                (!!node.parentId && selNodeIds.has(node.parentId))
            )
            .map((node) => node.id)
        );
        snapshot();
        setNodes((nds) => nds.filter((node) => !removedNodeIds.has(node.id)));
        setEdges((eds) =>
          eds.filter(
            (edge) =>
              !selEdgeIds.has(edge.id) &&
              !removedNodeIds.has(edge.source) &&
              !removedNodeIds.has(edge.target)
          )
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
      updateElement: (id, patch) => {
        const node = nodes.find((candidate) => candidate.id === id);
        const edge = edges.find((candidate) => candidate.id === id);
        if (!node && !edge) return;
        snapshot();
        if (node) {
          setNodes((current) =>
            current.map((candidate) =>
              candidate.id === id
                ? {
                    ...candidate,
                    data: {
                      ...candidate.data,
                      ...(patch.label !== undefined ? { label: patch.label } : {}),
                      ...(patch.subtitle !== undefined ? { subtitle: patch.subtitle } : {}),
                    },
                  }
                : candidate
            )
          );
          onSelectionChange?.({
            kind: "node",
            id,
            label: patch.label ?? String(node.data.label ?? ""),
            nodeKind: node.type === "group" ? "group" : node.type === "shape" ? "shape" : "icon",
            subtitle: patch.subtitle ?? (node.data.subtitle as string | undefined),
            tier: node.data.tier as string | undefined,
          });
        }
        if (edge) {
          const currentData = (edge.data ?? {}) as LabeledEdgeData;
          const nextStyle = patch.style ?? currentData.archStyle ?? "flow";
          setEdges((current) =>
            current.map((candidate) =>
              candidate.id === id
                ? {
                    ...candidate,
                    ...edgePropsForStyle(nextStyle),
                    data: {
                      ...(candidate.data as object),
                      ...(patch.label !== undefined ? { label: patch.label } : {}),
                      ...(patch.step !== undefined ? { step: Math.max(1, Math.round(patch.step)) } : {}),
                      archStyle: nextStyle,
                    },
                  }
                : candidate
            )
          );
          onSelectionChange?.({
            kind: "edge",
            id,
            label: patch.label ?? currentData.label ?? "",
            style: nextStyle,
            step: patch.step ?? currentData.step,
          });
        }
      },
      focusElement: (id) => {
        const node = nodes.find((candidate) => candidate.id === id);
        if (!node || !rfInstance) return;
        const absolute = node.parentId
          ? (() => {
              const parent = nodes.find((candidate) => candidate.id === node.parentId);
              return {
                x: node.position.x + (parent?.position.x ?? 0),
                y: node.position.y + (parent?.position.y ?? 0),
              };
            })()
          : node.position;
        rfInstance.setCenter(absolute.x + 64, absolute.y + 52, { zoom: 1.15, duration: 450 });
      },
      getExportBounds: () => {
        const bounds = getFlowNodesBounds(nodes);
        return {
          x: bounds.x,
          y: bounds.y,
          width: Math.max(bounds.width, 320),
          height: Math.max(bounds.height, 220),
        };
      },
      recordSequence: async (onFrame) => {
        const frames = computeEdgePlaybackFrames(nodes, edges);
        if (seqTimer.current) clearTimeout(seqTimer.current);
        // Idle start frame.
        setSeq({ activeEdgeIds: [], isPlaying: true, capturePhase: 0 });
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        await onFrame("start");
        for (const frame of frames) {
          const motionFrames = 6;
          for (let index = 0; index < motionFrames; index += 1) {
            setSeq({
              activeEdgeIds: frame.edgeIds,
              isPlaying: true,
              capturePhase: index / motionFrames,
            });
            await new Promise<void>((r) =>
              requestAnimationFrame(() => requestAnimationFrame(() => r()))
            );
            await onFrame(`step-${frame.step}-motion-${index + 1}-${motionFrames}`);
          }
        }
        // Final idle frame, then reset.
        setSeq({ activeEdgeIds: [], isPlaying: false, capturePhase: null });
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        await onFrame("end");
        return frames.length * 6 + 2;
      },
    }),
    [
      nodes,
      edges,
      rfInstance,
      screenToFlowPosition,
      getFlowNodesBounds,
      snapshot,
      groupAtPosition,
      playSequence,
      stopSequence,
      seq.isPlaying,
      onSelectionChange,
    ]
  );

  return (
    <SequenceCtx.Provider value={seq}>
      <div
        ref={wrapperRef}
        className="architecture-canvas h-full w-full bg-slate-50"
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <ReactFlow
          style={{ backgroundColor: "#f8fafc" }}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={handleSelectionChange}
          onInit={setRfInstance}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={edgePropsForStyle("flow")}
          connectionMode={ConnectionMode.Loose}
          connectionRadius={28}
          autoPanOnConnect={false}
          connectOnClick
          snapToGrid
          snapGrid={[12, 12]}
          minZoom={0.2}
          maxZoom={2.5}
          deleteKeyCode={["Backspace", "Delete"]}
          multiSelectionKeyCode={["Meta", "Control", "Shift"]}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#cbd5e1" />
          <Controls
            showInteractive={false}
            className="!overflow-hidden !rounded-xl !border !border-slate-200 !bg-white !shadow-lg [&>button]:!border-slate-200 [&>button]:!bg-white [&>button]:!text-slate-600 [&>button:hover]:!bg-slate-50"
          />
          <MiniMap
            pannable
            zoomable
            className="!rounded-xl !border !border-slate-200 !bg-white !shadow-lg"
            nodeColor={(n) => (n.type === "group" ? "#cbd5e1" : n.type === "shape" ? "#94a3b8" : "#0284c7")}
            nodeStrokeColor="#e2e8f0"
            maskColor="rgba(226, 232, 240, 0.65)"
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
