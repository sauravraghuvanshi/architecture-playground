/**
 * Shared canvas handle that every Diagrammatic mode implements.
 *
 * Architecture mode keeps its richer ArchitectureCanvasHandle (with sequence
 * playback, GIF recording, edge-style cycling, tier groups, etc.) — that
 * extends this base. Other modes implement just the base.
 */

export interface BaseCanvasHandle {
  /** Get the current payload (mode-specific JSON). */
  serialize: () => unknown;
  /** Replace the canvas state with a payload. */
  hydrate: (payload: unknown) => void;
  /** Fit the entire diagram in the viewport. */
  fit: () => void;
  /** Undo last user action (if supported). */
  undo: () => void;
  /** Redo last undone action (if supported). */
  redo: () => void;
  /** Delete currently selected node(s) / edge(s). */
  deleteSelection: () => void;
  /**
   * Optional: produce a textual export (SQL DDL, TypeScript, Markdown, …).
   * Returns null if the format isn't supported by this mode.
   */
  exportText?: (format: string) => string | null;
  /**
   * Optional: produce an image export (PNG / SVG / GIF). Most modes can rely
   * on Workspace's html-to-image fallback, but some (Whiteboard) ship their
   * own native exporter.
   */
  exportBlob?: (format: string) => Promise<Blob | null>;
}

/**
 * A starter document for a mode. Surfaced in the toolbar's Templates picker;
 * applying one calls `BaseCanvasHandle.hydrate(payload)`.
 */
export interface ModeTemplate {
  id: string;
  name: string;
  description?: string;
  payload: unknown;
}

/** Per-mode capability flags used to conditionally render toolbar buttons. */
export interface ModeCapabilities {
  /** Tier-group ("swimlane") add button (Architecture only today). */
  tierGroups?: boolean;
  /** Sequence playback Play/Stop buttons. */
  sequencePlayback?: boolean;
  /** Edge-style cycle (solid → dashed → flow). */
  edgeStyleCycle?: boolean;
  /** Animated GIF export of sequence playback. */
  gifExport?: boolean;
  /** Extra textual export formats this mode contributes to the menu. */
  textExports?: Array<{ id: string; label: string; ext: string }>;
}
