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
  ArchShape,
  ArchitectureSelection,
  ArchitectureSelectionPatch,
} from "./modes/architecture/ArchitectureCanvas";
import { Palette } from "./shared/Palette";
import { BuilderPalette } from "./shared/BuilderPalette";
import { Toolbar, type ExportFormat } from "./shared/Toolbar";
import {
  MODE_META,
  type CanvasTheme,
  type DiagrammaticMode,
  type IconLite,
} from "./shared/types";
import { CommandPalette } from "./shared/CommandPalette";
import { Inspector, deriveArchIssues } from "./shared/Inspector";
import { StatusBar } from "./shared/StatusBar";
import { KeyboardHints } from "./shared/KeyboardHints";
import { promptToArchitecture } from "@/lib/prompt-to-arch";
import { MODE_REGISTRY } from "./shared/modeCatalog";
import {
  FLOWCHART_EMPTY_PAYLOAD,
  SEQUENCE_EMPTY_PAYLOAD,
  MINDMAP_EMPTY_PAYLOAD,
  ER_EMPTY_PAYLOAD,
  UML_EMPTY_PAYLOAD,
  C4_EMPTY_PAYLOAD,
  WHITEBOARD_EMPTY_PAYLOAD,
  KANBAN_EMPTY_PAYLOAD,
} from "./shared/modeDefaults";
import type { BaseCanvasHandle } from "./shared/modeRegistry";
import { AiPromptModal } from "./shared/AiPromptModal";
import { CommentsPanel } from "./shared/CommentsPanel";
import { VersionsPanel } from "./shared/VersionsPanel";
import { CsaGuidancePanel } from "./csa/CsaGuidancePanel";
import { ArchitectureCodeModal } from "./csa/ArchitectureCodeModal";
import { ArchitectureReviewModal } from "./csa/ArchitectureReviewModal";
import { AzureDeployModal } from "./csa/AzureDeployModal";
import {
  WhiteboardAssetPalette,
  type WhiteboardAsset,
} from "./modes/whiteboard/AssetPalette";
import {
  Boxes,
  BrainCircuit,
  CloudCog,
  Columns3,
  Database,
  GitBranch,
  Network,
  PencilRuler,
  Workflow,
} from "lucide-react";

// Shared with /templates/GalleryClient.tsx
const TEMPLATE_HANDOFF_KEY = "architecture-playground:template-handoff";
const CANVAS_THEME_KEY = "diagrammatic.canvas-themes";

function defaultCanvasTheme(mode: DiagrammaticMode): CanvasTheme {
  return mode === "whiteboard" || mode === "kanban" ? "dark" : "light";
}

// Empty payloads keyed by mode — used by the BuilderPalette's Clear button
// and accessible without dragging mode-specific Canvas modules into the
// Workspace bundle (they're tiny structural literals from `shared/`).
const EMPTY_PAYLOAD_FOR: Partial<Record<DiagrammaticMode, unknown>> = {
  flowchart: FLOWCHART_EMPTY_PAYLOAD,
  sequence: SEQUENCE_EMPTY_PAYLOAD,
  mindmap: MINDMAP_EMPTY_PAYLOAD,
  er: ER_EMPTY_PAYLOAD,
  uml: UML_EMPTY_PAYLOAD,
  c4: C4_EMPTY_PAYLOAD,
  whiteboard: WHITEBOARD_EMPTY_PAYLOAD,
  kanban: KANBAN_EMPTY_PAYLOAD,
};

const ARCHITECTURE_EMPTY_PAYLOAD: ArchPayload = { nodes: [], edges: [] };

interface AiStatus {
  diagramConfigured: boolean;
  imageConfigured: boolean;
  imageSource?: "local" | "development-proxy" | null;
}

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

const ARCHITECTURE_TEMPLATES = [
  {
    id: "azure-enterprise-web",
    name: "Azure secure web platform",
    description: "Front Door, WAF, API Management, App Service, messaging, data, and observability",
    prompt:
      "Enterprise Azure web platform with Front Door and WAF, API Management, App Service, Service Bus, Azure SQL, Key Vault, and Application Insights",
  },
  {
    id: "aws-event-platform",
    name: "AWS event-driven platform",
    description: "CloudFront, API Gateway, Lambda, EventBridge, SQS, DynamoDB, and CloudWatch",
    prompt:
      "Enterprise event driven platform on AWS with CloudFront, API Gateway, Lambda, EventBridge, SQS, DynamoDB, S3, and CloudWatch",
  },
  {
    id: "gcp-data-ai",
    name: "GCP data & AI platform",
    description: "Cloud Run, Pub/Sub, Dataflow, BigQuery, Vertex AI, and operations",
    prompt:
      "Enterprise data and AI platform on GCP with Cloud Run, Pub Sub, Dataflow, BigQuery, Cloud Storage, Vertex AI, and Cloud Monitoring",
  },
  {
    id: "multi-cloud-integration",
    name: "Multi-cloud integration",
    description: "Cloud-neutral edge, identity, messaging, workloads, and centralized operations",
    prompt:
      "Enterprise multi cloud integration platform across Azure AWS and GCP with global edge, identity, API gateway, messaging, compute, data, security, and centralized observability",
  },
] as const;

const MODE_ICONS: Record<DiagrammaticMode, React.ComponentType<{ className?: string }>> = {
  architecture: CloudCog,
  flowchart: GitBranch,
  mindmap: BrainCircuit,
  sequence: Workflow,
  er: Database,
  uml: Boxes,
  whiteboard: PencilRuler,
  kanban: Columns3,
  c4: Network,
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
  const [csaGuidanceOpen, setCsaGuidanceOpen] = useState(false);
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [canvasThemes, setCanvasThemes] = useState<
    Partial<Record<DiagrammaticMode, CanvasTheme>>
  >({});
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [edgeStyle, setEdgeStyle] = useState<ArchEdgeStyle>("flow");
  const [selection, setSelection] = useState<ArchitectureSelection | null>(null);
  const [exportNotice, setExportNotice] = useState<{
    kind: "working" | "success" | "error";
    message: string;
  } | null>(null);
  const [insertingWhiteboardAsset, setInsertingWhiteboardAsset] = useState<string | null>(null);
  const canvasRef = useRef<ArchitectureCanvasHandle | null>(null);
  const searchParams = useSearchParams();

  const issues = useMemo(() => deriveArchIssues(archPayload), [archPayload]);
  const canvasTheme = canvasThemes[mode] ?? defaultCanvasTheme(mode);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CANVAS_THEME_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<DiagrammaticMode, CanvasTheme>>;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCanvasThemes((current) => ({ ...parsed, ...current }));
    } catch {
      /* Ignore malformed or unavailable local theme preferences. */
    }
  }, []);

  const toggleCanvasTheme = useCallback(() => {
    let stored: Partial<Record<DiagrammaticMode, CanvasTheme>> = {};
    try {
      const raw = localStorage.getItem(CANVAS_THEME_KEY);
      stored = raw ? JSON.parse(raw) : {};
    } catch {
      /* Continue with in-memory preferences. */
    }
    const merged = { ...stored, ...canvasThemes };
    const active = merged[mode] ?? defaultCanvasTheme(mode);
    const next = {
      ...merged,
      [mode]: active === "light" ? "dark" : "light",
    } satisfies Partial<Record<DiagrammaticMode, CanvasTheme>>;
    setCanvasThemes(next);
    try {
      localStorage.setItem(CANVAS_THEME_KEY, JSON.stringify(next));
    } catch {
      /* Theme still applies for the current session. */
    }
  }, [canvasThemes, mode]);

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
    const onDropShape = (e: Event) => {
      const ce = e as CustomEvent<{ shape: ArchShape; clientX: number; clientY: number }>;
      canvasRef.current?.dropShape(ce.detail.shape, ce.detail.clientX, ce.detail.clientY);
    };
    const onAddShape = (e: Event) => {
      const ce = e as CustomEvent<{ shape: ArchShape }>;
      canvasRef.current?.addShapeAtCenter(ce.detail.shape);
    };
    window.addEventListener("diagrammatic-drop", onDrop as EventListener);
    window.addEventListener("diagrammatic-add-icon", onAdd as EventListener);
    window.addEventListener("diagrammatic-drop-shape", onDropShape as EventListener);
    window.addEventListener("diagrammatic-add-shape", onAddShape as EventListener);
    return () => {
      window.removeEventListener("diagrammatic-drop", onDrop as EventListener);
      window.removeEventListener("diagrammatic-add-icon", onAdd as EventListener);
      window.removeEventListener("diagrammatic-drop-shape", onDropShape as EventListener);
      window.removeEventListener("diagrammatic-add-shape", onAddShape as EventListener);
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
      requestAnimationFrame(() => {
        setArchPayload(generated);
        requestAnimationFrame(() => canvasRef.current?.setAllEdgeStyle(edgeStyle));
      });
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
      const arch = parsed?.graph ? playgroundGraphToArchPayload(parsed.graph, icons) : null;
      if (arch && arch.nodes.length) {
        handoffApplied.current = true;
        promptApplied.current = true; // suppress the prompt path on the same load
        requestAnimationFrame(() => {
          setArchPayload(arch);
          requestAnimationFrame(() => canvasRef.current?.setAllEdgeStyle(edgeStyle));
        });
        if (storeKey) {
          localStorage.removeItem(storeKey);
          sessionStorage.removeItem(storeKey);
        }
        sessionStorage.removeItem(TEMPLATE_HANDOFF_KEY);
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
    const activePayload =
      mode === "architecture"
        ? archPayload
        : otherCanvasRef.current?.serialize() ?? otherPayloads[mode];
    if (!initialDiagramId) {
      // R1: anonymous draft mode — just stash to localStorage so a refresh
      // doesn't lose work. Persisted save lands in R3 with the API wiring.
      try {
        localStorage.setItem(
          "diagrammatic.draft",
          JSON.stringify({ mode, payload: activePayload, savedAt: Date.now() })
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
          graphJson: JSON.stringify({ mode, payload: activePayload, version: 1 }),
        }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }, [initialDiagramId, mode, archPayload, otherPayloads]);

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
        requestAnimationFrame(() => setArchPayload(parsed.payload as ArchPayload));
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Architecture mode now autosaves like every other mode. The debounce keeps
  // drag operations fluid while ensuring a refresh does not discard work.
  useEffect(() => {
    if (mode !== "architecture" || initialDiagramId) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          "diagrammatic.draft",
          JSON.stringify({ mode: "architecture", payload: archPayload, savedAt: Date.now() })
        );
        setSaved(true);
      } catch {
        setSaved(false);
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [archPayload, initialDiagramId, mode]);

  // ?mode=<id> on first load — set the mode if URL specifies one. One-shot;
  // subsequent tab clicks own the mode via setMode.
  const modeFromUrlApplied = useRef(false);
  useEffect(() => {
    if (modeFromUrlApplied.current) return;
    const m = searchParams?.get("mode");
    if (m && ["architecture","flowchart","mindmap","sequence","er","uml","c4","kanban","whiteboard"].includes(m)) {
      modeFromUrlApplied.current = true;
      requestAnimationFrame(() => setMode(m as DiagrammaticMode));
    }
  }, [searchParams]);

  // Diagrammatic does not accept upstream scene or library deep links.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    let dirty = false;
    for (const key of ["addLibrary", "json", "room", "token"]) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        dirty = true;
      }
      if (hash.has(key)) {
        hash.delete(key);
        dirty = true;
      }
    }
    if (!dirty) return;
    const hashValue = hash.toString();
    url.hash = hashValue ? `#${hashValue}` : "";
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  // Probe AI configuration once on mount so the toolbar can disable the AI
  // button (and surface a tooltip) when env vars are missing — avoids a
  // round-trip per click.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then(
        (result: {
          configured?: boolean;
          diagramConfigured?: boolean;
          imageConfigured?: boolean;
          imageSource?: AiStatus["imageSource"];
        }) => {
          if (!cancelled) {
            setAiStatus({
              diagramConfigured: result.diagramConfigured ?? !!result.configured,
              imageConfigured: result.imageConfigured ?? !!result.configured,
              imageSource: result.imageSource,
            });
          }
        }
      )
      .catch(() => {
        if (!cancelled) {
          setAiStatus({ diagramConfigured: false, imageConfigured: false });
        }
      });
    return () => { cancelled = true; };
  }, []);

  const meta = MODE_META[mode];

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      const label = format.toUpperCase();
      setExportNotice({ kind: "working", message: `Preparing ${label} export…` });
      try {
        if (mode === "architecture") {
          await exportCanvas(format, canvasRef.current);
        } else {
          await exportOther(format, mode, otherCanvasRef.current, otherPayloads[mode]);
        }
        setExportNotice({ kind: "success", message: `${label} export downloaded` });
      } catch (error) {
        console.error("Export failed:", error);
        setExportNotice({
          kind: "error",
          message: error instanceof Error ? error.message : `${label} export failed`,
        });
      }
      window.setTimeout(() => setExportNotice(null), 3200);
    },
    [mode, otherPayloads]
  );

  const updateSelection = useCallback(
    (id: string, patch: ArchitectureSelectionPatch) => {
      canvasRef.current?.updateElement(id, patch);
    },
    []
  );

  const applyArchitectureTemplate = useCallback(
    (templateId: string) => {
      const template = ARCHITECTURE_TEMPLATES.find((candidate) => candidate.id === templateId);
      if (!template) return;
      const generated = promptToArchitecture(template.prompt, icons, { animateEdges: true });
      if (!generated?.nodes.length) return;
      setArchPayload(generated);
      canvasRef.current?.hydrate(generated);
      setSaved(false);
      requestAnimationFrame(() => canvasRef.current?.setAllEdgeStyle(edgeStyle));
    },
    [edgeStyle, icons]
  );

  const applyArchitectureCenterPattern = useCallback(
    (prompt: string) => {
      const generated = promptToArchitecture(prompt, icons, { animateEdges: true });
      if (!generated?.nodes.length) return;
      setArchPayload(generated);
      canvasRef.current?.hydrate(generated);
      setSelection(null);
      setSaved(false);
      requestAnimationFrame(() => {
        canvasRef.current?.setAllEdgeStyle(edgeStyle);
        canvasRef.current?.fit();
      });
    },
    [edgeStyle, icons]
  );

  const handleBlankCanvas = useCallback(() => {
    const empty =
      mode === "architecture" ? ARCHITECTURE_EMPTY_PAYLOAD : EMPTY_PAYLOAD_FOR[mode];
    if (!empty) return;
    const current =
      mode === "architecture"
        ? archPayload
        : otherCanvasRef.current?.serialize() ?? otherPayloads[mode];
    const hasContent = JSON.stringify(current) !== JSON.stringify(empty);
    if (
      hasContent &&
      !window.confirm(`Start a blank ${MODE_META[mode].label} canvas? Your current canvas will be replaced.`)
    ) {
      return;
    }

    const blank = structuredClone(empty);
    if (mode === "architecture") {
      setArchPayload(blank as ArchPayload);
      canvasRef.current?.hydrate(blank as ArchPayload);
      setSelection(null);
    } else {
      setOtherPayloads((previous) => ({ ...previous, [mode]: blank }));
      otherCanvasRef.current?.hydrate(blank);
      try {
        localStorage.setItem(
          `diagrammatic.draft.${mode}`,
          JSON.stringify({ payload: blank, savedAt: Date.now() })
        );
      } catch {
        /* localStorage may be unavailable */
      }
    }
    setSaved(false);
  }, [archPayload, mode, otherPayloads]);

  const handleOtherChange = useCallback(
    (payload: unknown) => {
      setOtherPayloads((previous) => ({ ...previous, [mode]: payload }));
      setSaved(false);
      try {
        localStorage.setItem(
          `diagrammatic.draft.${mode}`,
          JSON.stringify({ payload, savedAt: Date.now() })
        );
      } catch {
        /* localStorage may be unavailable */
      }
    },
    [mode]
  );

  const handleOtherMount = useCallback((handle: BaseCanvasHandle | null) => {
    otherCanvasRef.current = handle;
  }, []);

  const insertWhiteboardAsset = useCallback((asset: WhiteboardAsset) => {
    const handle = otherCanvasRef.current as
      | (BaseCanvasHandle & { insertSvgAsset?: (svg: string, label: string) => void })
      | null;
    if (!handle?.insertSvgAsset) {
      setExportNotice({ kind: "error", message: "Whiteboard is still loading" });
      window.setTimeout(() => setExportNotice(null), 2400);
      return;
    }
    setInsertingWhiteboardAsset(asset.id);
    handle.insertSvgAsset(asset.svg, asset.label);
    setSaved(false);
    window.setTimeout(() => setInsertingWhiteboardAsset(null), 250);
  }, []);

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
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden bg-[#07101e] text-slate-100">
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
        onExport={handleExport}
        extraExports={mode !== "architecture" ? MODE_REGISTRY[mode]?.capabilities.textExports : undefined}
        hideRasterExports={mode === "kanban"}
        hideGifExport={mode !== "architecture" && mode !== "whiteboard"}
        templates={
          mode === "architecture"
            ? [...ARCHITECTURE_TEMPLATES]
            : MODE_REGISTRY[mode]?.templates.map((t) => ({
                id: t.id,
                name: t.name,
                description: t.description,
              }))
        }
        onApplyTemplate={(id) => {
          if (mode === "architecture") {
            applyArchitectureTemplate(id);
            return;
          }
          const tpl = MODE_REGISTRY[mode]?.templates.find((t) => t.id === id);
          if (!tpl) return;
          setOtherPayloads((prev) => ({ ...prev, [mode]: tpl.payload }));
          otherCanvasRef.current?.hydrate(tpl.payload);
          setSaved(false);
          try {
            localStorage.setItem(
              `diagrammatic.draft.${mode}`,
              JSON.stringify({ payload: tpl.payload, savedAt: Date.now() })
            );
          } catch {
            /* localStorage may be unavailable */
          }
        }}
        onAiAssist={() => setAiOpen(true)}
        onToggleCsaGuidance={
          mode === "architecture"
            ? () => {
                setCsaGuidanceOpen((value) => !value);
                setCommentsOpen(false);
                setVersionsOpen(false);
              }
            : undefined
        }
        csaGuidanceOpen={csaGuidanceOpen}
        onGenerateCode={mode === "architecture" ? () => setCodeModalOpen(true) : undefined}
        onReviewArchitecture={
          mode === "architecture" ? () => setReviewModalOpen(true) : undefined
        }
        onDeployAzure={mode === "architecture" ? () => setDeployModalOpen(true) : undefined}
        canvasTheme={canvasTheme}
        onToggleCanvasTheme={toggleCanvasTheme}
        onFlowArrow={
          mode === "whiteboard"
            ? () => {
                otherCanvasRef.current?.activateFlowArrow?.();
                setExportNotice({
                  kind: "success",
                  message: "Flow arrow active — drag from one symbol to another",
                });
                window.setTimeout(() => setExportNotice(null), 3200);
              }
            : undefined
        }
        onBlankCanvas={handleBlankCanvas}
        aiDisabledReason={
          aiStatus &&
          !(mode === "whiteboard"
            ? aiStatus.imageConfigured
            : aiStatus.diagramConfigured)
            ? mode === "whiteboard"
              ? "AI image generation is not configured."
              : "AI diagram generation is not configured. Set Azure OpenAI env vars on the server."
            : undefined
        }
        onToggleComments={() => {
          setCommentsOpen((v) => !v);
          setCsaGuidanceOpen(false);
        }}
        commentsOpen={commentsOpen}
        onToggleVersions={() => {
          setVersionsOpen((v) => !v);
          setCsaGuidanceOpen(false);
        }}
        versionsOpen={versionsOpen}
        saving={saving}
        saved={saved}
      />

      {/* Mode tab strip */}
      <nav
        className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-800 bg-[#0b1220] px-3 py-1.5 [scrollbar-width:none]"
        aria-label="Workspace modes"
        role="tablist"
      >
        {(Object.keys(MODE_META) as DiagrammaticMode[]).map((m) => {
          const meta = MODE_META[m];
          const active = m === mode;
          const ModeIcon = MODE_ICONS[m];
          return (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={meta.label}
              onClick={() => setMode(m)}
              title={meta.tagline}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                active
                  ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
                  : "border-transparent text-slate-500 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              <ModeIcon className={`h-3.5 w-3.5 ${active ? "text-cyan-400" : ""}`} />
              <span>{meta.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {mode === "architecture" && <Palette icons={icons} />}
        {mode === "whiteboard" && (
          <WhiteboardAssetPalette
            onInsert={insertWhiteboardAsset}
            insertingId={insertingWhiteboardAsset}
          />
        )}
        <main
          className="diagrammatic-canvas-surface relative flex-1"
          data-canvas-theme={canvasTheme}
        >
          {mode === "architecture" ? (
            <>
              <ArchitectureCanvas
                ref={canvasRef}
                value={archPayload}
                onChange={handleArchChange}
                onPlayingChange={setPlaying}
                onSelectionChange={setSelection}
                canvasTheme={canvasTheme}
              />
              {archPayload.nodes.length === 0 && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
                  <div className="pointer-events-auto w-full max-w-xl rounded-3xl border border-slate-200 bg-white/95 p-7 shadow-[0_30px_80px_-34px_rgba(15,23,42,0.35)] backdrop-blur">
                    <div className="flex items-start gap-4">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-600/20">
                        <CloudCog className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-600">
                          Architecture studio
                        </p>
                        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                          Design a review-ready cloud system
                        </h2>
                        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-500">
                          Start from an enterprise blueprint, or drag services and primitives from the library.
                          Every connection can be ordered for a precise animated walkthrough.
                        </p>
                      </div>
                    </div>
                    <div className="mt-6 grid gap-2 sm:grid-cols-2">
                      {ARCHITECTURE_TEMPLATES.slice(0, 4).map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => applyArchitectureTemplate(template.id)}
                          className="group rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50"
                        >
                          <span className="text-xs font-semibold text-slate-800 group-hover:text-sky-800">
                            {template.name}
                          </span>
                          <span className="mt-1 line-clamp-2 block text-[10px] leading-relaxed text-slate-500">
                            {template.description}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4 text-[10px] text-slate-400">
                      <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-slate-600">Drag → connect</span>
                      <span>Select an arrow to set its GIF order</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <ModeCanvasFor
              mode={mode}
              value={otherPayloads[mode]}
              onMount={handleOtherMount}
              onChange={handleOtherChange}
              canvasTheme={canvasTheme}
            />
          )}

          {/* Builder Palette — contextual tile rail to add nodes/relations.
              Whiteboard (Excalidraw native sidebar), Kanban (in-column "+"
              button), and Architecture (1,400-icon Palette on the left)
              already provide their own builder UX, so skip those. */}
          {mode !== "architecture" && mode !== "whiteboard" && mode !== "kanban" && (
            <BuilderPalette
              mode={mode}
              onClear={() => {
                const empty = EMPTY_PAYLOAD_FOR[mode];
                if (!empty) return;
                setOtherPayloads((prev) => ({ ...prev, [mode]: empty }));
                otherCanvasRef.current?.hydrate(empty);
                setSaved(false);
                try {
                  localStorage.setItem(`diagrammatic.draft.${mode}`, JSON.stringify({ payload: empty, savedAt: Date.now() }));
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

        {mode === "architecture" && (
          <Inspector
            issues={issues}
            selection={selection}
            onUpdateSelection={updateSelection}
            onDeleteSelection={() => canvasRef.current?.deleteSelection()}
            onFocusNode={(nodeId) => canvasRef.current?.focusElement(nodeId)}
          />
        )}
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
        {mode === "architecture" && (
          <CsaGuidancePanel
            open={csaGuidanceOpen}
            onClose={() => setCsaGuidanceOpen(false)}
            onApplyPattern={applyArchitectureCenterPattern}
          />
        )}
      </div>

      <StatusBar
        nodeCount={archPayload.nodes?.filter((node) => node.kind !== "group").length ?? 0}
        edgeCount={archPayload.edges?.length ?? 0}
        zoom={100}
        saved={saved}
        saving={saving}
        issuesCount={issues.length}
      />

      {exportNotice && (
        <div
          role="status"
          className={`fixed bottom-10 left-1/2 z-[100] -translate-x-1/2 rounded-xl border px-4 py-2.5 text-xs font-semibold shadow-2xl backdrop-blur ${
            exportNotice.kind === "error"
              ? "border-rose-400/30 bg-rose-950/95 text-rose-100"
              : exportNotice.kind === "success"
                ? "border-emerald-400/30 bg-emerald-950/95 text-emerald-100"
                : "border-cyan-400/30 bg-slate-950/95 text-cyan-100"
          }`}
        >
          {exportNotice.message}
        </div>
      )}

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
              const arch = playgroundGraphToArchPayload(graph as PlaygroundLikeGraph, icons);
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
        onImageResult={(b64, mime) => {
          // Whiteboard-only: insert AI-generated image at viewport center.
          // Feature-detect the optional handle method so we don't crash if
          // the active mode's canvas doesn't implement it.
          const handle = otherCanvasRef.current as (BaseCanvasHandle & { insertImage?: (b64: string, mime: string) => void }) | null;
          if (handle?.insertImage) {
            handle.insertImage(b64, mime);
            setSaved(false);
          }
        }}
      />
      <ArchitectureCodeModal
        open={codeModalOpen}
        payload={archPayload}
        onClose={() => setCodeModalOpen(false)}
      />
      <ArchitectureReviewModal
        open={reviewModalOpen}
        payload={archPayload}
        aiConfigured={Boolean(aiStatus?.diagramConfigured)}
        onClose={() => setReviewModalOpen(false)}
      />
      <AzureDeployModal
        open={deployModalOpen}
        payload={archPayload}
        onClose={() => setDeployModalOpen(false)}
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
  canvasTheme,
}: {
  mode: DiagrammaticMode;
  value: unknown;
  onChange: (p: unknown) => void;
  onMount: (handle: BaseCanvasHandle | null) => void;
  canvasTheme: CanvasTheme;
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
  return (
    <Canvas
      value={initial as never}
      onChange={onChange}
      canvasTheme={canvasTheme}
      ref={refCallback}
    />
  );
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
    data?: { label?: string; protocol?: string; animated?: boolean; step?: number };
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

function playgroundGraphToArchPayload(
  graph: PlaygroundLikeGraph,
  icons: IconLite[]
): ArchPayload {
  const nodes: ArchNode[] = [];
  const groups = new Map(
    (graph.nodes ?? [])
      .filter((node) => node.type === "group")
      .map((node) => [
        node.id,
        {
          x: node.position.x,
          y: node.position.y,
          width: node.width ?? 440,
          height: node.height ?? 220,
        },
      ])
  );
  const absoluteChildParents = new Set<string>();
  for (const [groupId, group] of groups) {
    const children = (graph.nodes ?? []).filter((node) => node.parentId === groupId);
    const fits = (x: number, y: number) =>
      x >= 0 &&
      y >= 0 &&
      x + 132 <= group.width + 24 &&
      y + 116 <= group.height + 24;
    if (
      children.some(
        (child) =>
          !fits(child.position.x, child.position.y) &&
          fits(child.position.x - group.x, child.position.y - group.y)
      )
    ) {
      absoluteChildParents.add(groupId);
    }
  }
  const orderedNodes = [...(graph.nodes ?? [])].sort(
    (a, b) => Number(b.type === "group") - Number(a.type === "group")
  );
  for (const n of orderedNodes) {
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
      const label = (n.data?.label as string) ?? iconId;
      const parent = n.parentId ? groups.get(n.parentId) : undefined;
      const usesAbsoluteCoordinates =
        !!n.parentId && absoluteChildParents.has(n.parentId) && !!parent;
      const resolvedIcon = resolveTemplateIcon(
        iconId,
        label,
        (n.data?.cloud as string | undefined) ?? iconId.split("/")[0],
        icons
      );
      nodes.push({
        kind: "icon",
        id: n.id,
        x: usesAbsoluteCoordinates && parent ? n.position.x - parent.x : n.position.x,
        y: usesAbsoluteCoordinates && parent ? n.position.y - parent.y : n.position.y,
        label,
        iconId: resolvedIcon?.id ?? iconId,
        iconPath: resolvedIcon?.path ?? "",
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
    style: e.data?.animated ? "flow" : "solid",
    step: e.data?.step,
  }));

  return { nodes, edges };
}

const TEMPLATE_ICON_ALIASES: Record<string, string> = {
  entraid: "azureactivedirectory",
  appinsight: "applicationinsight",
  blobstorage: "storageaccountblob",
  iam: "identityandaccessmanagement",
  s3: "simplestorageservice",
  apigateway: "cloudcontrolapi",
  pubsub: "integrationservice",
  cloudloadbalancing: "networking",
};

function iconFingerprint(value: string): string {
  const basename = value.split("/").at(-1) ?? value;
  return basename
    .toLowerCase()
    .replace(/^\d+-icon-service-/, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter(
      (token) =>
        !["azure", "aws", "gcp", "google", "amazon", "microsoft", "icon"].includes(token)
    )
    .map((token) => {
      if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
      if (token.endsWith("ses") && token.length > 4) return token.slice(0, -1);
      if (token.endsWith("s") && token.length > 3) return token.slice(0, -1);
      return token;
    })
    .join("");
}

function resolveTemplateIcon(
  legacyId: string,
  label: string,
  provider: string | undefined,
  icons: IconLite[]
): IconLite | undefined {
  const exact = icons.find((icon) => icon.id === legacyId);
  if (exact) return exact;

  const candidates = provider ? icons.filter((icon) => icon.cloud === provider) : icons;
  const idTerm = iconFingerprint(legacyId);
  const labelTerm = iconFingerprint(label);
  const terms = new Set(
    [idTerm, labelTerm, TEMPLATE_ICON_ALIASES[idTerm], TEMPLATE_ICON_ALIASES[labelTerm]].filter(
      (term): term is string => !!term
    )
  );

  let best: { icon: IconLite; score: number } | undefined;
  for (const icon of candidates) {
    const candidateId = iconFingerprint(icon.id);
    const candidateLabel = iconFingerprint(icon.label);
    let score = 0;
    for (const term of terms) {
      if (candidateId === term || candidateLabel === term) score = Math.max(score, 500);
      else if (candidateId.endsWith(term) || candidateLabel.startsWith(term)) {
        score = Math.max(score, 420);
      } else if (
        term.length >= 5 &&
        (candidateId.includes(term) ||
          candidateLabel.includes(term) ||
          term.includes(candidateLabel))
      ) {
        score = Math.max(score, 300 - Math.abs(candidateLabel.length - term.length));
      }
    }
    if (
      !best ||
      score > best.score ||
      (score === best.score && icon.label.length < best.icon.label.length)
    ) {
      best = { icon, score };
    }
  }
  return best && best.score >= 200 ? best.icon : undefined;
}

// ─── Export helpers ────────────────────────────────────────────────────────

async function exportCanvas(
  format: ExportFormat,
  handle: ArchitectureCanvasHandle | null
) {
  if (!handle) throw new Error("Architecture canvas is not ready");
  const filename = `cloud-architecture-${exportTimestamp()}`;
  if (format === "json") {
    const payload = handle.serialize();
    triggerDownload(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      `${filename}.json`
    );
    return;
  }
  // Export the complete diagram viewport, not only the currently visible crop.
  const viewport = document.querySelector(".react-flow__viewport") as HTMLElement | null;
  if (!viewport) throw new Error("Unable to locate the diagram export surface");

  const { toPng, toSvg, toCanvas } = await import("html-to-image");
  const bounds = handle.getExportBounds();
  const layout = createExportLayout(bounds, format === "gif" ? 1280 : 2400, format === "gif" ? 900 : 1800);
  const commonOptions = {
    cacheBust: true,
    backgroundColor: "#f8fafc",
    width: layout.width,
    height: layout.height,
    style: {
      width: `${layout.width}px`,
      height: `${layout.height}px`,
      transform: `translate(${layout.translateX}px, ${layout.translateY}px) scale(${layout.zoom})`,
      transformOrigin: "0 0",
    },
  };

  if (format === "png") {
    const dataUrl = await toPng(viewport, {
      ...commonOptions,
      pixelRatio: 2,
    });
    triggerDataUrlDownload(dataUrl, `${filename}.png`);
  } else if (format === "svg") {
    const dataUrl = await toSvg(viewport, commonOptions);
    triggerDataUrlDownload(dataUrl, `${filename}.svg`);
  } else if (format === "pdf") {
    const dataUrl = await toPng(viewport, {
      ...commonOptions,
      pixelRatio: 2,
    });
    const { jsPDF } = await import("jspdf");
    const landscape = layout.width >= layout.height;
    const pdf = new jsPDF({
      orientation: landscape ? "landscape" : "portrait",
      unit: "px",
      format: [layout.width, layout.height],
      compress: true,
      hotfixes: ["px_scaling"],
    });
    pdf.setProperties({
      title: "Cloud Architecture",
      subject: "Enterprise cloud architecture exported from Diagrammatic",
      creator: "Diagrammatic",
    });
    pdf.addImage(dataUrl, "PNG", 0, 0, layout.width, layout.height, undefined, "FAST");
    triggerDownload(pdf.output("blob"), `${filename}.pdf`);
  } else if (format === "gif") {
    const blob = await exportSequenceGif(handle, viewport, toCanvas, commonOptions, layout);
    triggerDownload(blob, `${filename}.gif`);
  } else {
    throw new Error(`Unsupported export format: ${format}`);
  }
}

interface ExportLayout {
  width: number;
  height: number;
  zoom: number;
  translateX: number;
  translateY: number;
}

function createExportLayout(
  bounds: { x: number; y: number; width: number; height: number },
  maxWidth: number,
  maxHeight: number
): ExportLayout {
  const padding = 96;
  const usableWidth = Math.max(1, maxWidth - padding * 2);
  const usableHeight = Math.max(1, maxHeight - padding * 2);
  const zoom = Math.min(1.35, usableWidth / bounds.width, usableHeight / bounds.height);
  const width = Math.max(640, Math.ceil(bounds.width * zoom + padding * 2));
  const height = Math.max(420, Math.ceil(bounds.height * zoom + padding * 2));
  return {
    width,
    height,
    zoom,
    translateX: padding - bounds.x * zoom,
    translateY: padding - bounds.y * zoom,
  };
}

// ─── GIF (animated) export ─────────────────────────────────────────────────
//
// Drives the canvas through `recordSequence`, captures six deterministic dash
// positions per numbered stage, and streams them directly into gifenc. This
// produces smooth synchronized line motion without retaining every RGBA frame
// in memory or moving the service cards.
async function exportSequenceGif(
  handle: ArchitectureCanvasHandle,
  target: HTMLElement,
  toCanvas: (node: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLCanvasElement>,
  commonOptions: Record<string, unknown>,
  layout: ExportLayout
): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const outW = layout.width;
  const outH = layout.height;
  const gif = GIFEncoder();
  let palette: ReturnType<typeof quantize> | null = null;
  let frameCount = 0;

  await handle.recordSequence(async (label) => {
    const canvas = await toCanvas(target, {
      ...commonOptions,
      pixelRatio: 1,
    });
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, outW, outH).data;
    if (!palette) palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    const overview = label === "start" || label === "end";
    gif.writeFrame(index, outW, outH, {
      palette: frameCount === 0 ? palette : undefined,
      delay: overview ? 1200 : 120,
    });
    frameCount += 1;
  });

  if (!frameCount) throw new Error("GIF capture produced no frames");
  gif.finish();
  const bytes = gif.bytes();
  window.dispatchEvent(
    new CustomEvent("diagrammatic-gif-capture", {
      detail: { frameCount, motionFramesPerStep: 6 },
    })
  );
  // Copy into a fresh ArrayBuffer-backed Uint8Array so the Blob constructor
  // accepts it under TS's strict ArrayBuffer/SharedArrayBuffer typing.
  const buf = new Uint8Array(bytes.byteLength);
  buf.set(bytes);
  return new Blob([buf], { type: "image/gif" });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const separator = dataUrl.indexOf(",");
  if (separator < 0) throw new Error("Export renderer returned an invalid data URL");
  const header = dataUrl.slice(0, separator);
  const encoded = dataUrl.slice(separator + 1);
  const mime = header.match(/^data:([^;,]+)/)?.[1] ?? "application/octet-stream";
  const binary = header.includes(";base64") ? atob(encoded) : decodeURIComponent(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

function exportTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function triggerDownload(blob: Blob, filename: string) {
  window.dispatchEvent(
    new CustomEvent("diagrammatic-export-ready", {
      detail: { filename, mime: blob.type, size: blob.size },
    })
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function triggerDataUrlDownload(dataUrl: string, filename: string) {
  window.dispatchEvent(
    new CustomEvent("diagrammatic-export-ready", {
      detail: {
        filename,
        mime: dataUrl.match(/^data:([^;,]+)/)?.[1] ?? "application/octet-stream",
        size: Math.floor((dataUrl.length * 3) / 4),
      },
    })
  );
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
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
      const blob = await dataUrlToBlob(dataUrl);
      triggerDownload(blob, `${mode}-${stamp}.png`);
    } else if (format === "svg") {
      const dataUrl = await toSvg(target, { cacheBust: true, backgroundColor: "#0a0a0b" });
      const blob = await dataUrlToBlob(dataUrl);
      triggerDownload(blob, `${mode}-${stamp}.svg`);
    } else if (format === "pdf") {
      const dataUrl = await toPng(target, {
        cacheBust: true,
        backgroundColor: "#0a0a0b",
        pixelRatio: 2,
      });
      const rect = target.getBoundingClientRect();
      const width = Math.max(640, Math.round(rect.width));
      const height = Math.max(420, Math.round(rect.height));
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: width >= height ? "landscape" : "portrait",
        unit: "px",
        format: [width, height],
        compress: true,
        hotfixes: ["px_scaling"],
      });
      pdf.addImage(dataUrl, "PNG", 0, 0, width, height, undefined, "FAST");
      triggerDownload(pdf.output("blob"), `${mode}-${stamp}.pdf`);
    } else {
      throw new Error(`Unsupported ${mode} export format: ${format}`);
    }
  } catch (err) {
    console.error("Generic export failed:", err);
  }
}
