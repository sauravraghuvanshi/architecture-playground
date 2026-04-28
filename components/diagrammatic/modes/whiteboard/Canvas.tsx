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
  useHandleLibrary,
} from "@excalidraw/excalidraw";
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
  updateLibrary: (opts: {
    libraryItems: unknown;
    merge?: boolean;
    prompt?: boolean;
    openLibraryMenu?: boolean;
  }) => Promise<unknown>;
  history: { clear: () => void };
}

/** Extension to the standard handle so the workspace can drop AI-generated
 *  images into the scene. Implemented by WhiteboardCanvas; consumers should
 *  feature-detect via `"insertImage" in handle`. */
export interface WhiteboardCanvasHandle extends BaseCanvasHandle {
  insertImage: (b64: string, mime: string, opts?: { width?: number; height?: number }) => void;
}

/**
 * Excalidraw consumes URL-hash deep links on mount. We allow `addLibrary`
 * (handled via useHandleLibrary so libraries directory imports work) but
 * scrub `json` / `room` / `token` which trigger the hosted excalidraw.com
 * scene-import / collab flows we don't surface in this embed and which have
 * crashed the renderer.
 */
const EXCALIDRAW_HASH_KEYS = ["json", "room"];
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

/**
 * localStorage-backed library persistence. Excalidraw's `useHandleLibrary`
 * calls `load()` once on mount to seed the library, then `save()` after
 * every `updateLibrary` (URL imports, in-app imports, drag-to-add, delete).
 *
 * Library items can include base64-encoded element previews so the payload
 * grows unbounded across many imports — we let the browser surface a
 * QuotaExceededError naturally rather than silently truncating, since
 * blowing the quota is rare with diagram-shape libraries.
 */
const LIBRARY_STORAGE_KEY = "diagrammatic.whiteboard.library";
const WHITEBOARD_LIBRARY_ADAPTER = {
  load: async () => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(LIBRARY_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { libraryItems?: unknown };
      if (!parsed?.libraryItems) return null;
      return { libraryItems: parsed.libraryItems as never };
    } catch {
      return null;
    }
  },
  save: async (data: { libraryItems: unknown }) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("[whiteboard] could not persist library:", e);
    }
  },
};

export const WhiteboardCanvas = forwardRef<BaseCanvasHandle, Props>(function WhiteboardCanvas({ value, onChange }, ref) {
  // Must run synchronously before the Excalidraw instance reads location.hash.
  if (typeof window !== "undefined") scrubExcalidrawHash();
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  // useHandleLibrary needs the API as React state (re-runs when it changes
  // from null → ready) so it can attach the `#addLibrary=` URL handler.
  const [excalidrawAPI, setExcalidrawAPI] = useState<unknown>(null);
  useHandleLibrary({
    excalidrawAPI: excalidrawAPI as never,
    // Accept any HTTPS .excalidrawlib URL — the directory at
    // libraries.excalidraw.com serves them from libraries.excalidraw.com
    // (not excalidraw.com), so the default validator rejects them.
    validateLibraryUrl: (url: string) => {
      try { return new URL(url).protocol === "https:"; } catch { return false; }
    },
    // Without an adapter, library items are kept only in Excalidraw's
    // in-memory jotai store: every reload (or remount on mode-switch)
    // starts empty, so a freshly imported library replaces whatever was
    // there before. Persist to localStorage so imports accumulate.
    adapter: WHITEBOARD_LIBRARY_ADAPTER,
  });
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

  /**
   * Prompt the user for a `.excalidrawlib` URL (e.g. from
   * libraries.excalidraw.com) and merge it into the local library. We have
   * to fetch + import client-side because the directory's "Add to Excalidraw"
   * button hard-codes a redirect to the public excalidraw.com app.
   */
  const importLibraryFromUrl = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    const url = window.prompt(
      "Paste a .excalidrawlib URL (e.g. from libraries.excalidraw.com):",
      "",
    );
    if (!url) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      await api.updateLibrary({
        libraryItems: data,
        merge: true,
        openLibraryMenu: true,
      });
    } catch (e) {
      window.alert(`Couldn't import library: ${(e as Error).message}`);
    }
  }, []);

  return (
    <div className="h-full w-full bg-zinc-950">
      <Excalidraw
        excalidrawAPI={(api) => {
          apiRef.current = api as unknown as ExcalidrawAPI;
          setExcalidrawAPI(api);
        }}
        initialData={initialData}
        onChange={onAnyChange}
        theme="dark"
        UIOptions={{ canvasActions: { saveToActiveFile: false, loadScene: false, export: false, saveAsImage: true, toggleTheme: false, changeViewBackgroundColor: true, clearCanvas: true } }}
      >
        {/*
          Custom MainMenu — by passing children we override the default menu
          contents and drop the `Socials` block (which renders an
          "Excalidraw links" group with GitHub / Twitter / Discord). Each
          item below is a re-export of an Excalidraw default; we just curate.
        */}
        <MainMenu>
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.Item
            icon={
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                <path d="M4 4h6l2 2h4v10H4z" />
              </svg>
            }
            onSelect={() => { void importLibraryFromUrl(); }}
          >
            Import library from URL…
          </MainMenu.Item>
          <MainMenu.ItemLink
            href="https://libraries.excalidraw.com/"
            icon={
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                <path d="M3 5h14v10H3z M3 9h14" />
              </svg>
            }
          >
            Browse public libraries
          </MainMenu.ItemLink>
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
          <MainMenu.DefaultItems.Help />
        </MainMenu>
      </Excalidraw>
    </div>
  );
});
