/**
 * Workspace — the Diagrammatic shell.
 *
 * Owns:
 *  - mode tab strip (Architecture / Flowchart / … — R1 ships Architecture only,
 *    others render a "Coming in R2" placeholder)
 *  - the palette (icons for architecture, shape stencils for other modes later)
 *  - the active mode's canvas
 *  - the toolbar
 *  - bridging palette drops to the canvas's imperative dropIcon API.
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import type {
  ArchitectureCanvasHandle,
  ArchPayload,
  ArchEdgeStyle,
} from "./modes/architecture/ArchitectureCanvas";
import { Palette } from "./shared/Palette";
import { Toolbar } from "./shared/Toolbar";
import { MODE_META, type DiagrammaticMode, type IconLite } from "./shared/types";
import { CommandPalette } from "./shared/CommandPalette";
import { Inspector, deriveArchIssues } from "./shared/Inspector";
import { StatusBar } from "./shared/StatusBar";
import { KeyboardHints } from "./shared/KeyboardHints";
import { promptToArchitecture } from "@/lib/prompt-to-arch";

// maxGraph touches `window` and SVG namespaces — must load client-only.
const ArchitectureCanvas = dynamic(
  () => import("./modes/architecture/ArchitectureCanvas").then((m) => m.ArchitectureCanvas),
  { ssr: false, loading: () => <CanvasLoading /> }
);

interface Props {
  icons: IconLite[];
  initialDiagramId?: string;
  initialMode?: DiagrammaticMode;
  initialPayload?: ArchPayload;
}

export function Workspace({
  icons,
  initialDiagramId,
  initialMode = "architecture",
  initialPayload,
}: Props) {
  const [mode, setMode] = useState<DiagrammaticMode>(initialMode);
  const [archPayload, setArchPayload] = useState<ArchPayload>(
    initialPayload ?? { nodes: [], edges: [] }
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [hintsOpen, setHintsOpen] = useState(false);
  const [edgeStyle, setEdgeStyle] = useState<ArchEdgeStyle>("flow");
  const canvasRef = useRef<ArchitectureCanvasHandle | null>(null);
  const searchParams = useSearchParams();

  const issues = useMemo(() => deriveArchIssues(archPayload), [archPayload]);

  // Index icons by id once for O(1) drop resolution.
  const iconById = useRef(new Map(icons.map((i) => [i.id, i])));
  useEffect(() => {
    iconById.current = new Map(icons.map((i) => [i.id, i]));
  }, [icons]);

  // The architecture canvas dispatches `diagrammatic-drop` with the dragged
  // icon id + client coords. We resolve the icon and forward to dropIcon.
  useEffect(() => {
    const onDrop = (e: Event) => {
      const ce = e as CustomEvent<{ payload: string; clientX: number; clientY: number }>;
      const icon = iconById.current.get(ce.detail.payload);
      if (icon && canvasRef.current) {
        canvasRef.current.dropIcon(icon, ce.detail.clientX, ce.detail.clientY);
      }
    };
    const onAdd = (e: Event) => {
      const ce = e as CustomEvent<{ id: string }>;
      const icon = iconById.current.get(ce.detail.id);
      if (icon && canvasRef.current) {
        canvasRef.current.addIconAtCenter(icon);
      }
    };
    window.addEventListener("diagrammatic-drop", onDrop as EventListener);
    window.addEventListener("diagrammatic-add-icon", onAdd as EventListener);
    return () => {
      window.removeEventListener("diagrammatic-drop", onDrop as EventListener);
      window.removeEventListener("diagrammatic-add-icon", onAdd as EventListener);
    };
  }, []);

  // ─── AI prompt → architecture (heuristic, no LLM) ───────────────────
  // When `/diagrammatic?prompt=…` lands, run the deterministic generator
  // against the manifest and seed the canvas. One-shot per page load.
  const promptApplied = useRef(false);
  useEffect(() => {
    if (promptApplied.current) return;
    const prompt = searchParams?.get("prompt");
    if (!prompt) return;
    const generated = promptToArchitecture(prompt, icons, { animateEdges: true });
    if (generated && generated.nodes.length) {
      promptApplied.current = true;
      setArchPayload(generated);
    }
  }, [searchParams, icons]);

  // Mark unsaved when canvas state changes.
  const handleArchChange = useCallback((next: ArchPayload) => {
    setArchPayload(next);
    setSaved(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!initialDiagramId) {
      // R1: anonymous draft mode — just stash to localStorage so a refresh
      // doesn't lose work. Persisted save lands in R3 with the API wiring.
      try {
        localStorage.setItem(
          "diagrammatic.draft",
          JSON.stringify({ mode, payload: archPayload, savedAt: Date.now() })
        );
        setSaved(true);
      } catch {
        /* localStorage may be disabled — fail silently */
      }
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/diagrams/${initialDiagramId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          graphJson: JSON.stringify({ mode, payload: archPayload, version: 1 }),
        }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }, [initialDiagramId, mode, archPayload]);

  // Rehydrate from a localStorage draft on first mount when no initial payload.
  useEffect(() => {
    if (initialPayload || initialDiagramId) return;
    try {
      const raw = localStorage.getItem("diagrammatic.draft");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.mode === "architecture" && parsed?.payload?.nodes) {
        setArchPayload(parsed.payload as ArchPayload);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meta = MODE_META[mode];

  // Cycle global edge style: solid → dashed → flow → solid.
  const cycleEdgeStyle = useCallback(() => {
    setEdgeStyle((prev) => {
      const next: ArchEdgeStyle =
        prev === "solid" ? "dashed" : prev === "dashed" ? "flow" : "solid";
      canvasRef.current?.setAllEdgeStyle(next);
      return next;
    });
  }, []);

  // Re-apply the current edge style after an external hydration (e.g. a
  // freshly generated AI payload) so any pre-existing animation classes stick.
  useEffect(() => {
    canvasRef.current?.setAllEdgeStyle(edgeStyle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archPayload]);

  // Route command-palette actions back to canvas / state.
  const handleCommand = useCallback(
    (id: string) => {
      switch (id) {
        case "save":
          handleSave();
          break;
        case "fit":
          canvasRef.current?.fit();
          break;
        case "undo":
          canvasRef.current?.undo();
          break;
        case "redo":
          canvasRef.current?.redo();
          break;
        case "delete":
          canvasRef.current?.deleteSelection();
          break;
        case "shortcuts":
          setHintsOpen(true);
          break;
        case "mode-arch":
          setMode("architecture");
          break;
      }
    },
    [handleSave]
  );

  // Global keyboard shortcuts beyond ⌘K (handled inside CommandPalette).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (e.key === "?" && !inField) {
        e.preventDefault();
        setHintsOpen((v) => !v);
      } else if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      } else if (meta && e.key === "0") {
        e.preventDefault();
        canvasRef.current?.fit();
      } else if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        canvasRef.current?.undo();
      } else if (meta && (e.key === "Z" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        canvasRef.current?.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave]);

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <Toolbar
        title={meta.label}
        onFit={() => canvasRef.current?.fit()}
        onUndo={() => canvasRef.current?.undo()}
        onRedo={() => canvasRef.current?.redo()}
        onDelete={() => canvasRef.current?.deleteSelection()}
        onSave={handleSave}
        onCycleEdgeStyle={cycleEdgeStyle}
        edgeStyle={edgeStyle}
        saving={saving}
        saved={saved}
      />

      {/* Mode tab strip */}
      <nav
        className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-zinc-800 bg-zinc-950 px-3 py-1.5"
        aria-label="Workspace modes"
      >
        {(Object.keys(MODE_META) as DiagrammaticMode[]).map((m) => {
          const meta = MODE_META[m];
          const active = m === mode;
          const ready = m === "architecture";
          return (
            <button
              key={m}
              type="button"
              onClick={() => ready && setMode(m)}
              disabled={!ready}
              title={ready ? meta.tagline : `${meta.label} — coming in R2/R3`}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition ${
                active
                  ? "bg-zinc-100 text-zinc-900"
                  : ready
                  ? "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                  : "text-zinc-600"
              }`}
            >
              <span aria-hidden>{meta.icon}</span>
              <span>{meta.label}</span>
              {!ready && <span className="ml-1 rounded bg-zinc-800 px-1 text-[9px] uppercase">soon</span>}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-1 overflow-hidden">
        <Palette icons={icons} />
        <main className="relative flex-1">
          {mode === "architecture" ? (
            <ArchitectureCanvas
              ref={canvasRef}
              value={archPayload}
              onChange={handleArchChange}
            />
          ) : (
            <ComingSoon mode={mode} />
          )}

          {/* Floating ⌘K hint */}
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 rounded-lg shadow-lg backdrop-blur transition-colors cursor-pointer"
            aria-label="Open command palette"
          >
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-zinc-950 border border-zinc-800 rounded">⌘K</kbd>
            commands
          </button>
        </main>

        <Inspector issues={issues} />
      </div>

      <StatusBar
        nodeCount={archPayload.nodes?.length ?? 0}
        edgeCount={archPayload.edges?.length ?? 0}
        zoom={100}
        saved={saved}
        saving={saving}
        issuesCount={issues.length}
      />

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} onAction={handleCommand} />
      <KeyboardHints open={hintsOpen} onClose={() => setHintsOpen(false)} />
    </div>
  );
}

function CanvasLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-zinc-950 text-sm text-zinc-500">
      Loading canvas…
    </div>
  );
}

function ComingSoon({ mode }: { mode: DiagrammaticMode }) {
  const meta = MODE_META[mode];
  return (
    <div className="flex h-full w-full items-center justify-center bg-zinc-950">
      <div className="max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
        <div className="mb-3 text-4xl">{meta.icon}</div>
        <h2 className="mb-1 text-lg font-semibold text-zinc-100">{meta.label}</h2>
        <p className="mb-4 text-sm text-zinc-400">{meta.tagline}</p>
        <p className="text-xs text-zinc-500">
          Engine: <span className="font-mono text-zinc-400">{meta.engine}</span>
        </p>
        <p className="mt-3 text-xs text-zinc-600">Coming in the next rebuild milestone.</p>
      </div>
    </div>
  );
}
