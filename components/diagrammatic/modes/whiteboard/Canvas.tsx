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
import { Excalidraw, exportToBlob, convertToExcalidrawElements } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { BaseCanvasHandle } from "../../shared/modeRegistry";

export interface WhiteboardPayload {
  elements: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}

export const WHITEBOARD_DEFAULT_PAYLOAD: WhiteboardPayload = {
  elements: [],
  appState: { viewBackgroundColor: "#0a0a0b", currentItemStrokeColor: "#bef264" },
  files: {},
};

interface Props {
  value: WhiteboardPayload;
  onChange?: (next: WhiteboardPayload) => void;
}

interface ExcalidrawAPI {
  getSceneElements: () => readonly unknown[];
  getAppState: () => Record<string, unknown>;
  getFiles: () => Record<string, unknown>;
  updateScene: (s: { elements?: unknown[]; appState?: Record<string, unknown> }) => void;
  scrollToContent: (els?: readonly unknown[], opts?: { fitToContent?: boolean }) => void;
  addFiles: (files: Array<{ id: string; mimeType: string; dataURL: string; created: number }>) => void;
  history: { clear: () => void };
}

/** Extension to the standard handle so the workspace can drop AI-generated
 *  images into the scene. Implemented by WhiteboardCanvas; consumers should
 *  feature-detect via `"insertImage" in handle`. */
export interface WhiteboardCanvasHandle extends BaseCanvasHandle {
  insertImage: (b64: string, mime: string, opts?: { width?: number; height?: number }) => void;
}

/**
 * Excalidraw consumes URL-hash deep links on mount (`#addLibrary=...`,
 * `#json=...`, `#room=...`). Those handlers fetch remote payloads + show
 * confirm dialogs designed for the hosted excalidraw.com experience; in our
 * embed they have crashed the renderer ("This page couldn't load" tab error)
 * and the hash persists across reloads so the user gets stuck.
 *
 * We don't surface any of those features anyway (loadScene / saveToActiveFile
 * are disabled in UIOptions), so it's safe to scrub these hashes before the
 * first render.
 */
const EXCALIDRAW_HASH_KEYS = ["addLibrary", "json", "room"];
function scrubExcalidrawHash() {
  if (typeof window === "undefined") return;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return;
  const params = new URLSearchParams(hash);
  let dirty = false;
  for (const k of EXCALIDRAW_HASH_KEYS) {
    if (params.has(k)) { params.delete(k); dirty = true; }
  }
  if (params.has("token")) { params.delete("token"); dirty = true; }
  if (dirty) {
    const remaining = params.toString();
    const next = `${window.location.pathname}${window.location.search}${remaining ? `#${remaining}` : ""}`;
    window.history.replaceState(null, "", next);
  }
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
  // collaborators is a Map<SocketId, Collaborator> at runtime.
  const c = out.collaborators;
  if (!(c instanceof Map)) {
    out.collaborators = new Map();
  }
  return out;
}

export const WhiteboardCanvas = forwardRef<BaseCanvasHandle, Props>(function WhiteboardCanvas({ value, onChange }, ref) {
  // Must run synchronously before the Excalidraw instance reads location.hash.
  if (typeof window !== "undefined") scrubExcalidrawHash();
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const [initialData] = useState(() => ({
    elements: (value.elements ?? []) as never[],
    appState: sanitizeAppState(value.appState) as never,
    files: (value.files ?? {}) as never,
    scrollToContent: true,
  }));
  const notifyRef = useRef<number | null>(null);

  const onAnyChange = useCallback(() => {
    if (!onChange || !apiRef.current) return;
    if (notifyRef.current) cancelAnimationFrame(notifyRef.current);
    notifyRef.current = requestAnimationFrame(() => {
      const api = apiRef.current!;
      onChange({
        elements: [...api.getSceneElements()],
        appState: api.getAppState(),
        files: api.getFiles(),
      });
    });
  }, [onChange]);

  useEffect(() => () => { if (notifyRef.current) cancelAnimationFrame(notifyRef.current); }, []);

  useImperativeHandle(ref, () => ({
    serialize: () => {
      if (!apiRef.current) return value;
      return {
        elements: [...apiRef.current.getSceneElements()],
        appState: apiRef.current.getAppState(),
        files: apiRef.current.getFiles(),
      };
    },
    hydrate: (p) => {
      const api = apiRef.current;
      if (!api) return;
      const data = p as WhiteboardPayload;
      api.updateScene({
        elements: (data.elements ?? []) as unknown[],
        appState: sanitizeAppState(data.appState as Record<string, unknown> | undefined),
      });
      api.history.clear();
    },
    fit: () => apiRef.current?.scrollToContent(undefined, { fitToContent: true }),
    undo: () => { document.querySelector<HTMLButtonElement>("[aria-label='Undo']")?.click(); },
    redo: () => { document.querySelector<HTMLButtonElement>("[aria-label='Redo']")?.click(); },
    deleteSelection: () => { document.querySelector<HTMLButtonElement>("[aria-label='Delete']")?.click(); },
    exportBlob: async (format) => {
      const api = apiRef.current;
      if (!api) return null;
      if (format !== "png") return null;
      try {
        const blob = await exportToBlob({
          elements: api.getSceneElements() as never[],
          appState: { ...api.getAppState(), exportBackground: true } as never,
          files: api.getFiles() as never,
          mimeType: "image/png",
        });
        return blob;
      } catch {
        return null;
      }
    },
    /**
     * Insert a base64-encoded image as a new Excalidraw image element at the
     * current viewport center. Registers the binary via `addFiles` and adds
     * an image element via `convertToExcalidrawElements` so it's a real
     * Excalidraw element (selectable, exportable, undoable).
     */
    insertImage: (b64: string, mime: string, opts?: { width?: number; height?: number }) => {
      const api = apiRef.current;
      if (!api) return;
      const fileId = `ai-img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      api.addFiles([{
        id: fileId,
        mimeType: mime,
        dataURL: `data:${mime};base64,${b64}`,
        created: Date.now(),
      }]);
      // Place near the current scroll position so the user actually sees it.
      const appState = api.getAppState() as { scrollX?: number; scrollY?: number; zoom?: { value?: number }; width?: number; height?: number };
      const zoom = appState.zoom?.value ?? 1;
      const vw = (appState.width ?? 1024) / zoom;
      const vh = (appState.height ?? 768) / zoom;
      const scrollX = appState.scrollX ?? 0;
      const scrollY = appState.scrollY ?? 0;
      const w = opts?.width ?? 480;
      const h = opts?.height ?? 480;
      // scrollX/scrollY are negative offsets of scene origin from viewport top-left.
      const cx = -scrollX + vw / 2;
      const cy = -scrollY + vh / 2;
      const skeleton = [{
        type: "image" as const,
        x: cx - w / 2,
        y: cy - h / 2,
        width: w,
        height: h,
        fileId: fileId as never,
        status: "saved" as const,
      }];
      const elements = convertToExcalidrawElements(skeleton as never);
      const next = [...api.getSceneElements(), ...elements];
      api.updateScene({ elements: next });
    },
  }), [value]);

  return (
    <div className="h-full w-full bg-zinc-950">
      <Excalidraw
        excalidrawAPI={(api) => { apiRef.current = api as unknown as ExcalidrawAPI; }}
        initialData={initialData}
        onChange={onAnyChange}
        theme="dark"
        UIOptions={{ canvasActions: { saveToActiveFile: false, loadScene: false, export: false, saveAsImage: true, toggleTheme: false, changeViewBackgroundColor: true, clearCanvas: true } }}
      />
    </div>
  );
});
