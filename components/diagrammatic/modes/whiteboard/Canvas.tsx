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
import { parseWhiteboardDocument } from "@/lib/diagram-payload";
import { CanvasEditPendingError } from "@/lib/canvas-edit-state";
import { getWhiteboardSceneTransientElementIds, parseWhiteboardScene } from "@/lib/whiteboard-scene";
import { mayContainDiagramDrag, readDiagramDrag } from "@/lib/diagram-drag";
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

interface Props {
  value: WhiteboardPayload;
  onChange?: (next: WhiteboardPayload) => void;
  onReadyChange?: (ready: boolean) => void;
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
  insertImage: (b64: string, mime: string, opts?: { width?: number; height?: number; canvas?: ImageCanvasContext; signal?: AbortSignal }) => Promise<void>;
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
  "errorMessage",
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
  "isLoading",
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
  delete out.followedBy;
  return out;
}

export const WhiteboardCanvas = forwardRef<BaseCanvasHandle, Props>(function WhiteboardCanvas({
  value,
  onChange,
  onReadyChange,
  canvasTheme = "dark",
}, ref) {
  // Must run synchronously before the drawing engine reads location.hash.
  if (typeof window !== "undefined") scrubExternalWhiteboardHash();
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const sceneEpoch = useRef(0);
  const pointerActive = useRef(false);
  const pointerSettleFrame = useRef<number | null>(null);
  const readyRef = useRef(false);
  const publishReady = useCallback((ready: boolean) => {
    if (readyRef.current === ready) return;
    readyRef.current = ready;
    onReadyChange?.(ready);
  }, [onReadyChange]);
  const initialAppearance = whiteboardAppearance(canvasTheme, value.appState);
  const foregroundRef = useRef(initialAppearance.foregroundColor);
  const knownElementsRef = useRef(new Set((value.elements as ForegroundElement[] ?? []).map((element) => element.id)));
  const canvasThemeRef = useRef(canvasTheme);
  const [initialData] = useState(() => {
    const checked = parseWhiteboardDocument(value);
    return {
      elements: checked.elements as never[],
      appState: {
        ...sanitizeAppState(checked.appState),
        viewBackgroundColor: initialAppearance.backgroundColor,
        currentItemStrokeColor: checked.appState?.currentItemStrokeColor &&
          !["#0f172a", "#f8fafc"].includes(String(checked.appState.currentItemStrokeColor).toLowerCase())
          ? checked.appState.currentItemStrokeColor : initialAppearance.foregroundColor,
        theme: "light",
        exportWithDarkMode: false,
      } as never,
      files: (checked.files ?? {}) as never,
      scrollToContent: true,
    };
  });
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
      publishReady(registeredApi.getAppState().isLoading !== true);
    });
  }, [publishReady]);

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
    if (liveAppState.isLoading === true || api.getAppState().isLoading === true) {
      publishReady(false);
      return;
    }
    publishReady(true);
    const nextAppState = appStateForPersistence(liveAppState);
    const nextFiles = files ?? api.getFiles();
    const interacting = pointerActive.current || isWhiteboardInteractionActive(liveAppState);
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
    if (!onChange || interacting) return;
    if (getWhiteboardSceneTransientElementIds(parseWhiteboardScene({
      elements: nextElements, appState: nextAppState, files: nextFiles,
    })).length) return;
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
  }, [onChange, initialAppearance.backgroundColor, canvasTheme, publishReady]);

  const startPointer = useCallback(() => {
    if (pointerSettleFrame.current) cancelAnimationFrame(pointerSettleFrame.current);
    pointerSettleFrame.current = null;
    pointerActive.current = true;
    if (notifyRef.current) {
      cancelAnimationFrame(notifyRef.current);
      notifyRef.current = null;
      lastPersistedSnapshot.current = "";
    }
  }, []);

  const settlePointer = useCallback(() => {
    const api = apiRef.current;
    const epoch = sceneEpoch.current;
    if (pointerSettleFrame.current) cancelAnimationFrame(pointerSettleFrame.current);
    // Native pointer-up can finish a queued geometry update on the next paint.
    // Never replace its live elements with an earlier onChange snapshot.
    pointerSettleFrame.current = requestAnimationFrame(() => {
      pointerSettleFrame.current = requestAnimationFrame(() => {
        pointerSettleFrame.current = null;
        if (sceneEpoch.current !== epoch) return;
        pointerActive.current = false;
        if (!api || apiRef.current !== api) return;
        onAnyChange(api.getSceneElements(), api.getAppState(), api.getFiles());
      });
    });
  }, [onAnyChange]);

  useEffect(() => {
    const end = () => { if (pointerActive.current) settlePointer(); };
    window.addEventListener("pointerup", end, true);
    window.addEventListener("pointercancel", end, true);
    return () => {
      window.removeEventListener("pointerup", end, true);
      window.removeEventListener("pointercancel", end, true);
    };
  }, [settlePointer]);

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
      const file = {
        id: fileId,
        mimeType: mime,
        dataURL: `data:${mime};base64,${b64}`,
        created: Date.now(),
      };
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
      const checked = parseWhiteboardDocument({ elements, files: { [fileId]: file } });
      api.addFiles(Object.values(checked.files ?? {}));
      api.updateScene({
        elements: [...api.getSceneElements(), ...checked.elements],
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
    if (mayContainDiagramDrag(event.dataTransfer, "whiteboard")) {
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
      try {
        const raw = readDiagramDrag(event.dataTransfer, "whiteboard");
        if (!raw) return;
        event.preventDefault();
        event.stopPropagation();
        const asset: unknown = JSON.parse(raw);
        if (!asset || typeof asset !== "object" || !("svg" in asset) || typeof asset.svg !== "string" || !asset.svg ||
          !("label" in asset) || typeof asset.label !== "string" || !asset.label.trim() || asset.label.length > 200) {
          throw new Error("Invalid dragged symbol.");
        }
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
        event.preventDefault();
        event.stopPropagation();
        const message = "The dragged symbol is invalid. Choose a palette item and retry.";
        if (apiRef.current) apiRef.current.updateScene({ appState: { errorMessage: message }, captureUpdate: CaptureUpdateAction.NEVER });
        else console.error(message);
      }
    },
    [insertImageData]
  );

  useEffect(() => () => {
    sceneEpoch.current += 1;
    if (pointerSettleFrame.current) cancelAnimationFrame(pointerSettleFrame.current);
    if (notifyRef.current) cancelAnimationFrame(notifyRef.current);
    onReadyChange?.(false);
  }, [onReadyChange]);

  useImperativeHandle(ref, () => ({
    serialize: () => {
      if (pointerActive.current) throw new CanvasEditPendingError();
      if (!apiRef.current) return parseWhiteboardDocument(value);
      const state = apiRef.current.getAppState();
      if (state.isLoading === true) throw new CanvasEditPendingError();
      const scene = parseWhiteboardScene({
        elements: [...apiRef.current.getSceneElements()],
        appState: appStateForPersistence(state),
        files: apiRef.current.getFiles(),
      });
      if (getWhiteboardSceneTransientElementIds(scene).length) throw new CanvasEditPendingError();
      return scene;
    },
    hydrate: (p) => {
      const api = apiRef.current;
      if (!api) throw new Error("Whiteboard is not ready to restore a snapshot.");
      const data = parseWhiteboardDocument(p);
      sceneEpoch.current += 1;
      pointerActive.current = false;
      if (pointerSettleFrame.current) cancelAnimationFrame(pointerSettleFrame.current);
      pointerSettleFrame.current = null;
      if (notifyRef.current) {
        cancelAnimationFrame(notifyRef.current);
        notifyRef.current = null;
      }
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
      opts?: { width?: number; height?: number; canvas?: ImageCanvasContext; signal?: AbortSignal }
    ) => {
      const api = apiRef.current;
      if (!api) throw new Error("Whiteboard is not ready to insert an image.");
      opts?.signal?.throwIfAborted();
      const epoch = sceneEpoch.current;
      const decoded = await decodeWhiteboardImage(`data:${mime};base64,${b64}`);
      opts?.signal?.throwIfAborted();
      if (apiRef.current !== api || sceneEpoch.current !== epoch) throw new Error("The Whiteboard changed while decoding the image. Please retry.");
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
      onPointerCancelCapture={settlePointer}
    >
      <Excalidraw
        excalidrawAPI={registerExcalidrawApi}
        initialData={initialData}
        onChange={onAnyChange}
        onPointerDown={startPointer}
        onPointerUp={settlePointer}
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
