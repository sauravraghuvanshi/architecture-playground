/**
 * ArchitectureCanvas — maxGraph-powered cloud architecture surface.
 *
 * Why maxGraph (not React Flow):
 *  - The connect-drag bug class in React Flow stems from DOM-event-driven
 *    viewport panning racing the connection gesture. maxGraph owns the entire
 *    rendering surface (SVG inside a single managed div) and routes all input
 *    through its own EventSource — there is no path for an outer wheel/scroll
 *    handler to displace mid-drag.
 *  - Apache-2.0, TypeScript-first, the documented successor to mxGraph
 *    (the engine that powers draw.io). No commercial license trap.
 *
 * Lifecycle:
 *  1. Mount: create Graph instance, install palette drop target, wire
 *     change/connect listeners, hydrate from `value`.
 *  2. Update: when an external `value` prop changes (load/template apply),
 *     re-hydrate inside a single batch.
 *  3. Unmount: dispose the Graph (frees handlers, clears DOM).
 */
"use client";

import { useEffect, useImperativeHandle, useRef, forwardRef, useCallback } from "react";
import type { IconLite } from "../../shared/types";

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
  /** Visual style. `flow` animates a dashed line in the source→target direction. */
  style?: ArchEdgeStyle;
}

export interface ArchPayload {
  nodes: ArchNode[];
  edges: ArchEdge[];
}

export interface ArchitectureCanvasHandle {
  /** Drop a service from the palette at canvas-local coords. */
  dropIcon: (icon: IconLite, clientX: number, clientY: number) => void;
  /** Drop a service at the canvas center (used by click-to-add from palette). */
  addIconAtCenter: (icon: IconLite) => void;
  /** Get the current graph as a plain JSON payload. */
  serialize: () => ArchPayload;
  /** Force re-hydration from an external payload. */
  hydrate: (payload: ArchPayload) => void;
  /** Reset zoom to fit all nodes. */
  fit: () => void;
  /** Delete the currently selected cells. */
  deleteSelection: () => void;
  /** Undo the last graph mutation. */
  undo: () => void;
  /** Redo a previously undone mutation. */
  redo: () => void;
  /** Set the visual style on every edge in the graph. */
  setAllEdgeStyle: (style: ArchEdgeStyle) => void;
}

interface Props {
  value: ArchPayload;
  onChange: (next: ArchPayload) => void;
}

const NODE_W = 120;
const NODE_H = 120;

export const ArchitectureCanvas = forwardRef<ArchitectureCanvasHandle, Props>(
  function ArchitectureCanvas({ value, onChange }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    // Lazily-loaded maxGraph runtime objects. Stored in refs so callbacks see
    // the same instance across renders without re-init.
    const graphRef = useRef<any>(null);
    const undoManagerRef = useRef<any>(null);
    // Suppress onChange echoes while we're hydrating from the value prop.
    const hydratingRef = useRef(false);
    // Default style applied to user-drawn edges (connect-drag). Starts as
    // `flow` so the first edge already animates without any extra click.
    const defaultEdgeStyleRef = useRef<ArchEdgeStyle>("flow");

    // ─── Serialize current graph state to plain JSON ────────────────────
    const serializeGraph = useCallback((): ArchPayload => {
      const graph = graphRef.current;
      if (!graph) return { nodes: [], edges: [] };
      const model = graph.getDataModel();
      const cells = model.cells ?? {};
      const nodes: ArchNode[] = [];
      const edges: ArchEdge[] = [];
      for (const id of Object.keys(cells)) {
        const cell = cells[id];
        if (!cell?.id || cell.id === "0" || cell.id === "1") continue;
        if (cell.vertex) {
          const geo = cell.geometry;
          // Cell value is the label string. Icon metadata lives on cell.dgMeta.
          const meta = (cell as any).dgMeta ?? {};
          const labelStr = typeof cell.value === "string" ? cell.value : meta.label ?? "";
          nodes.push({
            id: cell.id,
            label: labelStr,
            iconId: meta.iconId ?? "",
            iconPath: meta.iconPath ?? "",
            x: geo?.x ?? 0,
            y: geo?.y ?? 0,
            width: geo?.width ?? NODE_W,
            height: geo?.height ?? NODE_H,
          });
        } else if (cell.edge) {
          const labelVal = typeof cell.value === "string" ? cell.value : cell.value?.label ?? "";
          edges.push({
            id: cell.id,
            source: cell.source?.id ?? "",
            target: cell.target?.id ?? "",
            label: labelVal,
            style: ((cell as any).dgEdgeStyle as ArchEdgeStyle | undefined) ?? "solid",
          });
        }
      }
      return { nodes, edges };
    }, []);

    // ─── Hydrate from a payload (replaces all cells inside one batch) ──
    const hydrateGraph = useCallback((payload: ArchPayload) => {
      const graph = graphRef.current;
      if (!graph) return;
      hydratingRef.current = true;
      try {
        const parent = graph.getDefaultParent();
        graph.batchUpdate(() => {
          // Wipe everything except the root cells.
          const model = graph.getDataModel();
          const all = graph.getChildCells(parent, true, true);
          model.beginUpdate();
          try {
            for (const c of all) graph.removeCells([c], true);
          } finally {
            model.endUpdate();
          }
          const idMap = new Map<string, any>();
          for (const n of payload.nodes) {
            const v = graph.insertVertex({
              parent,
              id: n.id,
              value: n.label ?? "",
              position: [n.x, n.y],
              size: [n.width ?? NODE_W, n.height ?? NODE_H],
              style: nodeStyle(n.iconPath),
            });
            (v as any).dgMeta = { label: n.label, iconId: n.iconId, iconPath: n.iconPath };
            idMap.set(n.id, v);
          }
          for (const e of payload.edges) {
            const s = idMap.get(e.source);
            const t = idMap.get(e.target);
            if (!s || !t) continue;
            const style: ArchEdgeStyle = e.style ?? "solid";
            const cell = graph.insertEdge({
              parent,
              id: e.id,
              source: s,
              target: t,
              value: e.label ?? "",
              style: edgeStyle(style),
            });
            (cell as any).dgEdgeStyle = style;
          }
        });
        // Apply CSS animation classes for flow-styled edges (after batch commit
        // so the DOM is in place).
        requestAnimationFrame(() => applyEdgeFlowClasses(graph));
      } finally {
        hydratingRef.current = false;
      }
    }, []);

    // ─── Imperative handle for parent (palette drop, toolbar actions) ───
    useImperativeHandle(
      ref,
      () => ({
        dropIcon: (icon, clientX, clientY) => {
          const graph = graphRef.current;
          const container = containerRef.current;
          if (!graph || !container) return;
          const rect = container.getBoundingClientRect();
          const view = graph.getView();
          const scale = view.getScale();
          const tx = view.getTranslate();
          // Convert client (page) coords to graph coords.
          const x = (clientX - rect.left) / scale - tx.x - NODE_W / 2;
          const y = (clientY - rect.top) / scale - tx.y - NODE_H / 2;
          insertIconAt(graph, icon, x, y);
        },
        addIconAtCenter: (icon) => {
          const graph = graphRef.current;
          const container = containerRef.current;
          if (!graph || !container) return;
          const rect = container.getBoundingClientRect();
          const view = graph.getView();
          const scale = view.getScale();
          const tx = view.getTranslate();
          // Place at the visible viewport center, with a small jitter so
          // multiple clicks don't perfectly overlap.
          const cx = rect.width / 2;
          const cy = rect.height / 2;
          const jitter = (Math.random() - 0.5) * 60;
          const x = cx / scale - tx.x - NODE_W / 2 + jitter;
          const y = cy / scale - tx.y - NODE_H / 2 + jitter;
          insertIconAt(graph, icon, x, y);
        },
        serialize: serializeGraph,
        hydrate: hydrateGraph,
        fit: () => graphRef.current?.fit?.(),
        deleteSelection: () => {
          const g = graphRef.current;
          if (!g) return;
          const sel = g.getSelectionCells?.() ?? [];
          if (sel.length) g.removeCells(sel);
        },
        undo: () => undoManagerRef.current?.undo?.(),
        redo: () => undoManagerRef.current?.redo?.(),
        setAllEdgeStyle: (style) => {
          const g = graphRef.current;
          if (!g) return;
          defaultEdgeStyleRef.current = style;
          const model = g.getDataModel();
          const cells = model.cells ?? {};
          g.batchUpdate(() => {
            for (const id of Object.keys(cells)) {
              const cell = cells[id];
              if (!cell?.edge) continue;
              const styleStr = stringifyStyle(edgeStyle(style));
              model.setStyle(cell, styleStr);
              (cell as any).dgEdgeStyle = style;
            }
          });
          requestAnimationFrame(() => applyEdgeFlowClasses(g));
        },
      }),
      [serializeGraph, hydrateGraph]
    );

    // ─── Mount: build the graph ─────────────────────────────────────────
    useEffect(() => {
      let disposed = false;
      let graph: any = null;

      // Dynamic import — maxGraph is ESM-only and pulls SVG/DOM, so it must
      // not run during SSR. The component file itself is `"use client"` but
      // `import` at the top would still be executed at build time.
      (async () => {
        const mx = await import("@maxgraph/core");
        if (disposed || !containerRef.current) return;
        const container = containerRef.current;

        const { Graph, RubberBandHandler, InternalEvent, EventObject, UndoManager } = mx as any;

        graph = new Graph(container);
        graph.setPanning(true);                 // middle-mouse / space-drag pan
        graph.setConnectable(true);             // allow drawing edges between vertices
        graph.setCellsEditable(true);           // double-click label edit
        graph.setHtmlLabels(true);
        graph.setMultigraph(true);
        graph.setAllowDanglingEdges(false);
        graph.gridSize = 10;
        graph.setGridEnabled(true);
        graph.setTooltips(true);

        // Rubber-band selection — drag on empty space to box-select.
        new RubberBandHandler(graph);

        // Undo / redo wiring.
        const undoManager = new UndoManager(50);
        const undoListener = (_sender: any, evt: any) => {
          undoManager.undoableEditHappened(evt.getProperty("edit"));
        };
        graph.getDataModel().addListener(InternalEvent.UNDO, undoListener);
        graph.getView().addListener(InternalEvent.UNDO, undoListener);
        undoManagerRef.current = undoManager;

        // Custom HTML rendering for vertex labels: maxGraph natively handles
        // image+label via the `image` style + `verticalAlign: 'bottom'` combo
        // so we no longer override convertValueToString. Cell value = label.

        // Echo every committed change back up to React state.
        graph.getDataModel().addListener(InternalEvent.CHANGE, () => {
          if (hydratingRef.current) return;
          // Apply the current default style to any newly-added edge that
          // doesn't yet carry a dgEdgeStyle marker (i.e. user-drawn via
          // connect-drag). This is what makes user-drawn edges animate too.
          try {
            const model = graph.getDataModel();
            const cells = model.cells ?? {};
            const defaultStyle = defaultEdgeStyleRef.current;
            graph.batchUpdate(() => {
              for (const id of Object.keys(cells)) {
                const cell = cells[id];
                if (!cell?.edge) continue;
                if ((cell as any).dgEdgeStyle) continue;
                const styleStr = stringifyStyle(edgeStyle(defaultStyle));
                model.setStyle(cell, styleStr);
                (cell as any).dgEdgeStyle = defaultStyle;
              }
            });
          } catch {
            /* swallow; render path is best-effort */
          }
          onChange(serializeGraph());
          // New edges may have just been styled — ensure the CSS class for
          // flow animation is reapplied to the freshly-rendered SVG paths.
          requestAnimationFrame(() => applyEdgeFlowClasses(graph));
        });

        // Suppress browser context menu so right-click is available for us later.
        InternalEvent.disableContextMenu(container);

        graphRef.current = graph;

        // Initial hydration from props.
        hydrateGraph(value);
      })();

      return () => {
        disposed = true;
        try {
          graph?.destroy?.();
        } catch {
          /* maxGraph destroy may throw during HMR; safe to ignore. */
        }
        graphRef.current = null;
        undoManagerRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Re-hydrate when `value` changes from the outside (load / reset) ─
    // We compare by reference; parent should pass a new object only on real
    // external changes (template apply, server reload), not on every keystroke.
    const lastValueRef = useRef(value);
    useEffect(() => {
      if (lastValueRef.current === value) return;
      lastValueRef.current = value;
      if (graphRef.current) hydrateGraph(value);
    }, [value, hydrateGraph]);

    // ─── Keyboard: Delete to remove selection, Ctrl+Z / Ctrl+Y for history ──
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea") return;
        if (e.key === "Delete" || e.key === "Backspace") {
          const g = graphRef.current;
          const sel = g?.getSelectionCells?.() ?? [];
          if (sel.length) {
            e.preventDefault();
            g.removeCells(sel);
          }
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
          e.preventDefault();
          if (e.shiftKey) undoManagerRef.current?.redo?.();
          else undoManagerRef.current?.undo?.();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
          e.preventDefault();
          undoManagerRef.current?.redo?.();
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, []);

    return (
      <div
        ref={containerRef}
        className="relative h-full w-full overflow-hidden bg-zinc-950"
        style={{ touchAction: "none" }}
        // Native HTML5 drop target — palette uses dataTransfer + we look up the
        // icon by id on drop. Done at this level so we don't need to bridge
        // into maxGraph's gesture system.
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          // The Workspace listens for this and re-dispatches via dropIcon().
          // We bubble a custom event with client coords so the parent (which
          // owns the palette) can resolve the icon id without a tight coupling.
          const detail = {
            payload: e.dataTransfer.getData("application/x-diagrammatic-icon"),
            clientX: e.clientX,
            clientY: e.clientY,
          };
          containerRef.current?.dispatchEvent(
            new CustomEvent("diagrammatic-drop", { detail, bubbles: true })
          );
        }}
      />
    );
  }
);

// ─── Style helpers ────────────────────────────────────────────────────
function nodeStyle(iconPath: string): Record<string, unknown> {
  // Native maxGraph rendering: the cell is a rounded rectangle with the icon
  // image drawn inside (top-aligned) and the label rendered at the bottom.
  // No HTML override — labels render reliably regardless of value coercion.
  return {
    shape: "rectangle",
    fillColor: "#18181b",        // zinc-900
    strokeColor: "#3f3f46",       // zinc-700
    strokeWidth: 1,
    rounded: 1,
    arcSize: 14,
    image: iconPath,
    imageWidth: 56,
    imageHeight: 56,
    imageAlign: "center",
    imageVerticalAlign: "top",
    verticalAlign: "bottom",      // label sits below the icon
    align: "center",
    spacingTop: 6,
    spacingBottom: 8,
    fontColor: "#e4e4e7",
    fontSize: 11,
    fontStyle: 0,
    whiteSpace: "wrap",
    overflow: "visible",
  };
}

function edgeStyle(style: ArchEdgeStyle = "solid"): Record<string, unknown> {
  const base: Record<string, unknown> = {
    strokeColor: "#a1a1aa",       // zinc-400 — readable on dark canvas
    strokeWidth: 1.6,
    endArrow: "classic",
    endSize: 8,
    rounded: true,
    edgeStyle: "orthogonalEdgeStyle",
    fontColor: "#d4d4d8",
    fontSize: 10,
  };
  if (style === "dashed") {
    base.dashed = 1;
    base.dashPattern = "6 4";
  } else if (style === "flow") {
    base.dashed = 1;
    base.dashPattern = "8 4";
    base.strokeColor = "#bef264"; // lime-300 — pops on dark, matches accent
    base.strokeWidth = 2;
  }
  return base;
}

/** Stringify a maxGraph style object the way the engine expects via setStyle. */
function stringifyStyle(s: Record<string, unknown>): string {
  return Object.entries(s)
    .map(([k, v]) => `${k}=${v}`)
    .join(";");
}

/**
 * Insert a vertex carrying icon metadata. Shared by drag-drop and click-to-add.
 */
function insertIconAt(graph: any, icon: IconLite, x: number, y: number): void {
  const id = `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  graph.batchUpdate(() => {
    const v = graph.insertVertex({
      parent: graph.getDefaultParent(),
      id,
      value: icon.label,
      position: [x, y],
      size: [NODE_W, NODE_H],
      style: nodeStyle(icon.path),
    });
    (v as any).dgMeta = { label: icon.label, iconId: icon.id, iconPath: icon.path };
  });
}

/**
 * Walk the rendered SVG and toggle the `dg-flow` class on edge paths so the
 * global CSS animation kicks in. Idempotent — safe to call after every change.
 */
function applyEdgeFlowClasses(graph: any): void {
  try {
    const model = graph.getDataModel();
    const cells = model.cells ?? {};
    for (const id of Object.keys(cells)) {
      const cell = cells[id];
      if (!cell?.edge) continue;
      const state = graph.getView().getState(cell);
      const node: SVGElement | undefined = state?.shape?.node;
      if (!node) continue;
      const wantsFlow = (cell as any).dgEdgeStyle === "flow";
      if (wantsFlow) node.classList.add("dg-flow");
      else node.classList.remove("dg-flow");
    }
  } catch {
    /* ignore — DOM may not yet be ready */
  }
}
