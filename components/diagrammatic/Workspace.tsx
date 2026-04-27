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
  ArchNode,
  ArchEdge,
} from "./modes/architecture/ArchitectureCanvas";
import { Palette } from "./shared/Palette";
import { Toolbar, type ExportFormat } from "./shared/Toolbar";
import { MODE_META, type DiagrammaticMode, type IconLite } from "./shared/types";
import { CommandPalette } from "./shared/CommandPalette";
import { Inspector, deriveArchIssues } from "./shared/Inspector";
import { StatusBar } from "./shared/StatusBar";
import { KeyboardHints } from "./shared/KeyboardHints";
import { promptToArchitecture } from "@/lib/prompt-to-arch";
import { MODE_REGISTRY } from "./shared/modeCatalog";
import type { BaseCanvasHandle } from "./shared/modeRegistry";
import { AiPromptModal } from "./shared/AiPromptModal";
import { CommentsPanel } from "./shared/CommentsPanel";
import { VersionsPanel } from "./shared/VersionsPanel";

// Shared with /templates/GalleryClient.tsx
const TEMPLATE_HANDOFF_KEY = "architecture-playground:template-handoff";

// Map hub TemplateBrowser ids → seed prompts. Keeps the cards working without
// shipping a full graph registry per id.
const HUB_TEMPLATE_PROMPTS: Record<string, string> = {
  "azure-3tier": "Three tier web app on Azure with Front Door, App Service, and Azure SQL Database",
  "aws-serverless-images": "Serverless image processing pipeline on AWS with S3, Lambda, CloudFront, and DynamoDB",
  "gcp-event-driven": "Event driven order system on GCP with Pub/Sub, Cloud Run, Firestore, and BigQuery",
  "azure-aks-microservices": "AKS microservices on Azure with API Management, Cosmos DB, and Service Bus",
  "aws-data-lakehouse": "Data lakehouse on AWS with S3, Glue, Athena, Redshift, and QuickSight",
  "azure-ai-rag": "AI RAG pipeline on Azure with Azure OpenAI, AI Search, Functions, and Cosmos DB",
  "gcp-streaming-iot": "Streaming IoT analytics on GCP with Pub/Sub, Dataflow, BigQuery, and Looker",
  "multi-region-active": "Multi-region active-active on Azure with Front Door, Azure SQL HA, and Cosmos multi-write",
};

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
  // Per-mode payload state for the non-architecture modes. Initialized lazily
  // on first switch into the mode (using the registry's default payload), and
  // persisted to localStorage under "diagrammatic.draft.<mode>" on change.
  const [otherPayloads, setOtherPayloads] = useState<Partial<Record<DiagrammaticMode, unknown>>>({});
  const otherCanvasRef = useRef<BaseCanvasHandle | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [hintsOpen, setHintsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
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
  // When `/diagrammatic?prompt=…` (or `?template=<id>`) lands, run the
  // deterministic generator against the manifest and seed the canvas.
  // One-shot per page load.
  const promptApplied = useRef(false);
  useEffect(() => {
    if (promptApplied.current) return;
    const prompt = searchParams?.get("prompt");
    const templateId = searchParams?.get("template");
    const seed = prompt ?? (templateId ? HUB_TEMPLATE_PROMPTS[templateId] ?? templateId.replace(/-/g, " ") : null);
    if (!seed) return;
    const generated = promptToArchitecture(seed, icons, { animateEdges: true });
    if (generated && generated.nodes.length) {
      promptApplied.current = true;
      setArchPayload(generated);
      // Re-apply the current edge style ONCE after a generated payload arrives.
      requestAnimationFrame(() => canvasRef.current?.setAllEdgeStyle(edgeStyle));
    }
  }, [searchParams, icons, edgeStyle]);

  // Templates Gallery handoff: parameterized template resolved into a
  // playground-format graph stowed in localStorage under a unique handoff key
  // (cross-tab safe). Convert + hydrate.
  const handoffApplied = useRef(false);
  useEffect(() => {
    if (handoffApplied.current) return;
    try {
      const handoffId = searchParams?.get("templateHandoff");
      // Support both: keyed handoff (new — cross-tab via localStorage) and
      // legacy unkeyed sessionStorage (same-tab fallback).
      const storeKey = handoffId ? `${TEMPLATE_HANDOFF_KEY}:${handoffId}` : null;
      const raw =
        (storeKey && (localStorage.getItem(storeKey) ?? sessionStorage.getItem(storeKey))) ||
        sessionStorage.getItem(TEMPLATE_HANDOFF_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { graph?: PlaygroundLikeGraph };
      const arch = parsed?.graph ? playgroundGraphToArchPayload(parsed.graph) : null;
      if (arch && arch.nodes.length) {
        handoffApplied.current = true;
        promptApplied.current = true; // suppress the prompt path on the same load
        setArchPayload(arch);
        if (storeKey) {
          localStorage.removeItem(storeKey);
          sessionStorage.removeItem(storeKey);
        }
        sessionStorage.removeItem(TEMPLATE_HANDOFF_KEY);
        requestAnimationFrame(() => canvasRef.current?.setAllEdgeStyle(edgeStyle));
      }
    } catch {
      /* ignore handoff failures — falls back to empty canvas */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
  // CRITICAL: skip when the URL carries a prompt / template / handoff — in
  // that case the user explicitly asked to open a different diagram and the
  // draft would clobber it.
  useEffect(() => {
    if (initialPayload || initialDiagramId) return;
    if (
      searchParams?.get("prompt") ||
      searchParams?.get("template") ||
      searchParams?.get("templateHandoff")
    ) {
      return;
    }
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

  // ?mode=<id> on first load — set the mode if URL specifies one. One-shot;
  // subsequent tab clicks own the mode via setMode.
  const modeFromUrlApplied = useRef(false);
  useEffect(() => {
    if (modeFromUrlApplied.current) return;
    const m = searchParams?.get("mode");
    if (m && ["architecture","flowchart","mindmap","sequence","er","uml","c4","kanban","whiteboard"].includes(m)) {
      modeFromUrlApplied.current = true;
      setMode(m as DiagrammaticMode);
    }
  }, [searchParams]);

  // Probe AI configuration once on mount so the toolbar can disable the AI
  // button (and surface a tooltip) when env vars are missing — avoids a
  // round-trip per click.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((j: { configured?: boolean }) => { if (!cancelled) setAiConfigured(!!j.configured); })
      .catch(() => { if (!cancelled) setAiConfigured(false); });
    return () => { cancelled = true; };
  }, []);

  const meta = MODE_META[mode];

  const [playing, setPlaying] = useState(false);
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
  // template handoff). Triggered explicitly by the handoff/prompt paths above
  // — NOT on every archPayload change, which previously caused a render storm
  // on each node-add.
  // (intentionally blank — replaced by explicit calls in the prompt/handoff effects)

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
        onFit={() => (mode === "architecture" ? canvasRef.current?.fit() : otherCanvasRef.current?.fit())}
        onUndo={() => (mode === "architecture" ? canvasRef.current?.undo() : otherCanvasRef.current?.undo())}
        onRedo={() => (mode === "architecture" ? canvasRef.current?.redo() : otherCanvasRef.current?.redo())}
        onDelete={() => (mode === "architecture" ? canvasRef.current?.deleteSelection() : otherCanvasRef.current?.deleteSelection())}
        onSave={handleSave}
        onCycleEdgeStyle={mode === "architecture" ? cycleEdgeStyle : undefined}
        edgeStyle={edgeStyle}
        onAddTier={mode === "architecture" ? (tier) => canvasRef.current?.addGroup(tier, tier) : undefined}
        onPlay={mode === "architecture" ? () => canvasRef.current?.playSequence() : undefined}
        onStop={mode === "architecture" ? () => canvasRef.current?.stopSequence() : undefined}
        playing={playing}
        onExport={(format) => {
          if (mode === "architecture") return exportCanvas(format, canvasRef.current);
          return exportOther(format, mode, otherCanvasRef.current, otherPayloads[mode]);
        }}
        extraExports={mode !== "architecture" ? MODE_REGISTRY[mode]?.capabilities.textExports : undefined}
        hideRasterExports={mode === "kanban"}
        templates={mode !== "architecture"
          ? MODE_REGISTRY[mode]?.templates.map((t) => ({ id: t.id, name: t.name, description: t.description }))
          : undefined}
        onApplyTemplate={mode !== "architecture" ? (id) => {
          const tpl = MODE_REGISTRY[mode]?.templates.find((t) => t.id === id);
          if (!tpl) return;
          // Replace the in-memory payload AND hydrate the canvas. The
          // useFlowCanvas hook's hydrate suppresses the next snapshot so
          // undo doesn't roll back into mid-template state.
          setOtherPayloads((prev) => ({ ...prev, [mode]: tpl.payload }));
          otherCanvasRef.current?.hydrate(tpl.payload);
          setSaved(false);
          try {
            localStorage.setItem(`diagrammatic.draft.${mode}`, JSON.stringify({ payload: tpl.payload, savedAt: Date.now() }));
          } catch { /* ignore */ }
        } : undefined}
        onAiAssist={mode !== "whiteboard" ? () => setAiOpen(true) : undefined}
        aiDisabledReason={aiConfigured === false ? "AI is not configured. Set Azure OpenAI env vars on the server." : undefined}
        onToggleComments={() => setCommentsOpen((v) => !v)}
        commentsOpen={commentsOpen}
        onToggleVersions={() => setVersionsOpen((v) => !v)}
        versionsOpen={versionsOpen}
        saving={saving}
        saved={saved}
      />

      {/* Mode tab strip */}
      <nav
        className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-zinc-800 bg-zinc-950 px-3 py-1.5"
        aria-label="Workspace modes"
        role="tablist"
      >
        {(Object.keys(MODE_META) as DiagrammaticMode[]).map((m) => {
          const meta = MODE_META[m];
          const active = m === mode;
          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={meta.label}
              onClick={() => setMode(m)}
              title={meta.tagline}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition cursor-pointer ${
                active
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
              }`}
            >
              <span aria-hidden>{meta.icon}</span>
              <span>{meta.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {mode === "architecture" && <Palette icons={icons} />}
        <main className="relative flex-1">
          {mode === "architecture" ? (
            <ArchitectureCanvas
              ref={canvasRef}
              value={archPayload}
              onChange={handleArchChange}
              onPlayingChange={setPlaying}
            />
          ) : (
            <ModeCanvasFor
              mode={mode}
              value={otherPayloads[mode]}
              onMount={(handle) => { otherCanvasRef.current = handle; }}
              onChange={(p) => {
                setOtherPayloads((prev) => ({ ...prev, [mode]: p }));
                setSaved(false);
                try {
                  localStorage.setItem(`diagrammatic.draft.${mode}`, JSON.stringify({ payload: p, savedAt: Date.now() }));
                } catch { /* ignore */ }
              }}
            />
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

        {mode === "architecture" && <Inspector issues={issues} />}
        <CommentsPanel
          scopeId={`${mode}:${initialDiagramId ?? "draft"}`}
          open={commentsOpen}
          onClose={() => setCommentsOpen(false)}
        />
        <VersionsPanel
          scopeId={`${mode}:${initialDiagramId ?? "draft"}`}
          open={versionsOpen}
          onClose={() => setVersionsOpen(false)}
          getCurrent={() => (mode === "architecture" ? archPayload : otherPayloads[mode])}
          onRestore={(payload) => {
            if (mode === "architecture") {
              setArchPayload(payload as ArchPayload);
              requestAnimationFrame(() => canvasRef.current?.setAllEdgeStyle(edgeStyle));
            } else {
              setOtherPayloads((prev) => ({ ...prev, [mode]: payload }));
              otherCanvasRef.current?.hydrate(payload);
            }
            setSaved(false);
          }}
        />
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
      <AiPromptModal
        mode={mode}
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onResult={(graph) => {
          if (mode === "architecture") {
            // Architecture API returns a PlaygroundGraph shape; convert.
            try {
              const arch = playgroundGraphToArchPayload(graph as PlaygroundLikeGraph);
              if (arch.nodes.length) {
                setArchPayload(arch);
                requestAnimationFrame(() => canvasRef.current?.setAllEdgeStyle(edgeStyle));
              }
            } catch {
              /* ignore malformed graph — modal will not open if API errored */
            }
          } else {
            setOtherPayloads((prev) => ({ ...prev, [mode]: graph }));
            otherCanvasRef.current?.hydrate(graph);
            try {
              localStorage.setItem(`diagrammatic.draft.${mode}`, JSON.stringify({ payload: graph, savedAt: Date.now() }));
            } catch { /* ignore */ }
          }
          setSaved(false);
        }}
      />
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

/**
 * Render the canvas for a non-architecture mode. Hydrates the mode's payload
 * from (in priority order) the in-memory `otherPayloads` slot, the per-mode
 * localStorage draft, or the registry's default.
 */
function ModeCanvasFor({
  mode,
  value,
  onChange,
  onMount,
}: {
  mode: DiagrammaticMode;
  value: unknown;
  onChange: (p: unknown) => void;
  onMount: (handle: BaseCanvasHandle | null) => void;
}) {
  const entry = MODE_REGISTRY[mode];
  const initial = useMemo(() => {
    if (value !== undefined) return value;
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(`diagrammatic.draft.${mode}`) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.payload !== undefined) return parsed.payload;
      }
    } catch { /* ignore */ }
    return entry?.defaultPayload;
  // Recompute only when mode changes — value is the in-memory slot which is
  // intentionally read once at mount; subsequent updates flow via onChange.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  const refCallback = useCallback((h: BaseCanvasHandle | null) => onMount(h), [onMount]);
  if (!entry) return <ComingSoon mode={mode} />;
  const Canvas = entry.Canvas;
  return <Canvas value={initial as never} onChange={onChange} ref={refCallback} />;
}

// ─── Playground graph → ArchPayload adapter ────────────────────────────────
// The /templates registry returns a `PlaygroundGraph` (service / group nodes
// with rich data). We map the subset the architecture canvas understands.

interface PlaygroundLikeGraph {
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: {
      label?: string;
      iconId?: string;
      variant?: string;
      [k: string]: unknown;
    };
    parentId?: string;
    width?: number;
    height?: number;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    data?: { label?: string; protocol?: string; animated?: boolean };
  }>;
}

const VARIANT_TO_TIER: Record<string, string> = {
  vpc: "Edge",
  region: "Edge",
  subnet: "Frontend",
  "resource-group": "Compute",
  project: "Compute",
  custom: "Custom",
};

function playgroundGraphToArchPayload(graph: PlaygroundLikeGraph): ArchPayload {
  const nodes: ArchNode[] = [];
  for (const n of graph.nodes ?? []) {
    if (n.type === "group") {
      const variant = (n.data?.variant as string) ?? "custom";
      nodes.push({
        kind: "group",
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        width: n.width ?? 440,
        height: n.height ?? 220,
        label: (n.data?.label as string) ?? "Group",
        tier: VARIANT_TO_TIER[variant] ?? "Custom",
      });
    } else if (n.type === "service") {
      const iconId = (n.data?.iconId as string) ?? "";
      nodes.push({
        kind: "icon",
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        label: (n.data?.label as string) ?? iconId,
        iconId,
        // The canvas keeps iconPath in node data; resolve at hydrate time
        // by deriving from iconId. The manifest path convention is
        // /cloud-icons/<cloud>/<category>/<slug>.svg — but iconId already
        // matches that exact slug-tail so we can construct it.
        iconPath: iconIdToPath(iconId),
        ...(n.parentId ? { parentId: n.parentId } : {}),
      });
    }
    // (sticky / other types are ignored for now)
  }

  const edges: ArchEdge[] = (graph.edges ?? []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.data?.label ?? e.data?.protocol,
    archStyle: e.data?.animated ? "flow" : "solid",
  }));

  return { nodes, edges };
}

function iconIdToPath(iconId: string): string {
  // iconId in the playground manifest already encodes the path: e.g.
  // "azure/compute/azure-app-service" → "/cloud-icons/azure/compute/azure-app-service.svg"
  if (!iconId) return "";
  return `/cloud-icons/${iconId}.svg`;
}

// ─── Export helpers ────────────────────────────────────────────────────────

async function exportCanvas(
  format: ExportFormat,
  handle: ArchitectureCanvasHandle | null
) {
  if (!handle) return;
  if (format === "json") {
    const payload = handle.serialize();
    triggerDownload(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      `architecture-${Date.now()}.json`
    );
    return;
  }
  // PNG / SVG / GIF operate on the rendered viewport.
  const viewport = document.querySelector(".react-flow__viewport") as HTMLElement | null;
  const target =
    (document.querySelector(".react-flow") as HTMLElement | null) ?? viewport;
  if (!target) return;
  try {
    const { toPng, toSvg, toCanvas } = await import("html-to-image");
    const filter = (node: HTMLElement) => {
      // Skip the controls / minimap / panel chrome from the export.
      const cls = (node as Element).className;
      const s = typeof cls === "string" ? cls : (cls as { baseVal?: string })?.baseVal ?? "";
      return !s.includes("react-flow__controls") &&
             !s.includes("react-flow__minimap") &&
             !s.includes("react-flow__panel");
    };
    if (format === "png") {
      const dataUrl = await toPng(target, {
        cacheBust: true,
        backgroundColor: "#0a0a0b",
        pixelRatio: 2,
        filter,
      });
      const blob = await (await fetch(dataUrl)).blob();
      triggerDownload(blob, `architecture-${Date.now()}.png`);
    } else if (format === "svg") {
      const dataUrl = await toSvg(target, {
        cacheBust: true,
        backgroundColor: "#0a0a0b",
        filter,
      });
      const blob = await (await fetch(dataUrl)).blob();
      triggerDownload(blob, `architecture-${Date.now()}.svg`);
    } else if (format === "gif") {
      const blob = await exportSequenceGif(handle, target, toCanvas, filter);
      if (blob) triggerDownload(blob, `architecture-${Date.now()}.gif`);
    }
  } catch (err) {
    console.error("Export failed:", err);
  }
}

// ─── GIF (animated) export ─────────────────────────────────────────────────
//
// Drives the canvas through `recordSequence`, captures one PNG frame per step
// via html-to-image's toCanvas, then encodes the frames as an animated GIF
// using gifenc (no worker required). Frame size is capped at 960px wide to
// keep the resulting file under a reasonable size.
async function exportSequenceGif(
  handle: ArchitectureCanvasHandle,
  target: HTMLElement,
  toCanvas: (node: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLCanvasElement>,
  filter: (node: HTMLElement) => boolean
): Promise<Blob | null> {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  // Compute output dimensions — cap longest side at 960 for size sanity.
  const rect = target.getBoundingClientRect();
  const maxWidth = 960;
  const scale = Math.min(1, maxWidth / Math.max(1, rect.width));
  const outW = Math.max(2, Math.round(rect.width * scale));
  const outH = Math.max(2, Math.round(rect.height * scale));
  const gif = GIFEncoder();
  const frames: Uint8ClampedArray[] = [];

  await handle.recordSequence(async () => {
    const canvas = await toCanvas(target, {
      cacheBust: true,
      backgroundColor: "#0a0a0b",
      pixelRatio: scale,
      filter,
      width: outW,
      height: outH,
    });
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    frames.push(new Uint8ClampedArray(data));
  });

  if (!frames.length) return null;
  // Single 256-colour palette derived from the first frame keeps file size
  // small and avoids per-frame palette flicker.
  const palette = quantize(frames[0], 256);
  for (let i = 0; i < frames.length; i += 1) {
    const index = applyPalette(frames[i], palette);
    // Hold start/end longer (1s) so viewers can see the steady states.
    const isFirst = i === 0;
    const isLast = i === frames.length - 1;
    gif.writeFrame(index, outW, outH, {
      palette: i === 0 ? palette : undefined,
      delay: isFirst || isLast ? 1000 : 700,
    });
  }
  gif.finish();
  const bytes = gif.bytes();
  // Copy into a fresh ArrayBuffer-backed Uint8Array so the Blob constructor
  // accepts it under TS's strict ArrayBuffer/SharedArrayBuffer typing.
  const buf = new Uint8Array(bytes.byteLength);
  buf.set(bytes);
  return new Blob([buf], { type: "image/gif" });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Generic export for non-architecture modes ────────────────────────────
// Each canvas exposes optional exportText / exportBlob via its handle. PNG /
// SVG fall back to html-to-image against the canvas root. GIF and "json"
// also work — JSON serializes the payload directly.
async function exportOther(
  format: string,
  mode: DiagrammaticMode,
  handle: BaseCanvasHandle | null,
  payload: unknown
) {
  if (!handle) return;
  const stamp = Date.now();
  // Native blob export (used by Whiteboard's Excalidraw exporter).
  if (handle.exportBlob) {
    try {
      const native = await handle.exportBlob(format);
      if (native) { triggerDownload(native, `${mode}-${stamp}.${format}`); return; }
    } catch (err) { console.warn("exportBlob failed:", err); }
  }
  if (format === "json") {
    const data = handle.serialize();
    triggerDownload(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      `${mode}-${stamp}.json`);
    return;
  }
  if (handle.exportText) {
    const text = handle.exportText(format);
    if (text != null) {
      const ext = format === "ts" ? "ts" : format === "sql" ? "sql" : format === "md" ? "md" : "txt";
      const mime = format === "ts" ? "text/typescript" : format === "sql" ? "text/x-sql" : format === "md" ? "text/markdown" : "text/plain";
      triggerDownload(new Blob([text], { type: mime }), `${mode}-${stamp}.${ext}`);
      return;
    }
  }
  // Raster fallback for PNG / SVG.
  const target =
    (document.querySelector(".react-flow") as HTMLElement | null) ??
    (document.querySelector(".excalidraw") as HTMLElement | null) ??
    (document.querySelector("main") as HTMLElement | null);
  if (!target) {
    void payload; // unused — payload may be useful for future text exporters
    return;
  }
  try {
    const { toPng, toSvg } = await import("html-to-image");
    if (format === "png" || format === "gif") {
      const dataUrl = await toPng(target, { cacheBust: true, backgroundColor: "#0a0a0b", pixelRatio: 2 });
      const blob = await (await fetch(dataUrl)).blob();
      triggerDownload(blob, `${mode}-${stamp}.png`);
    } else if (format === "svg") {
      const dataUrl = await toSvg(target, { cacheBust: true, backgroundColor: "#0a0a0b" });
      const blob = await (await fetch(dataUrl)).blob();
      triggerDownload(blob, `${mode}-${stamp}.svg`);
    }
  } catch (err) {
    console.error("Generic export failed:", err);
  }
}
