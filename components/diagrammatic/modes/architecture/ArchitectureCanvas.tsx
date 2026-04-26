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

export interface ArchEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface ArchPayload {
  nodes: ArchNode[];
  edges: ArchEdge[];
}

export interface ArchitectureCanvasHandle {
  /** Drop a service from the palette at canvas-local coords. */
  dropIcon: (icon: IconLite, clientX: number, clientY: number) => void;
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
          const meta = cell.value && typeof cell.value === "object" ? cell.value : {};
          nodes.push({
            id: cell.id,
            label: meta.label ?? "",
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
              value: { label: n.label, iconId: n.iconId, iconPath: n.iconPath },
              position: [n.x, n.y],
              size: [n.width ?? NODE_W, n.height ?? NODE_H],
              style: nodeStyle(n.iconPath, n.label),
            });
            idMap.set(n.id, v);
          }
          for (const e of payload.edges) {
            const s = idMap.get(e.source);
            const t = idMap.get(e.target);
            if (!s || !t) continue;
            graph.insertEdge({
              parent,
              id: e.id,
              source: s,
              target: t,
              value: e.label ?? "",
              style: edgeStyle(),
            });
          }
        });
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
          const id = `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
          graph.batchUpdate(() => {
            graph.insertVertex({
              parent: graph.getDefaultParent(),
              id,
              value: { label: icon.label, iconId: icon.id, iconPath: icon.path },
              position: [x, y],
              size: [NODE_W, NODE_H],
              style: nodeStyle(icon.path, icon.label),
            });
          });
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

        // Custom HTML rendering for vertex labels: icon on top, label below.
        // maxGraph supports HTML labels which we exploit to render the SVG.
        graph.convertValueToString = (cell: any) => {
          if (!cell?.vertex) return cell?.value ?? "";
          const v = cell.value;
          if (v && typeof v === "object" && v.iconPath) {
            const safe = String(v.label ?? "").replace(/[<>&]/g, (c: string) =>
              ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" } as Record<string, string>)[c]
            );
            return `
              <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:4px;padding:6px;text-align:center;">
                <img src="${v.iconPath}" alt="" style="width:56px;height:56px;object-fit:contain;pointer-events:none;" draggable="false" />
                <div style="font-size:11px;line-height:1.2;color:#e4e4e7;font-weight:500;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${safe}</div>
              </div>`;
          }
          return v?.label ?? "";
        };

        // Echo every committed change back up to React state.
        graph.getDataModel().addListener(InternalEvent.CHANGE, () => {
          if (hydratingRef.current) return;
          onChange(serializeGraph());
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
function nodeStyle(_iconPath: string, _label: string): Record<string, unknown> {
  return {
    shape: "rectangle",
    fillColor: "#18181b",        // zinc-900
    strokeColor: "#3f3f46",       // zinc-700
    strokeWidth: 1,
    rounded: true,
    arcSize: 12,
    fontColor: "#e4e4e7",
    fontSize: 11,
    verticalAlign: "middle",
    align: "center",
    spacing: 6,
    html: 1,
    whiteSpace: "wrap",
    overflow: "hidden",
  };
}

function edgeStyle(): Record<string, unknown> {
  return {
    strokeColor: "#71717a",       // zinc-500
    strokeWidth: 1.5,
    endArrow: "classic",
    endSize: 8,
    rounded: true,
    edgeStyle: "orthogonalEdgeStyle",
    fontColor: "#a1a1aa",
    fontSize: 10,
  };
}
