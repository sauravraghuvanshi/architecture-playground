/**
 * Canvas — React Flow surface. Handles:
 *  - drop from palette (HTML5 DnD or tap-to-place)
 *  - connect (creates LabeledEdge)
 *  - selection sync to UI context
 *  - keyboard: Esc cancels placement, Delete removes selected, arrow nudges
 *  - group nesting on drop
 */
"use client";

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type ReactFlowInstance,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { ServiceNode } from "./nodes/ServiceNode";
import { GroupNode } from "./nodes/GroupNode";
import { StickyNoteNode } from "./nodes/StickyNoteNode";
import { LabeledEdge } from "./edges/LabeledEdge";
import { usePlaygroundUI } from "./PlaygroundUIContext";
import type { IconManifestEntry } from "./lib/types";

interface DropPayload {
  kind: "service" | "group" | "sticky";
  iconId?: string;
  variant?: string;
}

interface Props {
  nodes: Node[];
  edges: Edge[];
  iconsById: Map<string, IconManifestEntry>;
  onNodesChange: (updater: (prev: Node[]) => Node[]) => void;
  onEdgesChange: (updater: (prev: Edge[]) => Edge[]) => void;
  onCommit: () => void;     // call after a semantic change to push history
  registerInstance: (rfi: ReactFlowInstance | null) => void;
  registerViewportEl: (el: HTMLDivElement | null) => void;
  onContextMenu?: (state: { x: number; y: number; nodeId?: string }) => void;
}

const nodeTypes: NodeTypes = {
  service: ServiceNode,
  group: GroupNode,
  sticky: StickyNoteNode,
};

const edgeTypes: EdgeTypes = {
  default: LabeledEdge,
};

const NUDGE = 8;
const NUDGE_FAST = 32;

function CanvasInner({
  nodes, edges, iconsById, onNodesChange, onEdgesChange, onCommit,
  registerInstance, registerViewportEl, onContextMenu,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const rfApi = useReactFlow();
  const { setSelected, placementIconId, setPlacementIconId, announce } = usePlaygroundUI();
  const dragMovedRef = useRef(false);

  useEffect(() => {
    registerViewportEl(wrapperRef.current);
    return () => registerViewportEl(null);
  }, [registerViewportEl]);

  const buildNodeFromPayload = useCallback(
    (payload: DropPayload, position: { x: number; y: number }, parentNode?: Node): Node | null => {
      const id = `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const localPos = parentNode
        ? { x: position.x - parentNode.position.x, y: position.y - parentNode.position.y }
        : position;
      if (payload.kind === "service" && payload.iconId) {
        const icon = iconsById.get(payload.iconId);
        if (!icon) return null;
        return {
          id, type: "service", position: localPos,
          data: { iconId: icon.id, iconPath: icon.path, label: icon.label, cloud: icon.cloud },
          parentId: parentNode?.id, extent: parentNode ? "parent" : undefined,
        };
      }
      if (payload.kind === "group") {
        return {
          id, type: "group", position: localPos,
          data: { label: "", variant: (payload.variant as never) ?? "vpc" },
          width: 280, height: 200, zIndex: -1,
        };
      }
      if (payload.kind === "sticky") {
        return {
          id, type: "sticky", position: localPos,
          data: { label: "Note", color: "#fef9c3" },
          parentId: parentNode?.id, extent: parentNode ? "parent" : undefined,
        };
      }
      return null;
    },
    [iconsById]
  );

  const findGroupAt = useCallback(
    (flowPos: { x: number; y: number }): Node | undefined => {
      // find smallest group whose bbox contains the point (so nested groups work)
      const candidates = nodes.filter((n) => n.type === "group").filter((g) => {
        const w = g.width ?? 280;
        const h = g.height ?? 200;
        return (
          flowPos.x >= g.position.x && flowPos.x <= g.position.x + w &&
          flowPos.y >= g.position.y && flowPos.y <= g.position.y + h
        );
      });
      candidates.sort((a, b) => (a.width ?? 0) * (a.height ?? 0) - (b.width ?? 0) * (b.height ?? 0));
      return candidates[0];
    },
    [nodes]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("application/playground-item");
      if (!raw) return;
      let payload: DropPayload;
      try { payload = JSON.parse(raw); } catch { return; }
      const pos = rfApi.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const parent = payload.kind === "group" ? undefined : findGroupAt(pos);
      const node = buildNodeFromPayload(payload, pos, parent);
      if (!node) return;
      onNodesChange((prev) => [...prev, node]);
      onCommit();
      announce(`${(node.data as { label?: string }).label ?? node.type} added.`);
    },
    [rfApi, findGroupAt, buildNodeFromPayload, onNodesChange, onCommit, announce]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handlePaneClick = useCallback(
    (e: React.MouseEvent) => {
      if (!placementIconId) return;
      const pos = rfApi.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      let payload: DropPayload;
      if (placementIconId === "__sticky__") payload = { kind: "sticky" };
      else if (placementIconId.startsWith("__group__:"))
        payload = { kind: "group", variant: placementIconId.split(":")[1] };
      else payload = { kind: "service", iconId: placementIconId };
      const parent = payload.kind === "group" ? undefined : findGroupAt(pos);
      const node = buildNodeFromPayload(payload, pos, parent);
      if (!node) return;
      onNodesChange((prev) => [...prev, node]);
      onCommit();
      announce(`${(node.data as { label?: string }).label ?? node.type} placed.`);
      setPlacementIconId(null);
    },
    [placementIconId, rfApi, findGroupAt, buildNodeFromPayload, onNodesChange, onCommit, announce, setPlacementIconId]
  );

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange((prev) => applyNodeChanges(changes, prev));
      const hasStop = changes.some((c) => (c.type === "position" && c.dragging === false));
      const hasRemove = changes.some((c) => c.type === "remove");
      const hasDimensions = changes.some((c) => c.type === "dimensions" && (c as { resizing?: boolean }).resizing === false);
      if (hasStop && dragMovedRef.current) { onCommit(); dragMovedRef.current = false; }
      if (hasRemove) onCommit();
      if (hasDimensions) onCommit();
      if (changes.some((c) => c.type === "position" && c.dragging === true)) dragMovedRef.current = true;
    },
    [onNodesChange, onCommit]
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChange((prev) => applyEdgeChanges(changes, prev));
      if (changes.some((c) => c.type === "remove")) onCommit();
    },
    [onEdgesChange, onCommit]
  );

  const handleConnect: OnConnect = useCallback(
    (conn) => {
      const id = `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      onEdgesChange((prev) => addEdge({ ...conn, id, type: "default", data: {} }, prev));
      onCommit();
      announce("Connection created.");
    },
    [onEdgesChange, onCommit, announce]
  );

  // Defensive viewport lock during connection drag.
  // Some browsers / extensions appear to pan the viewport mid-drag despite autoPanOnConnect=false,
  // making nodes appear to vanish. We snapshot the viewport on connect-start and restore it
  // on every animation frame until connect-end. Also captures DOM diagnostics when ?debug=1.
  const viewportLockRef = useRef<{ x: number; y: number; zoom: number } | null>(null);
  const lockRafRef = useRef<number | null>(null);

  const isDebug = useCallback(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).has("debug");
  }, []);

  const handleConnectStart = useCallback(() => {
    const vp = rfApi.getViewport();
    viewportLockRef.current = { ...vp };
    if (isDebug()) {
      const nodeEls = document.querySelectorAll(".react-flow__node");
      // eslint-disable-next-line no-console
      console.log("[AP-DEBUG] connect-start", {
        viewport: vp,
        nodeCount: nodeEls.length,
        nodes: Array.from(nodeEls).map((n) => {
          const el = n as HTMLElement;
          const r = el.getBoundingClientRect();
          return {
            id: el.dataset.id,
            transform: el.style.transform,
            opacity: getComputedStyle(el).opacity,
            visibility: getComputedStyle(el).visibility,
            display: getComputedStyle(el).display,
            rect: { x: r.x, y: r.y, w: r.width, h: r.height },
          };
        }),
      });
    }
    const tick = () => {
      const lock = viewportLockRef.current;
      if (!lock) return;
      const cur = rfApi.getViewport();
      if (cur.x !== lock.x || cur.y !== lock.y || cur.zoom !== lock.zoom) {
        if (isDebug()) {
          // eslint-disable-next-line no-console
          console.warn("[AP-DEBUG] viewport drifted during connect — restoring", { from: cur, to: lock });
        }
        rfApi.setViewport(lock);
      }
      lockRafRef.current = requestAnimationFrame(tick);
    };
    lockRafRef.current = requestAnimationFrame(tick);
  }, [rfApi, isDebug]);

  const handleConnectEnd = useCallback(() => {
    if (lockRafRef.current !== null) {
      cancelAnimationFrame(lockRafRef.current);
      lockRafRef.current = null;
    }
    viewportLockRef.current = null;
    if (isDebug()) {
      const nodeEls = document.querySelectorAll(".react-flow__node");
      // eslint-disable-next-line no-console
      console.log("[AP-DEBUG] connect-end", {
        viewport: rfApi.getViewport(),
        nodeCount: nodeEls.length,
      });
    }
  }, [rfApi, isDebug]);

  const handleSelectionChange = useCallback(
    ({ nodes: selN, edges: selE }: { nodes: Node[]; edges: Edge[] }) => {
      setSelected(selN.map((n) => n.id), selE.map((e) => e.id));
    },
    [setSelected]
  );

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && placementIconId) {
        setPlacementIconId(null);
        announce("Placement cancelled.");
      }
      if (e.key === "f" && !e.ctrlKey && !e.metaKey && !isTextField(e.target)) {
        rfApi.fitView({ duration: 300, padding: 0.2 });
      }
      // Arrow-key nudge for selected nodes
      const arrows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      if (arrows.includes(e.key) && !isTextField(e.target)) {
        e.preventDefault();
        const step = e.shiftKey ? NUDGE_FAST : NUDGE;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        onNodesChange((prev) => {
          const hasSel = prev.some((n) => n.selected);
          if (!hasSel) return prev;
          return prev.map((n) =>
            n.selected ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n
          );
        });
        onCommit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placementIconId, setPlacementIconId, rfApi, onNodesChange, onCommit, announce]);

  const defaultEdgeOptions = useMemo(() => ({ type: "default" as const }), []);

  return (
    <div
      ref={wrapperRef}
      className={`relative h-full w-full ${placementIconId ? "cursor-crosshair" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onSelectionChange={handleSelectionChange}
        onPaneClick={handlePaneClick}
        onInit={registerInstance}
        onNodeContextMenu={(e, node) => {
          e.preventDefault();
          onContextMenu?.({ x: e.clientX, y: e.clientY, nodeId: node.id });
        }}
        onPaneContextMenu={(e) => {
          if (e instanceof MouseEvent) {
            e.preventDefault();
            onContextMenu?.({ x: e.clientX, y: e.clientY });
          }
        }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        snapToGrid
        snapGrid={[20, 20]}
        autoPanOnConnect={false}
        autoPanOnNodeDrag={false}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
        className="bg-zinc-50 dark:bg-zinc-950"
      >
        <Background gap={20} color="#cbd5e1" />
        <Controls className="!shadow-none" />
        <MiniMap pannable zoomable className="!bg-white dark:!bg-zinc-900" />
      </ReactFlow>
    </div>
  );
}

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function Canvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
