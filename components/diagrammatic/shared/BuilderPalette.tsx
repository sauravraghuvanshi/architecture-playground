/**
 * Builder Palette — floating contextual tile rail rendered over the canvas
 * for the React-Flow-based modes (flowchart, sequence, mindmap, ER, UML, C4).
 *
 * Each tile dispatches a window-level CustomEvent whose name is mode-specific
 * (e.g. ``flowchart-add-shape``, ``sequence-add-participant``). The active
 * canvas listens for that event and inserts a fresh node at the current
 * viewport center via React Flow's ``screenToFlowPosition``.
 *
 * The "Clear" button at the bottom delegates back to the Workspace via the
 * ``onClear`` prop so payload state, hydrate(), and persistence stay in sync.
 *
 * Why window events: keeps the palette decoupled from the mode-specific
 * canvas refs (Workspace's ``otherCanvasRef`` is a base handle without
 * mode-shape methods). The pre-existing flowchart/mindmap palettes already
 * use this pattern; extending it keeps everything uniform.
 */
"use client";

import { Trash2, type LucideIcon } from "lucide-react";
import {
  Square,
  Diamond,
  Circle,
  FileInput,
  Layers,
  User,
  Database,
  Server,
  Box,
  GitBranch,
  Table2,
  KeyRound,
  Link2,
  Network,
  Zap,
  Plus,
} from "lucide-react";
import type { DiagrammaticMode } from "./types";

interface PaletteTile {
  /** Window event detail kind — interpreted by the mode's canvas. */
  kind: string;
  label: string;
  Icon: LucideIcon;
}

interface PaletteSpec {
  /** Window event name — e.g. ``flowchart-add-shape``. */
  event: string;
  tiles: PaletteTile[];
}

const SPECS: Partial<Record<DiagrammaticMode, PaletteSpec>> = {
  flowchart: {
    event: "flowchart-add-shape",
    tiles: [
      { kind: "startend",   label: "Start / End", Icon: Circle },
      { kind: "process",    label: "Process",     Icon: Square },
      { kind: "decision",   label: "Decision",    Icon: Diamond },
      { kind: "io",         label: "Input / Output", Icon: FileInput },
      { kind: "subprocess", label: "Subprocess",  Icon: Layers },
    ],
  },
  sequence: {
    event: "sequence-add-participant",
    tiles: [
      { kind: "participant", label: "Participant", Icon: User },
      { kind: "system",      label: "System",      Icon: Server },
      { kind: "database",    label: "Database",    Icon: Database },
    ],
  },
  mindmap: {
    event: "mindmap-add-node",
    tiles: [
      { kind: "root",  label: "Root",  Icon: Zap },
      { kind: "child", label: "Child of selection", Icon: Plus },
    ],
  },
  er: {
    event: "er-add-entity",
    tiles: [
      { kind: "entity", label: "Entity",  Icon: Table2 },
      { kind: "lookup", label: "Lookup",  Icon: KeyRound },
    ],
  },
  uml: {
    event: "uml-add-class",
    tiles: [
      { kind: "class",     label: "Class",     Icon: Box },
      { kind: "interface", label: "Interface", Icon: Link2 },
      { kind: "abstract",  label: "Abstract class", Icon: GitBranch },
    ],
  },
  c4: {
    event: "c4-add-node",
    tiles: [
      { kind: "person",    label: "Person",    Icon: User },
      { kind: "system",    label: "System",    Icon: Network },
      { kind: "container", label: "Container", Icon: Server },
      { kind: "component", label: "Component", Icon: Box },
    ],
  },
};

interface Props {
  mode: DiagrammaticMode;
  onClear?: () => void;
}

export function BuilderPalette({ mode, onClear }: Props) {
  const spec = SPECS[mode];
  if (!spec) return null;

  const fire = (kind: string) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(spec.event, { detail: { kind } }));
  };

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col gap-2">
      <div className="pointer-events-auto rounded-lg border border-zinc-800 bg-zinc-950/90 p-1.5 shadow-xl backdrop-blur">
        <div className="px-1.5 pb-1 pt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Add
        </div>
        <div className="flex flex-col gap-1">
          {spec.tiles.map((t) => (
            <button
              key={t.kind}
              type="button"
              onClick={() => fire(t.kind)}
              className="group flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-[12px] text-zinc-200 transition hover:border-lime-300/60 hover:bg-zinc-900"
              title={`Add ${t.label.toLowerCase()} at viewport center`}
            >
              <t.Icon className="h-3.5 w-3.5 text-zinc-400 group-hover:text-lime-300" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        {onClear && (
          <>
            <div className="my-1 h-px bg-zinc-800" />
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Clear the canvas? This can be undone.")) {
                  onClear();
                }
              }}
              className="group flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-[12px] text-zinc-300 transition hover:border-rose-400/60 hover:bg-rose-500/10"
              title="Clear all nodes and connections"
            >
              <Trash2 className="h-3.5 w-3.5 text-zinc-400 group-hover:text-rose-300" />
              <span>Clear canvas</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
