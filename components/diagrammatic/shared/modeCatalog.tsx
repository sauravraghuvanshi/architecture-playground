/**
 * Mode registry — central catalog of every non-architecture Diagrammatic
 * mode's canvas component, default payload, and capability flags.
 *
 * Architecture mode is NOT included here because its toolbar / canvas /
 * exporter are richer than the BaseCanvasHandle shape — Workspace handles
 * the architecture branch directly and falls back to this registry for
 * everything else.
 */
"use client";

import dynamic from "next/dynamic";
import type { ComponentType, ForwardRefExoticComponent, RefAttributes } from "react";
import type { BaseCanvasHandle, ModeCapabilities, ModeTemplate } from "./modeRegistry";
import type { DiagrammaticMode } from "./types";

import { SEQUENCE_DEFAULT_PAYLOAD, FLOWCHART_DEFAULT_PAYLOAD, MINDMAP_DEFAULT_PAYLOAD, ER_DEFAULT_PAYLOAD, UML_DEFAULT_PAYLOAD, C4_DEFAULT_PAYLOAD, WHITEBOARD_DEFAULT_PAYLOAD, KANBAN_DEFAULT_PAYLOAD } from "./modeDefaults";
import { FLOWCHART_TEMPLATES } from "../modes/flowchart/templates";
import { MINDMAP_TEMPLATES } from "../modes/mindmap/templates";
import { SEQUENCE_TEMPLATES } from "../modes/sequence/templates";
import { ER_TEMPLATES } from "../modes/er/templates";
import { UML_TEMPLATES } from "../modes/uml/templates";
import { C4_TEMPLATES } from "../modes/c4/templates";
import { WHITEBOARD_TEMPLATES } from "../modes/whiteboard/templates";
import { KANBAN_TEMPLATES } from "../modes/kanban/templates";

export interface ModeCanvasProps<P = unknown> {
  value: P;
  onChange?: (next: P) => void;
}

export type ModeCanvasComponent = ForwardRefExoticComponent<
  ModeCanvasProps & RefAttributes<BaseCanvasHandle>
>;

// All non-architecture canvases use React Flow / Excalidraw / dnd-kit which
// touch `window` — so dynamic-load them with `ssr: false`.
const SequenceCanvas = dynamic(
  () => import("../modes/sequence/Canvas").then((m) => m.SequenceCanvas as unknown as ComponentType),
  { ssr: false, loading: () => <ModeLoading /> }
) as unknown as ModeCanvasComponent;

const FlowchartCanvas = dynamic(
  () => import("../modes/flowchart/Canvas").then((m) => m.FlowchartCanvas as unknown as ComponentType),
  { ssr: false, loading: () => <ModeLoading /> }
) as unknown as ModeCanvasComponent;

const MindMapCanvas = dynamic(
  () => import("../modes/mindmap/Canvas").then((m) => m.MindMapCanvas as unknown as ComponentType),
  { ssr: false, loading: () => <ModeLoading /> }
) as unknown as ModeCanvasComponent;

const ERCanvas = dynamic(
  () => import("../modes/er/Canvas").then((m) => m.ERCanvas as unknown as ComponentType),
  { ssr: false, loading: () => <ModeLoading /> }
) as unknown as ModeCanvasComponent;

const UMLCanvas = dynamic(
  () => import("../modes/uml/Canvas").then((m) => m.UMLCanvas as unknown as ComponentType),
  { ssr: false, loading: () => <ModeLoading /> }
) as unknown as ModeCanvasComponent;

const C4Canvas = dynamic(
  () => import("../modes/c4/Canvas").then((m) => m.C4Canvas as unknown as ComponentType),
  { ssr: false, loading: () => <ModeLoading /> }
) as unknown as ModeCanvasComponent;

const WhiteboardCanvas = dynamic(
  () => import("../modes/whiteboard/Canvas").then((m) => m.WhiteboardCanvas as unknown as ComponentType),
  { ssr: false, loading: () => <ModeLoading /> }
) as unknown as ModeCanvasComponent;

const KanbanCanvas = dynamic(
  () => import("../modes/kanban/Canvas").then((m) => m.KanbanCanvas as unknown as ComponentType),
  { ssr: false, loading: () => <ModeLoading /> }
) as unknown as ModeCanvasComponent;

function ModeLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-zinc-950 text-sm text-zinc-500">
      Loading canvas…
    </div>
  );
}

export interface ModeRegistryEntry {
  Canvas: ModeCanvasComponent;
  defaultPayload: unknown;
  capabilities: ModeCapabilities;
  templates: ModeTemplate[];
}

/** Architecture is intentionally absent — the Workspace branches on its mode. */
export const MODE_REGISTRY: Partial<Record<DiagrammaticMode, ModeRegistryEntry>> = {
  sequence: {
    Canvas: SequenceCanvas,
    defaultPayload: SEQUENCE_DEFAULT_PAYLOAD,
    capabilities: {},
    templates: SEQUENCE_TEMPLATES,
  },
  flowchart: {
    Canvas: FlowchartCanvas,
    defaultPayload: FLOWCHART_DEFAULT_PAYLOAD,
    capabilities: {},
    templates: FLOWCHART_TEMPLATES,
  },
  mindmap: {
    Canvas: MindMapCanvas,
    defaultPayload: MINDMAP_DEFAULT_PAYLOAD,
    capabilities: {},
    templates: MINDMAP_TEMPLATES,
  },
  er: {
    Canvas: ERCanvas,
    defaultPayload: ER_DEFAULT_PAYLOAD,
    capabilities: {
      textExports: [{ id: "sql", label: "SQL DDL", ext: "sql" }],
    },
    templates: ER_TEMPLATES,
  },
  uml: {
    Canvas: UMLCanvas,
    defaultPayload: UML_DEFAULT_PAYLOAD,
    capabilities: {
      textExports: [{ id: "ts", label: "TypeScript", ext: "ts" }],
    },
    templates: UML_TEMPLATES,
  },
  c4: {
    Canvas: C4Canvas,
    defaultPayload: C4_DEFAULT_PAYLOAD,
    capabilities: {},
    templates: C4_TEMPLATES,
  },
  whiteboard: {
    Canvas: WhiteboardCanvas,
    defaultPayload: WHITEBOARD_DEFAULT_PAYLOAD,
    capabilities: {},
    templates: WHITEBOARD_TEMPLATES,
  },
  kanban: {
    Canvas: KanbanCanvas,
    defaultPayload: KANBAN_DEFAULT_PAYLOAD,
    capabilities: {
      textExports: [{ id: "md", label: "Markdown", ext: "md" }],
    },
    templates: KANBAN_TEMPLATES,
  },
};
