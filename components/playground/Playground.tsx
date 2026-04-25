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
import { ContextMenu, type ContextMenuState } from "./ContextMenu";
import { CommandPalette, buildCommands } from "./CommandPalette";
import { PlaygroundUIProvider, usePlaygroundUI } from "./PlaygroundUIContext";
import { useSequencePlayer } from "./hooks/useSequencePlayer";
import { useAutosave, restoreAutosave } from "./hooks/useAutosave";
import {
  historyReducer, initialHistory, snapshotGraph, canUndo, canRedo,
} from "./lib/history";
import { applyAutoSequence, normalizeSequence } from "./lib/sequence";
import { exportGif, exportJson, exportPng, readJsonFile, type GifFrameDriver } from "./lib/export";
import { exportSvg, exportPngHighDpi, exportMermaid } from "./lib/export-extra";
import { exportDrawio, readDrawioFile } from "./lib/export-drawio";
import { IacExportModal } from "./IacExportModal";
import { AiAssistPanel } from "./AiAssistPanel";
import { validateImportedGraph } from "./lib/validate";
import type { IconManifestEntry, PlaygroundGraph, PlaygroundTemplate, Layer, DiagramMetadata } from "./lib/types";
import { DEFAULT_LAYER } from "./lib/types";
import { createServiceRegistry } from "./lib/service-registry";
import { normalizeGraph } from "./lib/migrations";
import { resolveGraphIcons } from "./lib/resolve-icons";

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
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [clipboard, setClipboard] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);

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

  // Restore autosave OR template handoff (from /templates gallery) on mount.
  useEffect(() => {
    // Template gallery handoff takes precedence over autosave.
    let usedHandoff = false;
    try {
      const HANDOFF_KEY = "architecture-playground:template-handoff";
      const raw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(HANDOFF_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as { id?: string; name?: string; graph?: PlaygroundGraph };
        if (parsed.graph && Array.isArray(parsed.graph.nodes)) {
          const normalized = normalizeGraph(parsed.graph);
          const flow = graphToFlow(normalized, iconsById);
          setFlow(flow); // eslint-disable-line react-hooks/set-state-in-effect -- one-time hydration
          setGraphExtras({ layers: normalized.layers, metadata: normalized.metadata });
          dispatchHistory({ type: "reset", snapshot: snapshotGraph(normalized) });
          ui.announce(`Loaded template ${parsed.name ?? parsed.id ?? ""}`.trim());
          usedHandoff = true;
        }
        sessionStorage.removeItem(HANDOFF_KEY);
      }
    } catch {
      /* ignore */
    }

    if (!usedHandoff) {
      const saved = restoreAutosave();
      if (saved && (saved.nodes.length > 0 || saved.edges.length > 0)) {
        const normalized = normalizeGraph(saved);
        const flow = graphToFlow(normalized, iconsById);
        setFlow(flow); // eslint-disable-line react-hooks/set-state-in-effect -- Intentional: one-time hydration from localStorage on mount
        setGraphExtras({ layers: normalized.layers, metadata: normalized.metadata });
        dispatchHistory({ type: "reset", snapshot: snapshotGraph(normalized) });
        ui.announce("Restored autosaved diagram.");
      }
    }
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const graphExtrasRef = useRef(graphExtras);
  graphExtrasRef.current = graphExtras;

  // Push a history snapshot for the current persisted graph.
  // Reads latest state via the setFlow updater so it can't capture
  // a stale `nodes`/`edges` closure when called immediately after
  // another setFlow update (e.g. handleConnect → commit in same tick).
  const commit = useCallback(() => {
    setFlow((s) => {
      const snap = snapshotGraph(flowToGraph(s.nodes, s.edges, graphExtrasRef.current));
      queueMicrotask(() => dispatchHistory({ type: "push", snapshot: snap }));
      return s;
    });
  }, []);

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
      const isDrawio = /\.(drawio|xml)$/i.test(file.name) || file.type.includes("xml");
      if (isDrawio) {
        const graph = await readDrawioFile(file);
        const normalized = normalizeGraph(graph);
        setFlow(graphToFlow(normalized, iconsById));
        setGraphExtras({ layers: normalized.layers, metadata: normalized.metadata });
        dispatchHistory({ type: "push", snapshot: snapshotGraph(normalized) });
        ui.announce(`Imported draw.io diagram with ${normalized.nodes.length} nodes.`);
        setTimeout(() => rfRef.current?.fitView({ duration: 300, padding: 0.2 }), 50);
        return;
      }
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

  const [iacModalOpen, setIacModalOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((j: { configured?: boolean }) => {
        if (cancelled) return;
        // Defer setState to next tick to avoid cascading renders.
        queueMicrotask(() => { if (!cancelled) setAiAvailable(!!j.configured); });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const handleApplyAiGraph = useCallback((g: PlaygroundGraph) => {
    const normalized = normalizeGraph(g);
    resolveGraphIcons(normalized, icons, iconsById);
    setFlow(graphToFlow(normalized, iconsById));
    setGraphExtras({ layers: normalized.layers, metadata: normalized.metadata });
    dispatchHistory({ type: "push", snapshot: snapshotGraph(normalized) });
    ui.announce(`AI generated diagram with ${normalized.nodes.length} nodes.`);
    setTimeout(() => rfRef.current?.fitView({ duration: 300, padding: 0.2 }), 50);
  }, [icons, iconsById, ui]);

  const handleExportFormat = useCallback(
    async (format: "svg" | "png-2x" | "png-4x" | "mermaid" | "drawio" | "iac") => {
      try {
        if (format === "iac") {
          setIacModalOpen(true);
          return;
        }
        if (format === "mermaid") {
          exportMermaid(persistedGraph);
          ui.announce("Mermaid downloaded.");
          return;
        }
        if (format === "drawio") {
          exportDrawio(persistedGraph);
          ui.announce("draw.io XML downloaded.");
          return;
        }
        if (!viewportRef.current) return;
        const flowEl = viewportRef.current.querySelector(".react-flow") as HTMLElement | null;
        if (!flowEl) return;
        if (format === "svg") {
          await exportSvg(flowEl);
          ui.announce("SVG downloaded.");
          return;
        }
        if (format === "png-2x") {
          await exportPngHighDpi(flowEl, 2);
          ui.announce("PNG 2x downloaded.");
          return;
        }
        if (format === "png-4x") {
          await exportPngHighDpi(flowEl, 4);
          ui.announce("PNG 4x downloaded.");
          return;
        }
      } catch (err) {
        alert("Export failed: " + (err instanceof Error ? err.message : "unknown"));
      }
    },
    [persistedGraph, ui]
  );

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

  const handleNodesChange = useCallback((updater: (prev: Node[]) => Node[]) => setFlow((s) => ({ ...s, nodes: updater(s.nodes) })), []);
  const handleEdgesChange = useCallback((updater: (prev: Edge[]) => Edge[]) => setFlow((s) => ({ ...s, edges: updater(s.edges) })), []);

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

  // Copy, paste, duplicate
  const handleCopy = useCallback(() => {
    const selNodes = nodes.filter((n) => n.selected);
    if (selNodes.length === 0) return;
    const selNodeIds = new Set(selNodes.map((n) => n.id));
    const selEdges = edges.filter((e) => selNodeIds.has(e.source) && selNodeIds.has(e.target));
    setClipboard({ nodes: selNodes, edges: selEdges });
    ui.announce(`Copied ${selNodes.length} node(s).`);
  }, [nodes, edges, ui]);

  const handlePaste = useCallback(() => {
    if (!clipboard || clipboard.nodes.length === 0) return;
    const idMap = new Map<string, string>();
    const newNodes = clipboard.nodes.map((n) => {
      const newId = `${n.id}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
      idMap.set(n.id, newId);
      return { ...n, id: newId, position: { x: n.position.x + 40, y: n.position.y + 40 }, selected: true };
    });
    const newEdges = clipboard.edges.map((e) => ({
      ...e,
      id: `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      source: idMap.get(e.source) ?? e.source,
      target: idMap.get(e.target) ?? e.target,
    }));
    setFlow((s) => ({
      nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), ...newNodes],
      edges: [...s.edges, ...newEdges],
    }));
    commit();
    ui.announce(`Pasted ${newNodes.length} node(s).`);
  }, [clipboard, commit, ui]);

  const handleDuplicate = useCallback(() => {
    handleCopy();
    // Schedule paste on next tick so clipboard is updated
    setTimeout(() => {
      const selNodes = nodes.filter((n) => n.selected);
      if (selNodes.length === 0) return;
      const selNodeIds = new Set(selNodes.map((n) => n.id));
      const selEdges = edges.filter((e) => selNodeIds.has(e.source) && selNodeIds.has(e.target));
      const idMap = new Map<string, string>();
      const newNodes = selNodes.map((n) => {
        const newId = `${n.id}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
        idMap.set(n.id, newId);
        return { ...n, id: newId, position: { x: n.position.x + 40, y: n.position.y + 40 }, selected: true };
      });
      const newEdges = selEdges.map((e) => ({
        ...e,
        id: `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        source: idMap.get(e.source) ?? e.source,
        target: idMap.get(e.target) ?? e.target,
      }));
      setFlow((s) => ({
        nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), ...newNodes],
        edges: [...s.edges, ...newEdges],
      }));
      commit();
      ui.announce(`Duplicated ${newNodes.length} node(s).`);
    }, 0);
  }, [nodes, edges, commit, ui, handleCopy]);

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
      else if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); setCommandPaletteOpen((v) => !v); }
      else if (mod && e.key.toLowerCase() === "c") { e.preventDefault(); handleCopy(); }
      else if (mod && e.key.toLowerCase() === "v") { e.preventDefault(); handlePaste(); }
      else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); handleDuplicate(); }
      else if (e.key === "?" || (e.shiftKey && e.key === "/")) { e.preventDefault(); setShortcutsOpen((v) => !v); }
      else if (e.key === " ") { e.preventDefault(); ui.setPlaying(!ui.isPlaying); }
      else if (e.key.toLowerCase() === "l" && !mod) { e.preventDefault(); ui.setLoop(!ui.loop); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo, handleRedo, handleExportJsonAction, handleExportPng, handleCopy, handlePaste, handleDuplicate, ui]);

  // Drive sequence playback (writes into UI context).
  useSequencePlayer(persistedGraph.edges);

  // Build command palette commands (not memoized since it depends on many callbacks)
  // eslint-disable-next-line react-hooks/refs -- callbacks capture refs but don't read them during render
  const commands = buildCommands({
    onUndo: handleUndo,
    onRedo: handleRedo,
    onClear: handleClear,
    onExportPng: handleExportPng,
    onExportJson: handleExportJsonAction,
    onExportGif: handleExportGif,
    onAutoSequence: handleAutoSequence,
    onFitView: handleFitView,
    onToggleShortcuts: () => setShortcutsOpen((v) => !v),
    onTogglePlay: () => ui.setPlaying(!ui.isPlaying),
    onToggleLoop: () => ui.setLoop(!ui.loop),
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    isPlaying: ui.isPlaying,
    totalSteps: sequence.totalSteps,
  });

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
        onExportFormat={handleExportFormat}
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
              onContextMenu={(state) => setContextMenu(state)}
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
      <IacExportModal graph={persistedGraph} open={iacModalOpen} onClose={() => setIacModalOpen(false)} />
      {aiAvailable && (
        <>
          <button
            type="button"
            onClick={() => setAiPanelOpen((v) => !v)}
            className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-indigo-500"
            aria-label="Toggle AI Assist"
          >
            ✨ AI Assist
          </button>
          <AiAssistPanel
            graph={persistedGraph}
            open={aiPanelOpen}
            onClose={() => setAiPanelOpen(false)}
            onApplyGenerated={handleApplyAiGraph}
          />
        </>
      )}
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} commands={commands} />
      <ContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
        onDuplicate={handleDuplicate}
        onDelete={handleDeleteSelected}
        onGroup={() => { /* P2 group creation - placeholder */ }}
        onAddNote={(x, y) => {
          const id = `sticky_${Date.now().toString(36)}`;
          setFlow((s) => ({
            ...s,
            nodes: [...s.nodes, { id, type: "sticky", position: { x, y }, data: { label: "Note" } }],
          }));
          commit();
        }}
        onPaste={handlePaste}
        onFitView={handleFitView}
        hasClipboard={clipboard !== null}
      />
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
