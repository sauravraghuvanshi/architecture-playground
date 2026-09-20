/**
 * Whiteboard mode — wraps Excalidraw.
 *
 * Hydration uses the JSON serialization Excalidraw natively understands
 * ({ elements, appState, files }). PNG export uses Excalidraw's own
 * ``exportToBlob`` helper.
 */
"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Excalidraw,
  MainMenu,
  exportToBlob,
  convertToExcalidrawElements,
  CaptureUpdateAction,
  newElementWith,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { z } from "zod";
import type { BaseCanvasHandle } from "../../shared/modeRegistry";
import type { CanvasTheme } from "../../shared/types";
import { exportWhiteboardFlowGif } from "./export-gif";
import {
  colorWhiteboardSymbol,
  decodeWhiteboardImage,
  fitWhiteboardImage,
  isNeutralWhiteboardSymbol,
  isWhiteboardInteractionActive,
  reconcileWhiteboardForeground,
  whiteboardAppearance,
  whiteboardExportState,
  whiteboardForeground,
  whiteboardSurfaceColor,
  type ForegroundElement,
} from "@/lib/whiteboard-appearance";
import type { ImageCanvasContext } from "@/lib/image-styles";

export interface WhiteboardPayload {
  elements: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}

export const WHITEBOARD_DEFAULT_PAYLOAD: WhiteboardPayload = {
  elements: [],
  appState: { viewBackgroundColor: "#f8fafc", currentItemStrokeColor: "#0f172a" },
  files: {},
};

const binaryFileSchema = z.object({
  id: z.string().min(1),
  mimeType: z.enum([
    "image/png", "image/jpeg", "image/svg+xml", "image/gif", "image/webp",
    "image/bmp", "image/x-icon", "image/avif", "image/jfif", "application/octet-stream",
  ]),
  dataURL: z.string().min(1),
  created: z.number().finite().nonnegative(),
  lastRetrieved: z.number().finite().nonnegative().optional(),
  version: z.number().finite().nonnegative().optional(),
}).refine((file) => {
  const prefix = `data:${file.mimeType};base64,`;
  if (!file.dataURL.startsWith(prefix)) return false;
  const encoded = file.dataURL.slice(prefix.length);
  return encoded.length > 0 && encoded.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(encoded);
});

const snapshotSchema = z.object({
  elements: z.array(z.unknown()).default([]),
  appState: z.record(z.string(), z.unknown()).optional(),
  files: z.record(z.string(), binaryFileSchema).optional(),
}).refine((data) => Object.entries(data.files ?? {}).every(([id, file]) => id === file.id));

interface Props {
  value: WhiteboardPayload;
  onChange?: (next: WhiteboardPayload) => void;
  canvasTheme?: CanvasTheme;
}

interface ExcalidrawAPI {
  getSceneElements: () => readonly unknown[];
  getAppState: () => Record<string, unknown>;
  getFiles: () => Record<string, unknown>;
  updateScene: (s: {
    elements?: unknown[];
    appState?: Record<string, unknown>;
    captureUpdate?: (typeof CaptureUpdateAction)[keyof typeof CaptureUpdateAction];
  }) => void;
  scrollToContent: (els?: readonly unknown[], opts?: { fitToContent?: boolean }) => void;
  addFiles: (files: Array<{ id: string; mimeType: string; dataURL: string; created: number }>) => void;
  setActiveTool: (tool: { type: "arrow" }) => void;
  history: { clear: () => void };
}

/** Extension to the standard handle so the workspace can drop AI-generated
 *  images into the scene. Implemented by WhiteboardCanvas; consumers should
 *  feature-detect via `"insertImage" in handle`. */
export interface WhiteboardCanvasHandle extends BaseCanvasHandle {
  insertImage: (b64: string, mime: string, opts?: { width?: number; height?: number; canvas?: ImageCanvasContext }) => Promise<void>;
  getImageCanvasContext: () => ImageCanvasContext;
  insertSvgAsset: (svg: string, label: string) => void;
  activateFlowArrow: () => void;
}

function utf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

/**
 * The embedded drawing engine understands upstream scene, collaboration, and
 * library deep links. Diagrammatic owns Whiteboard persistence and assets, so
 * remove those hashes before the engine can consume them.
 */
const EXTERNAL_WHITEBOARD_HASH_KEYS = ["addLibrary", "json", "room", "token"];
function scrubExternalWhiteboardHash() {
  if (typeof window === "undefined") return;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return;
  const params = new URLSearchParams(hash);
  let dirty = false;
  for (const k of EXTERNAL_WHITEBOARD_HASH_KEYS) {
    if (params.has(k)) { params.delete(k); dirty = true; }
  }
  if (!dirty) return;
  const remaining = params.toString();
  const next = `${window.location.pathname}${window.location.search}${remaining ? `#${remaining}` : ""}`;
  window.history.replaceState(null, "", next);
}

function isExternalWhiteboardFileDrop(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.files).some((file) =>
    /\.(?:excalidraw|excalidrawlib)$/i.test(file.name)
  );
}

/**
 * Sanitize a persisted Excalidraw appState before re-feeding it to the
 * component. Several `appState` fields (notably `collaborators`) are runtime
 * Map / Set instances that JSON.stringify silently flattens to {} — and
 * Excalidraw 0.18 calls `.forEach` on them unconditionally, so the empty
 * object explodes the renderer with
 *
 *   TypeError: e.appState.collaborators.forEach is not a function
 *
 * which then thrashes React's reconciler and Edge kills the tab
 * ("This page couldn't load"). We coerce known map-shaped fields back to
 * Maps (empty is fine; Excalidraw repopulates from peers) and drop
 * anything else that's clearly broken.
 */
function sanitizeAppState(raw: Record<string, unknown> | undefined | null): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, unknown> = { ...raw };
  for (const key of VOLATILE_APP_STATE_KEYS) delete out[key];
  // collaborators is a Map<SocketId, Collaborator> at runtime.
  const c = out.collaborators;
  if (!(c instanceof Map)) {
    out.collaborators = new Map();
  }
  return out;
}

const VOLATILE_APP_STATE_KEYS = [
  "activeTool",
  "contextMenu",
  "cursorButton",
  "cursorX",
  "cursorY",
  "draggingElement",
  "editingElement",
  "editingTextElement",
  "editingGroupId",
  "editingLinearElement",
  "elementLocked",
  "lastPointerDownWith",
  "newElement",
  "multiElement",
  "openDialog",
  "openMenu",
  "openPopup",
  "openSidebar",
  "resizingElement",
  "isResizing",
  "isRotating",
  "selectedElementsAreBeingDragged",
  "selectedElementIds",
  "selectedGroupIds",
  "selectedLinearElement",
  "selectionElement",
  "showHyperlinkPopup",
] as const;

function appStateForPersistence(raw: object): Record<string, unknown> {
  const out = { ...raw } as Record<string, unknown>;
  for (const key of VOLATILE_APP_STATE_KEYS) delete out[key];
  delete out.collaborators;
  return out;
}

export const WhiteboardCanvas = forwardRef<BaseCanvasHandle, Props>(function WhiteboardCanvas({
  value,
  onChange,
  canvasTheme = "dark",
}, ref) {
  // Must run synchronously before the drawing engine reads location.hash.
  if (typeof window !== "undefined") scrubExternalWhiteboardHash();
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const initialAppearance = whiteboardAppearance(canvasTheme, value.appState);
  const foregroundRef = useRef(initialAppearance.foregroundColor);
  const knownElementsRef = useRef(new Set((value.elements as ForegroundElement[] ?? []).map((element) => element.id)));
  const canvasThemeRef = useRef(canvasTheme);
  const [initialData] = useState(() => ({
    elements: (value.elements ?? []) as never[],
    appState: {
      ...sanitizeAppState(value.appState),
      viewBackgroundColor: initialAppearance.backgroundColor,
      currentItemStrokeColor: value.appState?.currentItemStrokeColor &&
        !["#0f172a", "#f8fafc"].includes(String(value.appState.currentItemStrokeColor).toLowerCase())
        ? value.appState.currentItemStrokeColor : initialAppearance.foregroundColor,
      theme: "light",
      exportWithDarkMode: false,
    } as never,
    files: (value.files ?? {}) as never,
    scrollToContent: true,
  }));
  const notifyRef = useRef<number | null>(null);
  const lastPersistedSnapshot = useRef("");
  const registerExcalidrawApi = useCallback((api: unknown) => {
    const registeredApi = api as ExcalidrawAPI;
    apiRef.current = registeredApi;
    requestAnimationFrame(() => {
      if (apiRef.current !== registeredApi) return;
      registeredApi.updateScene({
        captureUpdate: CaptureUpdateAction.NEVER,
        appState: {
          theme: "light",
          exportWithDarkMode: false,
          openSidebar: null,
        },
      });
    });
  }, []);

  useEffect(() => {
    const api = apiRef.current;
    if (!api || canvasThemeRef.current === canvasTheme) return;
    canvasThemeRef.current = canvasTheme;
    const state = api.getAppState();
    const appearance = whiteboardAppearance(canvasTheme, state);
    api.updateScene({
      captureUpdate: CaptureUpdateAction.NEVER,
      appState: {
        viewBackgroundColor: appearance.backgroundColor,
        currentItemStrokeColor: state.currentItemStrokeColor === foregroundRef.current
          ? appearance.foregroundColor : state.currentItemStrokeColor,
        theme: "light",
        exportWithDarkMode: false,
        openSidebar: null,
      },
    });
  }, [canvasTheme]);

  const onAnyChange = useCallback((
    elements?: readonly unknown[],
    appState?: object,
    files?: Record<string, unknown>
  ) => {
    if (!apiRef.current) return;
    const api = apiRef.current;
    const nextElements = [...(elements ?? api.getSceneElements())];
    const liveAppState = (appState ?? api.getAppState()) as Record<string, unknown>;
    const nextAppState = appStateForPersistence(liveAppState);
    const nextFiles = files ?? api.getFiles();
    const interacting = isWhiteboardInteractionActive(liveAppState);
    const foreground = whiteboardForeground(whiteboardSurfaceColor(String(nextAppState.viewBackgroundColor ?? initialAppearance.backgroundColor), canvasTheme));
    let changed = false;
    const additions: Parameters<ExcalidrawAPI["addFiles"]>[0] = [];
    const themedElements = (nextElements as ForegroundElement[]).map((element) => {
      if (interacting) return element;
      let next = reconcileWhiteboardForeground(element, foreground, foregroundRef.current, !knownElementsRef.current.has(element.id));
      const symbol = element.customData?.diagrammaticSymbol as { svg?: string; fileId?: string } | undefined;
      if (element.type === "image" && symbol?.svg && symbol.fileId && isNeutralWhiteboardSymbol(symbol.svg)) {
        const fileId = `${symbol.fileId}-${foreground.slice(1)}`;
        if (element.fileId !== fileId) {
          if (!nextFiles[fileId]) additions.push({
            id: fileId, mimeType: "image/svg+xml",
            dataURL: `data:image/svg+xml;base64,${utf8ToBase64(colorWhiteboardSymbol(symbol.svg, foreground))}`,
            created: Date.now(),
          });
          next = { ...next, fileId };
        }
      }
      if (next === element) return element;
      changed = true;
      return newElementWith(element as never, next as never);
    });
    const automaticStroke = nextAppState.currentItemStrokeColor === foregroundRef.current;
    const updateStroke = !interacting && automaticStroke && foreground !== foregroundRef.current;
    if (!interacting) {
      foregroundRef.current = foreground;
      knownElementsRef.current = new Set((nextElements as ForegroundElement[]).map((element) => element.id));
    }
    if (changed || updateStroke) {
      if (additions.length) api.addFiles(additions);
      api.updateScene({
        ...(changed ? { elements: themedElements } : {}),
        ...(updateStroke ? { appState: { currentItemStrokeColor: foreground } } : {}),
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      return;
    }
    if (!onChange) return;
    const signature = JSON.stringify({
      elements: nextElements,
      appState: nextAppState,
      fileIds: Object.keys(nextFiles).sort(),
    });
    if (signature === lastPersistedSnapshot.current) return;
    lastPersistedSnapshot.current = signature;
    if (notifyRef.current) cancelAnimationFrame(notifyRef.current);
    notifyRef.current = requestAnimationFrame(() => {
      onChange({
        elements: nextElements,
        appState: nextAppState,
        files: nextFiles,
      });
    });
  }, [onChange, initialAppearance.backgroundColor, canvasTheme]);

  const insertImageData = useCallback(
    (
      b64: string,
      mime: string,
      opts?: {
        width?: number;
        height?: number;
        idPrefix?: string;
        clientX?: number;
        clientY?: number;
        symbolSvg?: string;
        canvas?: ImageCanvasContext;
      }
    ) => {
      const api = apiRef.current;
      if (!api) return;
      const fileId = `${opts?.idPrefix ?? "image"}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      api.addFiles([
        {
          id: fileId,
          mimeType: mime,
          dataURL: `data:${mime};base64,${b64}`,
          created: Date.now(),
        },
      ]);
      const appState = api.getAppState() as {
        scrollX?: number;
        scrollY?: number;
        zoom?: { value?: number };
        width?: number;
        height?: number;
      };
      const zoom = appState.zoom?.value ?? 1;
      const viewportWidth = (appState.width ?? 1024) / zoom;
      const viewportHeight = (appState.height ?? 768) / zoom;
      const wrapperRect = wrapperRef.current?.getBoundingClientRect();
      const centerX =
        opts?.clientX !== undefined && wrapperRect
          ? -(appState.scrollX ?? 0) + (opts.clientX - wrapperRect.left) / zoom
          : -(appState.scrollX ?? 0) + viewportWidth / 2;
      const centerY =
        opts?.clientY !== undefined && wrapperRect
          ? -(appState.scrollY ?? 0) + (opts.clientY - wrapperRect.top) / zoom
          : -(appState.scrollY ?? 0) + viewportHeight / 2;
      const width = opts?.width ?? 480;
      const height = opts?.height ?? 480;
      const elements = convertToExcalidrawElements([
        {
          type: "image",
          x: centerX - width / 2,
          y: centerY - height / 2,
          width,
          height,
          fileId: fileId as never,
          status: "saved",
          ...(opts?.symbolSvg ? { customData: { diagrammaticSymbol: { svg: opts.symbolSvg, fileId } } } : {}),
          ...(opts?.canvas ? { customData: { diagrammaticImageCanvas: opts.canvas } } : {}),
        },
      ] as never);
      api.updateScene({
        elements: [...api.getSceneElements(), ...elements],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    },
    []
  );

  const handleAssetDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (isExternalWhiteboardFileDrop(event.dataTransfer)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "none";
      return;
    }
    if (
      Array.from(event.dataTransfer.types).includes(
        "application/x-diagrammatic-whiteboard-asset"
      )
    ) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleAssetDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (isExternalWhiteboardFileDrop(event.dataTransfer)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const raw = event.dataTransfer.getData(
        "application/x-diagrammatic-whiteboard-asset"
      );
      if (!raw) return;
      event.preventDefault();
      event.stopPropagation();
      try {
        const asset = JSON.parse(raw) as { svg?: string; label?: string };
        if (!asset.svg || !asset.label) return;
        const owned = isNeutralWhiteboardSymbol(asset.svg);
        insertImageData(utf8ToBase64(colorWhiteboardSymbol(asset.svg, foregroundRef.current)), "image/svg+xml", {
          width: 180,
          height: 180,
          idPrefix: `symbol-${asset.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          clientX: event.clientX,
          clientY: event.clientY,
          ...(owned ? { symbolSvg: asset.svg } : {}),
        });
      } catch {
        // Ignore malformed external drag payloads.
      }
    },
    [insertImageData]
  );

  useEffect(() => () => { if (notifyRef.current) cancelAnimationFrame(notifyRef.current); }, []);

  useImperativeHandle(ref, () => ({
    serialize: () => {
      if (!apiRef.current) return value;
      return {
        elements: [...apiRef.current.getSceneElements()],
        appState: appStateForPersistence(apiRef.current.getAppState()),
        files: apiRef.current.getFiles(),
      };
    },
    hydrate: (p) => {
      const api = apiRef.current;
      if (!api) throw new Error("Whiteboard is not ready to restore a snapshot.");
      const parsed = snapshotSchema.safeParse(p);
      if (!parsed.success) throw new Error("Whiteboard snapshot contains invalid elements, state, or image files.");
      const data = parsed.data;
      const files = Object.values(data.files ?? {});
      if (files.length) api.addFiles(files);
      knownElementsRef.current = new Set((data.elements as ForegroundElement[]).map((element) => element.id));
      const appearance = whiteboardAppearance(canvasTheme, data.appState);
      foregroundRef.current = appearance.foregroundColor;
      api.updateScene({
        elements: data.elements,
        appState: {
          ...sanitizeAppState(data.appState),
          viewBackgroundColor: appearance.backgroundColor,
          theme: "light",
          exportWithDarkMode: false,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      api.history.clear();
    },
    fit: () => apiRef.current?.scrollToContent(undefined, { fitToContent: true }),
    undo: () => { wrapperRef.current?.querySelector<HTMLButtonElement>(".excalidraw [aria-label='Undo']")?.click(); },
    redo: () => { wrapperRef.current?.querySelector<HTMLButtonElement>(".excalidraw [aria-label='Redo']")?.click(); },
    deleteSelection: () => { wrapperRef.current?.querySelector<HTMLButtonElement>(".excalidraw [aria-label='Delete']")?.click(); },
    exportBlob: async (format) => {
      if (format !== "png" && format !== "gif") return null;
      const api = apiRef.current;
      if (!api) throw new Error("Whiteboard is not ready to export. Wait for the canvas to load and retry.");
      if (format === "gif") {
        return exportWhiteboardFlowGif({
          elements: api.getSceneElements(),
          appState: whiteboardExportState(api.getAppState()),
          files: api.getFiles(),
          backgroundColor: String(api.getAppState().viewBackgroundColor ?? initialAppearance.backgroundColor),
        });
      }
      return exportToBlob({
        elements: api.getSceneElements() as never[],
        appState: whiteboardExportState(api.getAppState()) as never,
        files: api.getFiles() as never,
        mimeType: "image/png",
      });
    },
    /**
     * Insert a base64-encoded image as a new Excalidraw image element at the
     * current viewport center. Registers the binary via `addFiles` and adds
     * an image element via `convertToExcalidrawElements` so it's a real
     * Excalidraw element (selectable, exportable, undoable).
     */
    getImageCanvasContext: () => {
      const api = apiRef.current;
      if (!api) throw new Error("Whiteboard is not ready to generate an image.");
      const backgroundColor = whiteboardSurfaceColor(String(api.getAppState().viewBackgroundColor ?? initialAppearance.backgroundColor), canvasTheme);
      return { theme: canvasTheme, backgroundColor, foregroundColor: whiteboardForeground(backgroundColor) };
    },
    insertImage: async (
      b64: string,
      mime: string,
      opts?: { width?: number; height?: number; canvas?: ImageCanvasContext }
    ) => {
      const api = apiRef.current;
      if (!api) throw new Error("Whiteboard is not ready to insert an image.");
      const decoded = await decodeWhiteboardImage(`data:${mime};base64,${b64}`);
      if (apiRef.current !== api) throw new Error("The Whiteboard changed while decoding the image. Please retry.");
      const dimensions = fitWhiteboardImage(decoded.width, decoded.height, opts?.width ?? 480, opts?.height ?? 480);
      insertImageData(b64, mime, { ...opts, ...dimensions, idPrefix: "ai-img" });
    },
    insertSvgAsset: (svg: string, label: string) =>
      insertImageData(utf8ToBase64(colorWhiteboardSymbol(svg, foregroundRef.current)), "image/svg+xml", {
        width: 180,
        height: 180,
        idPrefix: `symbol-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        ...(isNeutralWhiteboardSymbol(svg) ? { symbolSvg: svg } : {}),
      }),
    activateFlowArrow: () => apiRef.current?.setActiveTool({ type: "arrow" }),
  }), [canvasTheme, initialAppearance.backgroundColor, insertImageData, value]);

  const blockExternalWhiteboardShortcuts = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, [contenteditable='true']")) return;
      const opensExternalData = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o";
      const opensLibrary = !event.ctrlKey && !event.metaKey && !event.altKey && event.key === "0";
      const opensHelp = event.key === "?";
      if (opensExternalData || opensLibrary || opensHelp) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    []
  );

  return (
    <div
      ref={wrapperRef}
      className={`diagrammatic-whiteboard h-full w-full ${
        canvasTheme === "light" ? "bg-slate-50" : "bg-[#05080d]"
      }`}
      onDragOverCapture={handleAssetDragOver}
      onDropCapture={handleAssetDrop}
      onKeyDownCapture={blockExternalWhiteboardShortcuts}
    >
      <Excalidraw
        excalidrawAPI={registerExcalidrawApi}
        initialData={initialData}
        onChange={onAnyChange}
        theme="light"
        UIOptions={{ canvasActions: { saveToActiveFile: false, loadScene: false, export: false, saveAsImage: true, toggleTheme: false, changeViewBackgroundColor: true, clearCanvas: true } }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.ClearCanvas />
        </MainMenu>
      </Excalidraw>
    </div>
  );
});
