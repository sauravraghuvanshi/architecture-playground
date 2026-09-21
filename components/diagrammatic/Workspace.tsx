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
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { buildPromptArchitecture, type PromptDiagnostics } from "@/lib/prompt-to-arch";
import { parseArchitectureDocument } from "@/lib/architecture-document";
import { parseDiagramPayload } from "@/lib/diagram-payload";
import { architectureMetadataSchema, architectureEdgeSemanticsSchema, legacyNodeSemantics, parseConnectionHandle } from "@/lib/architecture-model";
import { parentFirst } from "@/lib/architecture-hierarchy";
import { generatedArchitectureSchema } from "@/lib/ai-mode-prompts";
import WhiteboardConvertModal from "./shared/WhiteboardConvertModal";
import { collectWhiteboardConversionSource, resolveConversionIcon } from "@/lib/whiteboard-conversion";
import DiagramLibraryModal from "./shared/DiagramLibraryModal";
import { ResponsivePanel } from "./shared/ResponsivePanel";
import { useDiagramDocuments } from "./shared/useDiagramDocuments";
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
import type { WhiteboardCanvasHandle } from "./modes/whiteboard/Canvas";
import { AiPromptModal } from "./shared/AiPromptModal";
import { CommentsPanel } from "./shared/CommentsPanel";
import { VersionsPanel } from "./shared/VersionsPanel";
import { ArchitectureReviewModal } from "./csa/ArchitectureReviewModal";
import { dataUrlToBlob } from "@/lib/data-url";
import { getExportFontCss } from "@/lib/export-fonts";
import { includeDiagramExportNode } from "@/lib/export-filter";
import { releaseExportCanvas, toExportPng } from "@/lib/export-raster";
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
  reviewAgentConfigured: boolean;
  imageSource?: "local" | "configured-proxy" | null;
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
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const modeTabsRef = useRef<HTMLElement | null>(null);
  const libraryOpenerRef = useRef<HTMLElement | null>(null);
  const [tabFocusRequest, setTabFocusRequest] = useState(0);
  const restoredTabFocusRequest = useRef(0);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [documentRevision, setDocumentRevision] = useState(0);
  const [canvasEpochs, setCanvasEpochs] = useState<Partial<Record<DiagrammaticMode, number>>>({});
  const canvasGenerations = useRef<Partial<Record<DiagrammaticMode, number>>>({});
  const advanceCanvas = useCallback((target: DiagrammaticMode) => {
    const generation = (canvasGenerations.current[target] ?? 0) + 1;
    canvasGenerations.current[target] = generation;
    setCanvasEpochs((previous) => ({ ...previous, [target]: generation }));
  }, []);
  const [canvasThemes, setCanvasThemes] = useState<
    Partial<Record<DiagrammaticMode, CanvasTheme>>
  >({});
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [aiStatusError, setAiStatusError] = useState<string | null>(null);
  const [promptDiagnostics, setPromptDiagnostics] = useState<(PromptDiagnostics & { hasDraft: boolean }) | null>(null);
  const [edgeStyle, setEdgeStyle] = useState<ArchEdgeStyle>("flow");
  const [selection, setSelection] = useState<ArchitectureSelection | null>(null);
  const [exportNotice, setExportNotice] = useState<{
    kind: "working" | "success" | "error";
    message: string;
  } | null>(null);
  const exportRun = useRef(false);
  const exportNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (exportNoticeTimer.current) clearTimeout(exportNoticeTimer.current); }, []);
  const [insertingWhiteboardAsset, setInsertingWhiteboardAsset] = useState<string | null>(null);
  const canvasRef = useRef<ArchitectureCanvasHandle | null>(null);
  const [documentSaveError, setDocumentSaveError] = useState<string | null>(null);
  const [architectureReady, setArchitectureReady] = useState(false);
  const [whiteboardReady, setWhiteboardReady] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const externalSeed = Boolean(initialPayload || searchParams?.get("prompt") || searchParams?.get("template") || searchParams?.get("templateHandoff"));
  const library = useDiagramDocuments({
    mode, revision: documentRevision, externalSeed, suspended: libraryOpen,
    requestedId: searchParams?.get("document"),
    capture: (targetMode): unknown => {
      if ((canvasGenerations.current[targetMode] ?? 0) !== (canvasEpochs[targetMode] ?? 0)) {
        throw new Error("The canvas is changing documents. Wait for it to finish before saving.");
      }
      if (targetMode === "architecture") return mode === targetMode ? canvasRef.current?.serialize() ?? archPayload : archPayload;
      if (targetMode === mode && otherCanvasRef.current) return otherCanvasRef.current.serialize();
      if (otherPayloads[targetMode] !== undefined) return otherPayloads[targetMode];
      if (library.blockedDrafts[targetMode]) return EMPTY_PAYLOAD_FOR[targetMode];
      const raw = localStorage.getItem(`diagrammatic.draft.${targetMode}`);
      return raw ? JSON.parse(raw).payload : MODE_REGISTRY[targetMode]?.defaultPayload;
    },
    theme: (targetMode) => canvasThemes[targetMode] ?? defaultCanvasTheme(targetMode),
    apply: (document, activate) => {
      setPromptDiagnostics(null);
      if (document.mode === "architecture") setArchPayload(parseArchitectureDocument(document.payload));
      else {
        const checked = parseDiagramPayload(document.mode, document.payload);
        setOtherPayloads((previous) => ({ ...previous, [document.mode]: checked }));
      }
      setCanvasThemes((previous) => ({ ...previous, [document.mode]: document.canvasTheme }));
      advanceCanvas(document.mode);
      setSelection(null);
      setCommentsOpen(false);
      setVersionsOpen(false);
      setDocumentRevision((value) => value + 1);
      if (activate) setMode(document.mode);
    },
    onError: (message) => {
      setDocumentSaveError(message);
      setExportNotice({ kind: "error", message });
    },
  });
  const currentDocument = library.documents[mode];
  useEffect(() => {
    if (!library.ready) return;
    const url = new URL(window.location.href);
    if (currentDocument) {
      for (const key of ["prompt", "template", "templateHandoff"]) url.searchParams.delete(key);
      url.searchParams.set("document", currentDocument.id);
    } else {
      url.searchParams.delete("document");
    }
    url.searchParams.set("mode", mode);
    if (url.toString() !== window.location.href) window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [currentDocument, library.ready, mode]);

  const libraryFromUrlApplied = useRef(false);
  useEffect(() => {
    if (!library.ready || libraryFromUrlApplied.current) return;
    libraryFromUrlApplied.current = true;
    if (searchParams?.get("library") === "1") {
      requestAnimationFrame(() => setLibraryOpen(true));
    }
  }, [library.ready, searchParams]);

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
    setDocumentRevision((value) => value + 1);
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
      } else if (!icon) setExportNotice({ kind: "error", message: "The dragged service is not in the bundled catalog. Choose a service from the palette." });
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
    if (!seed || !icons.length) return;
    const result = buildPromptArchitecture(seed, icons, { animateEdges: true });
    promptApplied.current = true;
    requestAnimationFrame(() => {
      setPromptDiagnostics({
        ...(result.payload || result.diagnostics.unmatched.length ? result.diagnostics : {
          unmatched: ["No supported service names were recognized. Specify a provider and product, or add components manually."], assumptions: [],
        }),
        hasDraft: !!result.payload,
      });
      if (result.payload?.nodes.length) {
        advanceCanvas("architecture");
        setArchPayload(result.payload);
      }
    });
  }, [searchParams, icons, advanceCanvas]);

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
      const arch = parsed?.graph ? parseArchitectureDocument(playgroundGraphToArchPayload(parsed.graph, icons)) : null;
      if (arch && arch.nodes.length) {
        handoffApplied.current = true;
        promptApplied.current = true; // suppress the prompt path on the same load
        requestAnimationFrame(() => {
          advanceCanvas("architecture");
          setArchPayload(arch);
        });
        if (storeKey) {
          localStorage.removeItem(storeKey);
          sessionStorage.removeItem(storeKey);
        }
        sessionStorage.removeItem(TEMPLATE_HANDOFF_KEY);
      }
    } catch (cause) {
      handoffApplied.current = true;
      const message = `Template could not be opened: ${cause instanceof Error ? cause.message : "Invalid template data."} Existing saved diagrams have not been changed.`;
      requestAnimationFrame(() => setExportNotice({ kind: "error", message }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Mark unsaved when canvas state changes.
  const handleArchChange = useCallback((next: ArchPayload) => {
    if (!library.ready || (canvasGenerations.current.architecture ?? 0) !== (canvasEpochs.architecture ?? 0)) return;
    setArchPayload(next);
    setSaved(false);
    setDocumentRevision((value) => value + 1);
  }, [library.ready, canvasEpochs.architecture]);

  const saveCurrentDocument = useCallback(async (name?: string) => {
    try {
      await library.save(name);
      setDocumentSaveError(null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The diagram could not be saved.";
      setDocumentSaveError(message);
      setExportNotice({ kind: "error", message });
      throw cause;
    }
  }, [library]);

  const switchMode = useCallback(async (targetMode: DiagrammaticMode) => {
    if (targetMode === mode) return;
    try {
      await saveCurrentDocument();
      setMode(targetMode);
    } catch {
      // The save error is already shown; retain the outgoing canvas for recovery.
    }
  }, [mode, saveCurrentDocument]);

  const handleSave = useCallback(async () => {
    if (!currentDocument) {
      libraryOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setLibraryOpen(true);
      return;
    }
    setSaving(true);
    try {
      await saveCurrentDocument();
      setSaved(true);
    } catch {
      setSaved(false);
    } finally {
      setSaving(false);
    }
  }, [currentDocument, saveCurrentDocument]);

  const handleOpenLibrary = useCallback(async () => {
    libraryOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    try {
      await saveCurrentDocument();
      setLibraryOpen(true);
    } catch {
      // Keep the current document visible when saving fails.
    }
  }, [saveCurrentDocument]);

  const goHome = useCallback(async () => {
    try {
      await saveCurrentDocument();
      router.push("/");
    } catch {
      // A failed save leaves the canvas open with recovery actions.
    }
  }, [router, saveCurrentDocument]);

  const captureActiveCanvas = useCallback(() => {
    if ((canvasGenerations.current[mode] ?? 0) !== (canvasEpochs[mode] ?? 0)) throw new Error("The canvas is changing documents. Wait before leaving.");
    const canvas = mode === "architecture" ? canvasRef.current : otherCanvasRef.current;
    if (!canvas) throw new Error("The canvas is still loading. Wait before leaving.");
    return canvas.serialize();
  }, [mode, canvasEpochs]);

  const persistScratchDraft = useCallback((payload: unknown) => {
    if (library.blockedDrafts[mode]) {
      throw new Error("The original draft needs recovery and has not been overwritten. Save a recovery copy or export your current canvas before leaving.");
    }
    const checked = parseDiagramPayload(mode, payload);
    localStorage.setItem(
      mode === "architecture" ? "diagrammatic.draft" : `diagrammatic.draft.${mode}`,
      JSON.stringify({ mode, payload: checked, savedAt: Date.now() }),
    );
    setSaved(true);
  }, [mode, library.blockedDrafts]);

  const reportPersistenceFailure = useCallback((cause: unknown) => {
    const detail = cause instanceof Error ? cause.message : "Browser storage is unavailable.";
    const message = `Could not preserve the current diagram: ${detail} Save a recovery copy or export before leaving.`;
    setSaved(false);
    setDocumentSaveError(message);
    setExportNotice({ kind: "error", message });
  }, []);

  const saveRecoveryCopy = useCallback(() => {
    void library.saveCopy(`${currentDocument?.name ?? MODE_META[mode].label} (recovery copy)`).then(() => {
      setDocumentSaveError(null);
      setExportNotice({ kind: "success", message: "Saved your current work as a separate document. The original was not overwritten." });
    }).catch(reportPersistenceFailure);
  }, [library, currentDocument, mode, reportPersistenceFailure]);

  useEffect(() => {
    if (!library.ready) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      try {
        if (!currentDocument) {
          // Read the live engine, including edits not delivered by its next animation frame.
          persistScratchDraft(captureActiveCanvas());
          return;
        }
        if (!library.hasPendingChanges()) return;
      } catch (cause) {
        reportPersistenceFailure(cause);
      }
      event.preventDefault();
      event.returnValue = "";
    };
    const flush = () => {
      try {
        if (!currentDocument) persistScratchDraft(captureActiveCanvas());
        else if (!library.busy && library.hasPendingChanges()) void library.save().catch(reportPersistenceFailure);
      } catch (cause) {
        reportPersistenceFailure(cause);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("pagehide", flush);
    window.addEventListener("popstate", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("popstate", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [library, currentDocument, captureActiveCanvas, persistScratchDraft, reportPersistenceFailure]);

  // Architecture mode now autosaves like every other mode. The debounce keeps
  // drag operations fluid while ensuring a refresh does not discard work.
  useEffect(() => {
    if (!library.ready || currentDocument || mode !== "architecture" || initialDiagramId || library.blockedDrafts.architecture) return;
    const timer = window.setTimeout(() => {
      try {
        persistScratchDraft(archPayload);
      } catch (cause) {
        reportPersistenceFailure(cause);
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [archPayload, initialDiagramId, mode, library.ready, library.blockedDrafts.architecture, currentDocument, persistScratchDraft, reportPersistenceFailure]);

  // ?mode=<id> on first load — set the mode if URL specifies one. One-shot;
  // subsequent tab clicks own the mode via setMode.
  const modeFromUrlApplied = useRef(false);
  useEffect(() => {
    if (modeFromUrlApplied.current) return;
    if (searchParams?.get("document")) {
      modeFromUrlApplied.current = true;
      return;
    }
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new DOMException("AI readiness timed out.", "TimeoutError")), 10_000);
    fetch("/api/ai/status", { signal: controller.signal, cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`AI availability check failed (HTTP ${r.status}).`);
        return r.json();
      })
      .then(
        (result: {
          configured?: boolean;
          diagramConfigured?: boolean;
          imageConfigured?: boolean;
          imageSource?: AiStatus["imageSource"];
          reviewAgentConfigured?: boolean;
        }) => {
          if (!result || typeof result !== "object" ||
            [result.configured, result.diagramConfigured, result.imageConfigured].some((flag) => flag !== undefined && typeof flag !== "boolean") ||
            typeof result.diagramConfigured !== "boolean" || typeof result.imageConfigured !== "boolean") {
            throw new Error("The AI availability response is invalid.");
          }
          if (!cancelled) {
            setAiStatus({
              diagramConfigured: result.diagramConfigured,
              imageConfigured: result.imageConfigured,
              imageSource: result.imageSource,
              reviewAgentConfigured: result.reviewAgentConfigured === true,
            });
          }
        }
      )
      .catch((cause: unknown) => {
        if (!cancelled) {
          console.error("AI availability check failed.", cause);
          setAiStatusError("AI availability could not be checked. Reload to try again.");
          setAiStatus({ diagramConfigured: false, imageConfigured: false, reviewAgentConfigured: false });
        }
      }).finally(() => clearTimeout(timeout));
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, []);

  const meta = MODE_META[mode];

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (exportRun.current) {
        setExportNotice({ kind: "working", message: "An export is already being prepared. Wait for it to finish." });
        return;
      }
      exportRun.current = true;
      if (exportNoticeTimer.current) clearTimeout(exportNoticeTimer.current);
      const label = format.toUpperCase();
      setExportNotice({ kind: "working", message: `Preparing ${label} export…` });
      try {
        if (mode === "architecture") {
          await exportCanvas(format, canvasRef.current, canvasTheme);
        } else {
          await exportOther(format, mode, otherCanvasRef.current, canvasTheme);
        }
        setExportNotice({ kind: "success", message: `${label} export downloaded` });
      } catch (error) {
        console.error("Export failed:", error);
        setExportNotice({
          kind: "error",
          message: error instanceof Error ? error.message : `${label} export failed`,
        });
      }
      exportRun.current = false;
      exportNoticeTimer.current = setTimeout(() => setExportNotice(null), 3200);
    },
    [mode, canvasTheme]
  );

  const updateSelection = useCallback(
    (id: string, patch: ArchitectureSelectionPatch) => {
      canvasRef.current?.updateElement(id, patch);
    },
    []
  );

  const handleBlankCanvas = useCallback(async (targetMode: DiagrammaticMode = mode, name = `Untitled ${MODE_META[targetMode].label}`) => {
    const empty =
      targetMode === "architecture" ? ARCHITECTURE_EMPTY_PAYLOAD : EMPTY_PAYLOAD_FOR[targetMode];
    if (!empty) throw new Error("This mode does not support a blank diagram.");
    await library.create(targetMode, name, structuredClone(empty));
  }, [library, mode]);

  const createBlank = useCallback((targetMode: DiagrammaticMode = mode) => {
    void handleBlankCanvas(targetMode).then(() => setDocumentSaveError(null)).catch((cause) => {
      const message = cause instanceof Error ? cause.message : "A new diagram could not be created. Your current diagram is unchanged.";
      setDocumentSaveError(message);
      setExportNotice({ kind: "error", message });
    });
  }, [handleBlankCanvas, mode]);

  const handleOtherChange = useCallback(
    (payload: unknown) => {
      if (!library.ready || (canvasGenerations.current[mode] ?? 0) !== (canvasEpochs[mode] ?? 0)) return;
      setOtherPayloads((previous) => ({ ...previous, [mode]: payload }));
      setSaved(false);
      setDocumentRevision((value) => value + 1);
      if (currentDocument || library.blockedDrafts[mode]) return;
      try {
        persistScratchDraft(payload);
      } catch (cause) {
        reportPersistenceFailure(cause);
      }
    },
    [mode, canvasEpochs, library.ready, library.blockedDrafts, currentDocument, persistScratchDraft, reportPersistenceFailure]
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
    const next: ArchEdgeStyle =
      edgeStyle === "solid" ? "dashed" : edgeStyle === "dashed" ? "flow" : "solid";
    canvasRef.current?.setAllEdgeStyle(next);
  }, [edgeStyle]);

  // Route command-palette actions back to canvas / state.
  const handleCommand = useCallback(
    (id: string) => {
      const activeCanvas = mode === "architecture" ? canvasRef.current : otherCanvasRef.current;
      const commandModes: Record<string, DiagrammaticMode> = {
        "new-arch": "architecture", "mode-arch": "architecture",
        "new-flow": "flowchart", "mode-flow": "flowchart",
        "new-mind": "mindmap", "new-seq": "sequence", "new-er": "er",
        "new-uml": "uml", "new-wb": "whiteboard", "new-kanban": "kanban", "new-c4": "c4",
      };
      if (commandModes[id]) {
        if (id.startsWith("new-")) createBlank(commandModes[id]);
        else void switchMode(commandModes[id]);
        return;
      }
      if (id.startsWith("export-")) { void handleExport(id.slice(7)); return; }
      switch (id) {
        case "save":
          handleSave();
          break;
        case "my-diagrams":
          void handleOpenLibrary();
          break;
        case "fit":
          activeCanvas?.fit();
          break;
        case "undo":
          activeCanvas?.undo();
          break;
        case "redo":
          activeCanvas?.redo();
          break;
        case "delete":
          activeCanvas?.deleteSelection();
          break;
        case "shortcuts":
          setHintsOpen(true);
          break;
        case "ai-generate":
          setAiOpen(true);
          break;
        case "ai-explain":
        case "ai-validate":
          if (mode === "architecture") setReviewModalOpen(true);
          else setExportNotice({ kind: "error", message: "Architecture review is available in Cloud Architecture mode." });
          break;
        default:
          setExportNotice({ kind: "error", message: "This action is not available. Use the toolbar to export or manage your diagram." });
          break;
      }
    },
    [handleSave, handleExport, handleOpenLibrary, createBlank, switchMode, mode]
  );

  // Global keyboard shortcuts beyond ⌘K (handled inside CommandPalette).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!library.ready || library.busy || (mode === "architecture" && !architectureReady) || (mode === "whiteboard" && !whiteboardReady)) return;
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      if (e.defaultPrevented || target?.closest('[role="dialog"]')) return;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      const activeCanvas = mode === "architecture" ? canvasRef.current : otherCanvasRef.current;
      if (e.key === "?" && !inField) {
        e.preventDefault();
        setHintsOpen((v) => !v);
      } else if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      } else if (meta && e.key === "0" && !inField) {
        e.preventDefault();
        activeCanvas?.fit();
      } else if (meta && e.key.toLowerCase() === "z" && !e.shiftKey && !inField && mode !== "whiteboard") {
        e.preventDefault();
        activeCanvas?.undo();
      } else if (meta && !inField && mode !== "whiteboard" && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        e.preventDefault();
        activeCanvas?.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, mode, library.ready, library.busy, architectureReady, whiteboardReady]);

  const workspaceLoading = !library.ready || library.busy || (mode === "architecture" && !architectureReady) || (mode === "whiteboard" && !whiteboardReady);
  useEffect(() => {
    if (workspaceLoading || restoredTabFocusRequest.current === tabFocusRequest) return;
    restoredTabFocusRequest.current = tabFocusRequest;
    modeTabsRef.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true });
  }, [tabFocusRequest, workspaceLoading]);
  return (
    <>
    {workspaceLoading && <p role="status" className="sr-only">Loading saved diagram and canvas.</p>}
    <div inert={workspaceLoading} aria-busy={workspaceLoading} className="flex h-dvh min-w-0 flex-col overflow-hidden bg-[#07101e] text-slate-100">
      <input ref={importInputRef} type="file" accept=".json,application/json" className="hidden"
        aria-label="Architecture JSON file"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          try {
            if (file.size > 5 * 1024 * 1024) throw new Error("Architecture JSON must be 5 MiB or smaller.");
            const payload = parseArchitectureDocument(JSON.parse(await file.text()));
            if (archPayload.nodes.length && !window.confirm("Replace the current architecture with this imported diagram?")) return;
            setArchPayload(payload);
            setPromptDiagnostics(null);
            canvasRef.current?.hydrate(payload);
            setSelection(null);
            setSaved(false);
            setExportNotice({ kind: "success", message: `Imported ${payload.nodes.length} nodes and ${payload.edges.length} connections.` });
          } catch (error) {
            setExportNotice({ kind: "error", message: error instanceof Error ? `Import failed: ${error.message}` : "Import failed." });
          }
        }} />
      <Toolbar
        title={currentDocument ? `${currentDocument.name} / ${meta.label}` : meta.label}
        onOpenLibrary={() => void handleOpenLibrary()}
        onOpenAssets={mode === "architecture" || mode === "whiteboard" ? () => {
          setAssetsOpen((value) => !value); setInspectorOpen(false); setCommentsOpen(false); setVersionsOpen(false);
        } : undefined}
        assetsLabel={mode === "whiteboard" ? "Open Whiteboard assets" : "Open architecture components"}
        assetsOpen={assetsOpen}
        onOpenInspector={mode === "architecture" ? () => {
          setInspectorOpen((value) => !value); setAssetsOpen(false); setCommentsOpen(false); setVersionsOpen(false);
        } : undefined}
        inspectorOpen={inspectorOpen}
        onGoHome={() => void goHome()}
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
        onAiAssist={() => setAiOpen(true)}
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
        onBlankCanvas={() => createBlank()}
        onImportArchitecture={mode === "architecture" ? () => importInputRef.current?.click() : undefined}
        onConvertWhiteboard={mode === "whiteboard" ? () => setConvertOpen(true) : undefined}
        aiDisabledReason={
          aiStatusError ?? (!aiStatus ? "Checking AI availability..." :
          !(mode === "whiteboard"
            ? aiStatus.imageConfigured
            : aiStatus.diagramConfigured)
            ? mode === "whiteboard"
              ? "AI image generation is not configured."
              : "AI diagram generation is not configured. Set Azure OpenAI env vars on the server."
            : undefined)
        }
        onToggleComments={() => {
          setCommentsOpen((v) => !v);
          setVersionsOpen(false); setAssetsOpen(false); setInspectorOpen(false);
        }}
        commentsOpen={commentsOpen}
        onToggleVersions={() => {
          setVersionsOpen((v) => !v);
          setCommentsOpen(false); setAssetsOpen(false); setInspectorOpen(false);
        }}
        versionsOpen={versionsOpen}
        saving={saving || library.busy}
        saved={currentDocument ? library.saved : saved}
      />

      {/* Mode tab strip */}
      <nav
        ref={modeTabsRef}
        className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-800 bg-[#0b1220] px-3 py-1.5 [scrollbar-width:none]"
        aria-label="Workspace modes"
        role="tablist"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
          const index = tabs.findIndex((tab) => tab === document.activeElement);
          if (index < 0) return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
          tabs[next]?.focus();
        }}
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
              tabIndex={active ? 0 : -1}
              aria-label={meta.label}
              onClick={async () => {
                await switchMode(m);
                setTabFocusRequest((request) => request + 1);
              }}
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

      {mode === "architecture" && promptDiagnostics && (
        <section aria-label="Prompt coverage" className="max-h-40 shrink-0 overflow-y-auto border-b border-amber-800/50 bg-amber-950/25 px-4 py-2 text-xs text-amber-100">
          <div className="flex items-start justify-between gap-4">
            <p><strong>{promptDiagnostics.hasDraft ? "Heuristic draft:" : "No draft generated:"}</strong> one instance per recognized service. Review unrecognized requirements, counts, configuration and topology; this is not a complete requirements validation.</p>
            <button type="button" aria-label="Dismiss prompt coverage" onClick={() => setPromptDiagnostics(null)} className="shrink-0 rounded border border-amber-700 px-2 py-1 hover:bg-amber-900">Dismiss</button>
          </div>
          {promptDiagnostics.unmatched.length > 0 && (
            <details open className="mt-2">
              <summary className="cursor-pointer font-semibold">{promptDiagnostics.unmatched.length} unmatched recognized requirements</summary>
              <ul className="mt-1 list-disc space-y-1 pl-5">{promptDiagnostics.unmatched.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </details>
          )}
          {promptDiagnostics.assumptions.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer font-semibold">{promptDiagnostics.assumptions.length} proposed service choices</summary>
              <ul className="mt-1 list-disc space-y-1 pl-5">{promptDiagnostics.assumptions.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </details>
          )}
        </section>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {mode === "architecture" && <ResponsivePanel id="workspace-assets" title="Architecture components" side="left" open={assetsOpen} onClose={() => setAssetsOpen(false)}>
          <Palette icons={icons} onInsert={() => setAssetsOpen(false)} />
        </ResponsivePanel>}
        {mode === "whiteboard" && (
          <ResponsivePanel id="workspace-assets" title="Whiteboard assets" side="left" open={assetsOpen} onClose={() => setAssetsOpen(false)}>
          <WhiteboardAssetPalette
            onInsert={(asset) => { insertWhiteboardAsset(asset); setAssetsOpen(false); }}
            insertingId={insertingWhiteboardAsset}
          />
          </ResponsivePanel>
        )}
        <main
          className="diagrammatic-canvas-surface relative min-h-0 min-w-0 flex-1"
          data-canvas-theme={canvasTheme}
        >
          {mode === "architecture" ? (
            <>
              <ArchitectureCanvas
                key={`architecture:${canvasEpochs.architecture ?? 0}`}
                ref={canvasRef}
                onReadyChange={setArchitectureReady}
                value={archPayload}
                onChange={handleArchChange}
                onPlayingChange={setPlaying}
                onEdgeStyleChange={setEdgeStyle}
                onError={(message) => setExportNotice({ kind: "error", message })}
                onSelectionChange={setSelection}
                canvasTheme={canvasTheme}
              />
              {archPayload.nodes.length === 0 && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
                  <div className="pointer-events-none w-full max-w-xl rounded-3xl border border-slate-200 bg-white/95 p-7 shadow-[0_30px_80px_-34px_rgba(15,23,42,0.35)] backdrop-blur">
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
                    <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      <Link href="/templates" className="pointer-events-auto font-semibold text-sky-700 hover:underline">Browse starting designs</Link>
                      <p className="mt-1">The gallery contains reusable blueprints. Once you build your diagram, use Review my architecture for personalized findings.</p>
                    </div>
                    <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4 text-[10px] text-slate-400">
                      <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-slate-600">Drag → connect</span>
                      <span>Select an arrow to set its GIF order</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : !library.ready ? <CanvasLoading /> : (
            <ModeCanvasFor
              key={`${mode}:${canvasEpochs[mode] ?? 0}`}
              mode={mode}
              value={otherPayloads[mode] ?? (library.blockedDrafts[mode] ? EMPTY_PAYLOAD_FOR[mode] : undefined)}
              onMount={handleOtherMount}
              onChange={handleOtherChange}
              onReadyChange={mode === "whiteboard" ? setWhiteboardReady : undefined}
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
                setDocumentRevision((value) => value + 1);
                if (!currentDocument && !library.blockedDrafts[mode]) {
                  try { persistScratchDraft(empty); }
                  catch (cause) { reportPersistenceFailure(cause); }
                }
              }}
            />
          )}

          {/* Floating ⌘K hint */}
          <button
            type="button"
            onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); setCmdOpen(true); }}
            className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 rounded-lg shadow-lg backdrop-blur transition-colors cursor-pointer"
            aria-label="Open command palette"
          >
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-zinc-950 border border-zinc-800 rounded">⌘K</kbd>
            commands
          </button>
        </main>

        {mode === "architecture" && (
          <ResponsivePanel id="architecture-properties" title="Architecture properties" open={inspectorOpen} onClose={() => setInspectorOpen(false)} desktopVisible={!commentsOpen && !versionsOpen}>
          <Inspector
            issues={issues}
            architectureMetadata={archPayload.metadata}
            selection={selection}
            onUpdateSelection={updateSelection}
            onDeleteSelection={() => canvasRef.current?.deleteSelection()}
            onFocusNode={(nodeId) => canvasRef.current?.focusElement(nodeId)}
          />
          </ResponsivePanel>
        )}
        <ResponsivePanel id="workspace-comments" title="Diagram comments" open={commentsOpen} desktopVisible={commentsOpen} onClose={() => setCommentsOpen(false)}>
        <CommentsPanel
          key={`comments:${mode}:${currentDocument?.id ?? "draft"}`}
          scopeId={`${mode}:${currentDocument?.id ?? "draft"}`}
          initialComments={currentDocument?.comments}
          onChange={(comments) => { library.annotate({ comments }); setDocumentRevision((value) => value + 1); }}
          open={commentsOpen}
          onClose={() => setCommentsOpen(false)}
        />
        </ResponsivePanel>
        <ResponsivePanel id="workspace-versions" title="Diagram versions" open={versionsOpen} desktopVisible={versionsOpen} onClose={() => setVersionsOpen(false)}>
        <VersionsPanel
          key={`versions:${mode}:${currentDocument?.id ?? "draft"}`}
          scopeId={`${mode}:${currentDocument?.id ?? "draft"}`}
          initialVersions={currentDocument?.versions}
          onChange={(versions) => { library.annotate({ versions }); setDocumentRevision((value) => value + 1); }}
          open={versionsOpen}
          onClose={() => setVersionsOpen(false)}
          getCurrent={() => (mode === "architecture" ? canvasRef.current?.serialize() ?? archPayload : otherCanvasRef.current?.serialize() ?? otherPayloads[mode])}
          onRestore={(payload) => {
            try {
              if (mode === "architecture") {
                const checked = parseArchitectureDocument(payload);
                if (!canvasRef.current) throw new Error("The canvas is still loading.");
                canvasRef.current.hydrate(checked);
                setArchPayload(checked);
              } else {
                if (!otherCanvasRef.current) throw new Error("The canvas is still loading.");
                const checked = parseDiagramPayload(mode, payload);
                otherCanvasRef.current.hydrate(checked);
                setOtherPayloads((prev) => ({ ...prev, [mode]: checked }));
              }
              setSaved(false);
              setDocumentRevision((value) => value + 1);
            } catch (cause) {
              setExportNotice({ kind: "error", message: `Snapshot could not be restored: ${cause instanceof Error ? cause.message : "Invalid diagram data."}` });
            }
          }}
        />
        </ResponsivePanel>
      </div>

      {library.recoveryIssues.length > 0 && (
        <details className="shrink-0 border-t border-amber-400/30 bg-amber-950 px-4 py-2 text-xs text-amber-100" open>
          <summary className="cursor-pointer font-semibold">Some saved data needs recovery. Original data has been retained.</summary>
          <div role="alert" className="max-h-28 overflow-y-auto pt-2">
            <ul className="list-disc space-y-1 pl-4">
              {library.recoveryIssues.map((issue, index) => <li key={`${issue.mode}:${issue.storageKey ?? index}`}>{issue.message}</li>)}
            </ul>
            <button type="button" className="mt-2 rounded border border-amber-200/40 px-2 py-1 underline"
              onClick={() => {
                try {
                  const data = library.recoveryIssues.map((issue) => ({
                    ...issue,
                    ...(issue.storageKey ? { originalData: localStorage.getItem(issue.storageKey) } : {}),
                  }));
                  triggerDownload(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `diagram-recovery-${exportTimestamp()}.json`);
                } catch (cause) { reportPersistenceFailure(cause); }
              }}>Download recovery data</button>
            {!currentDocument && library.blockedDrafts[mode] && (
              <button type="button" onClick={saveRecoveryCopy}
                className="ml-2 mt-2 rounded border border-amber-200/40 px-2 py-1 underline">Save recovery copy</button>
            )}
          </div>
        </details>
      )}

      <StatusBar
        nodeCount={mode === "architecture" ? archPayload.nodes?.filter((node) => node.kind !== "group").length ?? 0 : undefined}
        edgeCount={mode === "architecture" ? archPayload.edges?.length ?? 0 : undefined}
        saved={currentDocument ? library.saved : saved}
        saving={saving || library.busy}
        issuesCount={mode === "architecture" ? issues.length : undefined}
      />

      {exportNotice && !library.recoveryIssues.some((issue) => issue.message === exportNotice.message) && (
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
          {documentSaveError && (currentDocument || !library.blockedDrafts[mode]) && (
            <button type="button" className="ml-3 rounded border border-current px-2 py-1 underline"
              onClick={saveRecoveryCopy}>Save recovery copy</button>
          )}
        </div>
      )}

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} onAction={handleCommand} />
      <DiagramLibraryModal
        returnFocusRef={libraryOpenerRef}
        open={libraryOpen && library.ready}
        onClose={() => setLibraryOpen(false)}
        currentMode={mode}
        currentName={currentDocument?.name ?? ""}
        currentDocumentId={currentDocument?.id}
        onSave={saveCurrentDocument}
        onNew={handleBlankCanvas}
        onOpen={library.open}
        onRenamed={library.renamed}
        onDeleted={(id) => {
          const removed = Object.values(library.documents).find((document) => document.id === id);
          if (removed) {
            const blank = removed.mode === "architecture" ? ARCHITECTURE_EMPTY_PAYLOAD : EMPTY_PAYLOAD_FOR[removed.mode];
            if (removed.mode === "architecture") setArchPayload(structuredClone(ARCHITECTURE_EMPTY_PAYLOAD));
            else setOtherPayloads((previous) => ({ ...previous, [removed.mode]: structuredClone(blank) }));
            localStorage.removeItem(removed.mode === "architecture" ? "diagrammatic.draft" : `diagrammatic.draft.${removed.mode}`);
            advanceCanvas(removed.mode);
          }
          library.deleted(id);
        }}
      />
      <KeyboardHints open={hintsOpen} onClose={() => setHintsOpen(false)} />
      <AiPromptModal
        mode={mode}
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onResult={async (graph) => {
          if (mode === "architecture") {
            const arch = parseArchitectureDocument(playgroundGraphToArchPayload(generatedArchitectureSchema.parse(graph), icons));
            await library.create("architecture", "AI design proposal", arch);
          } else {
            await library.create(mode, `AI ${meta.label}`, graph);
          }
          setSaved(false);
          setPromptDiagnostics(null);
        }}
        getImageCanvasContext={() => {
          const handle = otherCanvasRef.current as WhiteboardCanvasHandle | null;
          if (!handle?.getImageCanvasContext) throw new Error("Whiteboard is not ready.");
          return handle.getImageCanvasContext();
        }}
        onImageResult={async (b64, mime, canvas, signal) => {
          const handle = otherCanvasRef.current as WhiteboardCanvasHandle | null;
          if (!handle?.insertImage) throw new Error("Whiteboard is not ready.");
          await handle.insertImage(b64, mime, { canvas, signal });
          setSaved(false);
        }}
      />
      <ArchitectureReviewModal
        key={library.documents.architecture?.id ?? "architecture-draft"}
        open={reviewModalOpen}
        payload={archPayload}
        reviewAgentConfigured={Boolean(aiStatus?.reviewAgentConfigured)}
        onClose={() => setReviewModalOpen(false)}
      />
      <AzureDeployModal
        open={deployModalOpen}
        payload={archPayload}
        onClose={() => setDeployModalOpen(false)}
      />
      <WhiteboardConvertModal
        open={convertOpen && mode === "whiteboard"}
        icons={icons}
        getSourceNodes={() => collectWhiteboardConversionSource(otherCanvasRef.current?.serialize())}
        onClose={() => setConvertOpen(false)}
        getImage={async () => {
          const blob = await otherCanvasRef.current?.exportBlob?.("png");
          if (!blob) throw new Error("Whiteboard is not ready to export.");
          return blob;
        }}
        onResult={(payload) => library.create("architecture", "Converted Whiteboard", payload)}
      />
    </div>
    </>
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
  onReadyChange,
}: {
  mode: DiagrammaticMode;
  value: unknown;
  onChange: (p: unknown) => void;
  onMount: (handle: BaseCanvasHandle | null) => void;
  canvasTheme: CanvasTheme;
  onReadyChange?: (ready: boolean) => void;
}) {
  const entry = MODE_REGISTRY[mode];
  const initial = useMemo(() => {
    if (value !== undefined) return value;
    if (mode === "whiteboard") return entry?.defaultPayload;
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
      onReadyChange={onReadyChange}
      canvasTheme={canvasTheme}
      ref={refCallback}
    />
  );
}

// ─── Playground graph → ArchPayload adapter ────────────────────────────────
// The /templates registry returns a `PlaygroundGraph` (service / group nodes
// with rich data). We map the subset the architecture canvas understands.

interface PlaygroundLikeGraph {
  metadata?: unknown;
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: {
      label?: string;
      iconId?: string;
      variant?: string;
      cloud?: unknown;
      properties?: unknown;
      semantics?: unknown;
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
    sourceHandle?: string | null;
    targetHandle?: string | null;
    data?: { label?: string; protocol?: string; animated?: boolean; step?: number; lineStyle?: "solid" | "dashed" | "dotted"; connectionType?: string; arrowStyle?: string; description?: string; semantics?: unknown };
  }>;
}

const VARIANT_TO_TIER: Record<string, string> = {
  vpc: "VPC",
  vnet: "Virtual Network",
  "landing-zone": "Landing Zone",
  subscription: "Subscription",
  region: "Region",
  subnet: "Subnet",
  "resource-group": "Resource Group",
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
  const nestedGroups = graph.nodes.some((node) => node.type === "group" && node.parentId);
  for (const [groupId, group] of groups) {
    const children = (graph.nodes ?? []).filter((node) => node.parentId === groupId);
    const fits = (x: number, y: number, width = 132, height = 116) =>
      x >= 0 &&
      y >= 0 &&
      x + width <= group.width + 24 &&
      y + height <= group.height + 24;
    if (!nestedGroups &&
      children.some(
        (child) =>
          !fits(child.position.x, child.position.y, child.width, child.height) &&
          fits(child.position.x - group.x, child.position.y - group.y, child.width, child.height)
      )
    ) {
      absoluteChildParents.add(groupId);
    }
  }
  const orderedNodes = parentFirst([...(graph.nodes ?? [])].sort(
    (a, b) => Number(b.type === "group") - Number(a.type === "group")
  ));
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
        semantics: legacyNodeSemantics(n.data),
        ...(n.parentId ? { parentId: n.parentId } : {}),
      });
    } else if (n.type === "service") {
      const iconId = (n.data?.iconId as string) ?? "";
      const label = (n.data?.label as string) ?? iconId;
      const parent = n.parentId ? groups.get(n.parentId) : undefined;
      const usesAbsoluteCoordinates =
        !!n.parentId && absoluteChildParents.has(n.parentId) && !!parent;
      const resolvedIcon = resolveConversionIcon({
        iconId,
        label,
        cloud: typeof n.data?.cloud === "string" ? n.data.cloud : undefined,
      }, icons);
      nodes.push({
        ...(resolvedIcon
          ? { kind: "icon" as const, iconId: resolvedIcon.id, iconPath: resolvedIcon.path }
          : { kind: "shape" as const, shape: "rectangle" as const }),
        id: n.id,
        x: usesAbsoluteCoordinates && parent ? n.position.x - parent.x : n.position.x,
        y: usesAbsoluteCoordinates && parent ? n.position.y - parent.y : n.position.y,
        label,
        semantics: legacyNodeSemantics(n.data),
        ...(n.width !== undefined ? { width: n.width } : {}),
        ...(n.height !== undefined ? { height: n.height } : {}),
        ...(typeof n.data.description === "string" ? { subtitle: n.data.description } : {}),
        ...(n.parentId ? { parentId: n.parentId } : {}),
      });
    } else {
      throw new Error(`Template node type "${n.type}" is not supported by Cloud Architecture. Use the legacy playground instead.`);
    }
  }

  const edges: ArchEdge[] = (graph.edges ?? []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    ...(e.sourceHandle !== undefined ? { sourceHandle: parseConnectionHandle(e.sourceHandle) } : {}),
    ...(e.targetHandle !== undefined ? { targetHandle: parseConnectionHandle(e.targetHandle) } : {}),
    label: e.data?.label ?? e.data?.protocol,
    style: e.data?.lineStyle === "dashed" ? "dashed" : e.data?.animated ? "flow" : "solid",
    step: e.data?.step,
    semantics: architectureEdgeSemanticsSchema.parse({
      ...architectureEdgeSemanticsSchema.parse(e.data?.semantics ?? {}),
      ...(e.data?.connectionType ? { connectionType: e.data.connectionType } : {}),
      ...(e.data?.protocol ? { protocol: e.data.protocol } : {}),
      ...(e.data?.description ? { description: e.data.description } : {}),
      ...(e.data?.lineStyle ? { lineStyle: e.data.lineStyle } : {}),
      ...(e.data?.arrowStyle ? { arrowStyle: e.data.arrowStyle } : {}),
    }),
  }));

  return parseArchitectureDocument({ nodes, edges, ...(graph.metadata ? { metadata: architectureMetadataSchema.parse(graph.metadata) } : {}) });
}

// ─── Export helpers ────────────────────────────────────────────────────────

async function exportCanvas(
  format: ExportFormat,
  handle: ArchitectureCanvasHandle | null,
  canvasTheme: CanvasTheme
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

  const { toSvg, toCanvas } = await import("html-to-image");
  const bounds = handle.getExportBounds();
  const layout = createExportLayout(bounds, format === "gif" ? 1280 : 2400, format === "gif" ? 900 : 1800);
  const commonOptions = {
    fontEmbedCSS: await getExportFontCss(viewport),
    filter: includeDiagramExportNode,
    cacheBust: true,
    backgroundColor: canvasTheme === "light" ? "#f8fafc" : "#05080d",
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
    const dataUrl = await toExportPng(viewport, {
      ...commonOptions,
      pixelRatio: 2,
    });
    triggerDataUrlDownload(dataUrl, `${filename}.png`);
  } else if (format === "svg") {
    const dataUrl = await toSvg(viewport, commonOptions);
    triggerDataUrlDownload(dataUrl, `${filename}.svg`);
  } else if (format === "pdf") {
    const dataUrl = await toExportPng(viewport, {
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
    try {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to create the GIF image renderer.");
    const data = ctx.getImageData(0, 0, outW, outH).data;
    if (!palette) palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    const overview = label === "start" || label === "end";
    gif.writeFrame(index, outW, outH, {
      palette: frameCount === 0 ? palette : undefined,
      delay: overview ? 1200 : 120,
    });
    frameCount += 1;
    } finally { releaseExportCanvas(canvas); }
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
  canvasTheme: CanvasTheme
) {
  if (!handle) throw new Error("Canvas is not ready.");
  const stamp = Date.now();
  // Native blob export (used by Whiteboard's Excalidraw exporter).
  if (handle.exportBlob) {
    const native = await handle.exportBlob(format);
    if (native) { triggerDownload(native, `${mode}-${stamp}.${format}`); return; }
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
    throw new Error("Unable to locate the diagram export surface.");
  }
  try {
    const { toSvg } = await import("html-to-image");
    const fontEmbedCSS = await getExportFontCss(target);
    if (format === "png") {
      const dataUrl = await toExportPng(target, { filter: includeDiagramExportNode, fontEmbedCSS, cacheBust: true, backgroundColor: canvasTheme === "light" ? "#f8fafc" : "#05080d", pixelRatio: 2 });
      const blob = await dataUrlToBlob(dataUrl);
      triggerDownload(blob, `${mode}-${stamp}.png`);
    } else if (format === "svg") {
      const dataUrl = await toSvg(target, { filter: includeDiagramExportNode, fontEmbedCSS, cacheBust: true, backgroundColor: canvasTheme === "light" ? "#f8fafc" : "#05080d" });
      const blob = await dataUrlToBlob(dataUrl);
      triggerDownload(blob, `${mode}-${stamp}.svg`);
    } else if (format === "pdf") {
      const dataUrl = await toExportPng(target, {
        fontEmbedCSS,
        filter: includeDiagramExportNode,
        cacheBust: true,
        backgroundColor: canvasTheme === "light" ? "#f8fafc" : "#05080d",
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
    throw new Error(`Unable to export ${mode}: ${err instanceof Error ? err.message : "rendering failed"}`);
  }
}
