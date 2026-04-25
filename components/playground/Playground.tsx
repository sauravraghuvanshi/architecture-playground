/**
 * Playground — top-level client component that wires together:
 *   - persisted graph state (nodes/edges) + history reducer
 *   - ephemeral UI context (selection, playback, placement)
 *   - autosave to localStorage
 *   - sequence playback engine
 *   - Palette (left) / Canvas (center) / Inspector (right)
 *   - Toolbar (top) with all actions
 */
"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Edge, Node, ReactFlowInstance } from "@xyflow/react";
import { Toolbar } from "./Toolbar";
import { Palette } from "./Palette";
import { Inspector } from "./Inspector";
import { Outline } from "./Outline";
import { Canvas } from "./Canvas";
import { KeyboardShortcutsPanel } from "./KeyboardShortcutsPanel";
import { PlaygroundUIProvider, usePlaygroundUI } from "./PlaygroundUIContext";
import { useSequencePlayer } from "./hooks/useSequencePlayer";
import { useAutosave, restoreAutosave } from "./hooks/useAutosave";
import {
  historyReducer, initialHistory, snapshotGraph, canUndo, canRedo,
} from "./lib/history";
import { applyAutoSequence, normalizeSequence } from "./lib/sequence";
import { exportGif, exportJson, exportPng, readJsonFile, type GifFrameDriver } from "./lib/export";
import { validateImportedGraph } from "./lib/validate";
import type { IconManifestEntry, PlaygroundGraph, PlaygroundTemplate, Layer, DiagramMetadata } from "./lib/types";
import { DEFAULT_LAYER } from "./lib/types";
import { createServiceRegistry } from "./lib/service-registry";
import { normalizeGraph } from "./lib/migrations";

interface Props {
  icons: IconManifestEntry[];
  templates: PlaygroundTemplate[];
}

const EMPTY_GRAPH: PlaygroundGraph = {
  nodes: [],
  edges: [],
  layers: [{ ...DEFAULT_LAYER }],
  metadata: {},
};

/**
 * Hydrate a stored PlaygroundGraph into React Flow Node[] form by attaching
 * runtime-only fields (e.g. iconPath) that aren't persisted.
 */
function graphToFlow(graph: PlaygroundGraph, iconsById: Map<string, IconManifestEntry>): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = graph.nodes.map((n) => {
    if (n.type === "service") {
      const iconId = (n.data as { iconId: string }).iconId;
      const icon = iconsById.get(iconId);
      const node: Node = {
        id: n.id,
        type: "service",
        position: n.position,
        data: { ...n.data, iconPath: icon?.path } as unknown as Record<string, unknown>,
        parentId: n.parentId,
        extent: n.parentId ? "parent" : undefined,
        ...(n.width ? { width: n.width } : {}),
        ...(n.height ? { height: n.height } : {}),
        ...(n.zIndex !== undefined ? { zIndex: n.zIndex } : {}),
      };
      return node;
    }
    const node: Node = {
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data as unknown as Record<string, unknown>,
      parentId: n.parentId,
      extent: n.parentId ? "parent" : undefined,
      ...(n.width ? { width: n.width } : {}),
      ...(n.height ? { height: n.height } : {}),
      ...(n.zIndex !== undefined ? { zIndex: n.zIndex } : {}),
    };
    return node;
  });
  const edges: Edge[] = graph.edges.map((e) => ({
    id: e.id, source: e.source, target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
    type: "default",
    data: (e.data ?? {}) as unknown as Record<string, unknown>,
  }));
  return { nodes, edges };
}

/** Strip runtime-only fields back to the persisted PlaygroundGraph shape. */
function flowToGraph(nodes: Node[], edges: Edge[], extras?: { layers?: Layer[]; metadata?: DiagramMetadata }): PlaygroundGraph {
  return {
    nodes: nodes.map((n) => {
      const { iconPath, serviceDefinition, ...rest } = (n.data ?? {}) as Record<string, unknown> & { iconPath?: string; serviceDefinition?: unknown };
      void iconPath;
      void serviceDefinition;
      return {
        id: n.id,
        type: (n.type ?? "service") as PlaygroundGraph["nodes"][number]["type"],
        position: { x: n.position.x, y: n.position.y },
        data: rest as unknown as PlaygroundGraph["nodes"][number]["data"],
        parentId: n.parentId,
        width: typeof n.width === "number" ? n.width : undefined,
        height: typeof n.height === "number" ? n.height : undefined,
        zIndex: typeof n.zIndex === "number" ? n.zIndex : undefined,
      };
    }),
    edges: edges.map((e) => ({
      id: e.id, source: e.source, target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
      data: (e.data ?? {}) as PlaygroundGraph["edges"][number]["data"],
    })),
    layers: extras?.layers,
    metadata: extras?.metadata,
  };
}

function PlaygroundShell({ icons, templates }: Props) {
  const iconsById = useMemo(() => new Map(icons.map((i) => [i.id, i])), [icons]);
  const registry = useMemo(() => createServiceRegistry(icons), [icons]);
  void registry; // used in future phases for enriching nodes
  const ui = usePlaygroundUI();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const [{ nodes, edges }, setFlow] = useState<{ nodes: Node[]; edges: Edge[] }>(() => graphToFlow(EMPTY_GRAPH, iconsById));
  // Graph-level extras that persist alongside nodes/edges but aren't part of React Flow state.
  const [graphExtras, setGraphExtras] = useState<{ layers?: Layer[]; metadata?: DiagramMetadata }>({
    layers: EMPTY_GRAPH.layers,
    metadata: EMPTY_GRAPH.metadata,
  });
  const [history, dispatchHistory] = useReducer(historyReducer, EMPTY_GRAPH, initialHistory);
  const rfRef = useRef<ReactFlowInstance | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [restored, setRestored] = useState(false);

  const persistedGraph = useMemo(() => flowToGraph(nodes, edges, graphExtras), [nodes, edges, graphExtras]);
  useAutosave(persistedGraph, restored);

  // Restore autosave on mount (client only).
  useEffect(() => {
    const saved = restoreAutosave();
    if (saved && (saved.nodes.length > 0 || saved.edges.length > 0)) {
      const normalized = normalizeGraph(saved);
      const flow = graphToFlow(normalized, iconsById);
      setFlow(flow); // eslint-disable-line react-hooks/set-state-in-effect -- Intentional: one-time hydration from localStorage on mount
      setGraphExtras({ layers: normalized.layers, metadata: normalized.metadata });
      dispatchHistory({ type: "reset", snapshot: snapshotGraph(normalized) });
      ui.announce("Restored autosaved diagram.");
    }
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push a history snapshot for the current persisted graph.
  const commit = useCallback(() => {
    const snap = snapshotGraph(flowToGraph(nodes, edges, graphExtras));
    dispatchHistory({ type: "push", snapshot: snap });
  }, [nodes, edges, graphExtras]);

  // Apply a snapshot string back into React Flow state.
  const applySnapshot = useCallback((snap: string) => {
    try {
      const parsed = JSON.parse(snap) as PlaygroundGraph;
      setFlow(graphToFlow(parsed, iconsById));
      setGraphExtras({ layers: parsed.layers, metadata: parsed.metadata });
    } catch {
      /* noop */
    }
  }, [iconsById]);

  const handleUndo = useCallback(() => {
    if (!canUndo(history)) return;
    const target = history.past[history.past.length - 1];
    dispatchHistory({ type: "undo" });
    applySnapshot(target);
    ui.announce("Undo");
  }, [history, applySnapshot, ui]);

  const handleRedo = useCallback(() => {
    if (!canRedo(history)) return;
    const target = history.future[0];
    dispatchHistory({ type: "redo" });
    applySnapshot(target);
    ui.announce("Redo");
  }, [history, applySnapshot, ui]);

  const handleClear = useCallback(() => {
    if (nodes.length === 0 && edges.length === 0) return;
    if (!confirm("Clear the canvas? This can be undone.")) return;
    setFlow({ nodes: [], edges: [] });
    setGraphExtras({ layers: EMPTY_GRAPH.layers, metadata: EMPTY_GRAPH.metadata });
    dispatchHistory({ type: "push", snapshot: snapshotGraph(EMPTY_GRAPH) });
    ui.announce("Canvas cleared.");
  }, [nodes.length, edges.length, ui]);

  const handleLoadTemplate = useCallback((id: string) => {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    const normalized = normalizeGraph(tpl.graph);
    const flow = graphToFlow(normalized, iconsById);
    setFlow(flow);
    setGraphExtras({ layers: normalized.layers, metadata: normalized.metadata });
    dispatchHistory({ type: "push", snapshot: snapshotGraph(normalized) });
    ui.announce(`Loaded template ${tpl.name}.`);
    setTimeout(() => rfRef.current?.fitView({ duration: 300, padding: 0.2 }), 50);
  }, [templates, iconsById, ui]);

  const handleImportFile = useCallback(async (file: File) => {
    try {
      const raw = await readJsonFile(file);
      // Accept either a bare graph or our { version, graph } export wrapper.
      const candidate = (raw && typeof raw === "object" && "graph" in (raw as object))
        ? (raw as { graph: unknown }).graph
        : raw;
      const result = validateImportedGraph(candidate, icons);
      if (!result.ok || !result.graph) {
        alert("Import failed:\n" + (result.errors ?? ["unknown error"]).slice(0, 5).join("\n"));
        return;
      }
      setFlow(graphToFlow(result.graph, iconsById));
      setGraphExtras({ layers: result.graph.layers, metadata: result.graph.metadata });
      dispatchHistory({ type: "push", snapshot: snapshotGraph(result.graph) });
      ui.announce(`Imported diagram with ${result.graph.nodes.length} nodes.`);
      setTimeout(() => rfRef.current?.fitView({ duration: 300, padding: 0.2 }), 50);
      if (result.errors?.length) {
        console.warn("Import warnings:", result.errors);
      }
    } catch (err) {
      alert("Could not parse JSON file: " + (err instanceof Error ? err.message : "unknown"));
    }
  }, [icons, iconsById, ui]);

  const handleExportPng = useCallback(async () => {
    if (!viewportRef.current) return;
    const flowEl = viewportRef.current.querySelector(".react-flow") as HTMLElement | null;
    if (!flowEl) return;
    try {
      await exportPng(flowEl);
      ui.announce("PNG downloaded.");
    } catch (err) {
      alert("PNG export failed: " + (err instanceof Error ? err.message : "unknown"));
    }
  }, [ui]);

  const handleExportJsonAction = useCallback(() => {
    exportJson(persistedGraph);
    ui.announce("JSON downloaded.");
  }, [persistedGraph, ui]);

  const handleAutoSequence = useCallback(() => {
    const result = applyAutoSequence(persistedGraph);
    if (!result.ok || !result.graph) {
      alert(result.reason ?? "Could not auto-sequence.");
      return;
    }
    setFlow(graphToFlow(result.graph, iconsById));
    dispatchHistory({ type: "push", snapshot: snapshotGraph(result.graph) });
    ui.announce("Sequence assigned automatically.");
  }, [persistedGraph, iconsById, ui]);

  const sequence = useMemo(() => normalizeSequence(persistedGraph.edges), [persistedGraph.edges]);

  const handleExportGif = useCallback(async () => {
    if (!viewportRef.current) return;
    const flowEl = viewportRef.current.querySelector(".react-flow") as HTMLElement | null;
    if (!flowEl) return;
    if (sequence.totalSteps === 0) {
      alert("Set sequence steps on edges first (or click the wand icon to auto-sequence).");
      return;
    }
    // Pause live playback during capture so the driver fully owns the active state.
    ui.setPlaying(false);
    ui.setExportProgress(0);

    const fps = 12;
    const framesPerStep = 6;       // ~0.5s per step at 12fps
    const idleFrames = 4;
    const totalFrames = Math.min(96, sequence.totalSteps * framesPerStep + idleFrames);

    const driver: GifFrameDriver = {
      totalFrames,
      setFrame: async (i) => {
        const cyclePos = i % (sequence.totalSteps * framesPerStep + idleFrames);
        if (cyclePos >= sequence.totalSteps * framesPerStep) {
          ui.setActive([], []);
          return;
        }
        const stepIdx = Math.floor(cyclePos / framesPerStep);
        const frame = sequence.frames[stepIdx];
        ui.setActive(frame.activeNodeIds, frame.edgeIds);
      },
    };

    try {
      await exportGif(flowEl, driver, {
        fps,
        onProgress: (r) => ui.setExportProgress(r),
      });
      ui.announce("GIF downloaded.");
    } catch (err) {
      alert("GIF export failed: " + (err instanceof Error ? err.message : "unknown"));
    } finally {
      ui.setExportProgress(null);
      ui.setActive([], []);
    }
  }, [sequence, ui]);

  const handleFitView = useCallback(() => rfRef.current?.fitView({ duration: 300, padding: 0.2 }), []);

  const handleNodesChange = useCallback((next: Node[]) => setFlow((s) => ({ ...s, nodes: next })), []);
  const handleEdgesChange = useCallback((next: Edge[]) => setFlow((s) => ({ ...s, edges: next })), []);

  const handleUpdateNode = useCallback((id: string, patch: Partial<Node>) => {
    setFlow((s) => ({
      ...s,
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch, data: { ...n.data, ...(patch.data ?? {}) } } : n)),
    }));
    // Defer commit one tick so the patched state is captured.
    setTimeout(commit, 0);
  }, [commit]);

  const handleUpdateEdge = useCallback((id: string, patch: Partial<Edge>) => {
    setFlow((s) => ({
      ...s,
      edges: s.edges.map((e) => (e.id === id ? { ...e, ...patch, data: { ...(e.data ?? {}), ...(patch.data ?? {}) } } : e)),
    }));
    setTimeout(commit, 0);
  }, [commit]);

  const handleDeleteSelected = useCallback(() => {
    setFlow((s) => ({
      nodes: s.nodes.filter((n) => !ui.selectedNodeIds.includes(n.id)),
      edges: s.edges.filter(
        (e) =>
          !ui.selectedEdgeIds.includes(e.id) &&
          !ui.selectedNodeIds.includes(e.source) &&
          !ui.selectedNodeIds.includes(e.target),
      ),
    }));
    setTimeout(commit, 0);
    ui.setSelected([], []);
  }, [ui, commit]);

  const handleFocusNode = useCallback((id: string) => {
    const node = nodes.find((n) => n.id === id);
    if (!node || !rfRef.current) return;
    rfRef.current.setCenter(node.position.x + 50, node.position.y + 50, { zoom: 1.2, duration: 400 });
    ui.setSelected([id], []);
    setFlow((s) => ({
      ...s,
      nodes: s.nodes.map((n) => ({ ...n, selected: n.id === id })),
    }));
  }, [nodes, ui]);

  // Keyboard shortcuts (page-level)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      const inField = target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if (inField) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      else if ((mod && e.key.toLowerCase() === "y") || (mod && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault(); handleRedo();
      } else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); handleExportJsonAction(); }
      else if (mod && e.key.toLowerCase() === "e") { e.preventDefault(); handleExportPng(); }
      else if (e.key === "?" || (e.shiftKey && e.key === "/")) { e.preventDefault(); setShortcutsOpen((v) => !v); }
      else if (e.key === " ") { e.preventDefault(); ui.setPlaying(!ui.isPlaying); }
      else if (e.key.toLowerCase() === "l" && !mod) { e.preventDefault(); ui.setLoop(!ui.loop); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo, handleRedo, handleExportJsonAction, handleExportPng, ui]);

  // Drive sequence playback (writes into UI context).
  useSequencePlayer(persistedGraph.edges);

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-[600px] w-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <Toolbar
        canUndo={canUndo(history)}
        canRedo={canRedo(history)}
        totalSteps={sequence.totalSteps}
        templates={templates}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        onLoadTemplate={handleLoadTemplate}
        onImportFile={handleImportFile}
        onExportPng={handleExportPng}
        onExportJson={handleExportJsonAction}
        onExportGif={handleExportGif}
        onAutoSequence={handleAutoSequence}
        onFitView={handleFitView}
        onToggleShortcuts={() => setShortcutsOpen((v) => !v)}
      />
      <div className="flex min-h-0 flex-1">
        <Palette icons={icons} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Outline nodes={nodes} edges={edges} onFocusNode={handleFocusNode} />
          <div className="relative min-h-0 flex-1">
            <Canvas
              nodes={nodes}
              edges={edges}
              iconsById={iconsById}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onCommit={commit}
              registerInstance={(rfi) => { rfRef.current = rfi; }}
              registerViewportEl={(el) => { viewportRef.current = el; }}
            />
            {ui.exportProgress !== null && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm">
                <div className="rounded-lg bg-white p-6 text-center shadow-lg dark:bg-zinc-900">
                  <p className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">Encoding GIF…</p>
                  <div className="h-2 w-64 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <div
                      className="h-full bg-brand-500 transition-all"
                      style={{ width: `${Math.round(ui.exportProgress * 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-500">{Math.round(ui.exportProgress * 100)}%</p>
                </div>
              </div>
            )}
          </div>
        </div>
        <Inspector
          nodes={nodes}
          edges={edges}
          onUpdateNode={handleUpdateNode}
          onUpdateEdge={handleUpdateEdge}
          onDeleteSelected={handleDeleteSelected}
        />
      </div>
      <div role="status" aria-live="polite" className="sr-only">{ui.announcement}</div>
      <KeyboardShortcutsPanel open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}

export default function Playground(props: Props) {
  return (
    <PlaygroundUIProvider>
      <PlaygroundShell {...props} />
    </PlaygroundUIProvider>
  );
}
