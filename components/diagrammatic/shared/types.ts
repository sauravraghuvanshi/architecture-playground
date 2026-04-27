/**
 * Shared types for the Diagrammatic workspace.
 *
 * Engine choice (R1):
 *   - "architecture" | "flowchart" | "mindmap" | "sequence" | "er" | "uml"
 *     → maxGraph (Apache-2.0, draw.io's modern engine successor)
 *   - "whiteboard" → Excalidraw (MIT)
 *   - "kanban"     → dnd-kit (MIT)
 *
 * The persisted shape is mode-agnostic at the database boundary — every diagram
 * stores its mode and an opaque JSON payload that only its own engine reads.
 */

export type DiagrammaticMode =
  | "architecture"
  | "flowchart"
  | "mindmap"
  | "sequence"
  | "er"
  | "uml"
  | "whiteboard"
  | "kanban"
  | "c4";

export const MODE_META: Record<
  DiagrammaticMode,
  { label: string; icon: string; tagline: string; engine: "maxgraph" | "excalidraw" | "dndkit" }
> = {
  architecture: { label: "Cloud Architecture", icon: "☁️", tagline: "Drag cloud icons, connect services", engine: "maxgraph" },
  flowchart:    { label: "Flowchart",          icon: "🔀", tagline: "Decision trees and process flows", engine: "maxgraph" },
  mindmap:      { label: "Mind Map",           icon: "🧠", tagline: "Branching ideas from a central node", engine: "maxgraph" },
  sequence:     { label: "Sequence Diagram",   icon: "↔️", tagline: "Lifelines with timed messages", engine: "maxgraph" },
  er:           { label: "ER Diagram",         icon: "🗃️", tagline: "Entities and relationships", engine: "maxgraph" },
  uml:          { label: "UML",                icon: "📐", tagline: "Class, state, activity diagrams", engine: "maxgraph" },
  whiteboard:   { label: "Whiteboard",         icon: "✏️", tagline: "Sketch, freehand, sticky notes", engine: "excalidraw" },
  kanban:       { label: "Kanban Board",       icon: "📋", tagline: "Sprint planning with columns", engine: "dndkit" },
  c4:           { label: "C4 / System",        icon: "🧩", tagline: "Context → Container → Component", engine: "maxgraph" },
};

export interface DiagrammaticDoc {
  mode: DiagrammaticMode;
  /** Engine-specific payload. Opaque to anything outside the mode's own canvas. */
  payload: unknown;
  /** Schema version of the payload — used for future migrations. */
  version: number;
}

export const EMPTY_DOC: Record<DiagrammaticMode, DiagrammaticDoc> = {
  architecture: { mode: "architecture", payload: { nodes: [], edges: [] }, version: 1 },
  flowchart:    { mode: "flowchart",    payload: { nodes: [], edges: [] }, version: 1 },
  mindmap:      { mode: "mindmap",      payload: { nodes: [], edges: [] }, version: 1 },
  sequence:     { mode: "sequence",     payload: { nodes: [], edges: [] }, version: 1 },
  er:           { mode: "er",           payload: { nodes: [], edges: [] }, version: 1 },
  uml:          { mode: "uml",          payload: { nodes: [], edges: [] }, version: 1 },
  whiteboard:   { mode: "whiteboard",   payload: { elements: [], appState: {} }, version: 1 },
  kanban:       { mode: "kanban",       payload: { columns: [] }, version: 1 },
  c4:           { mode: "c4",           payload: { nodes: [], edges: [] }, version: 1 },
};

export interface IconLite {
  id: string;
  cloud: string;
  cloudLabel: string;
  category: string;
  categoryLabel: string;
  label: string;
  path: string; // /cloud-icons/...
}
