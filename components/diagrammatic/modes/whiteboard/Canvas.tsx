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
  appState: { viewBackgroundColor: "#f8fafc", currentItemStrokeColor: "#0f172a" },
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
  insertSvgAsset: (svg: string, label: string) => void;
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
 * Excalidraw consumes URL-hash deep links on mount. We allow `addLibrary`
 * (handled via useHandleLibrary so libraries directory imports work) but
 * scrub `json` / `room` which trigger the hosted excalidraw.com scene-import
 * / collab flows we don't surface in this embed and which have crashed the
 * renderer.
 *
 * IMPORTANT: when the hash carries `addLibrary=`, we leave it alone in full
 * (including its companion `token=`, which authenticates the import on the
 * Excalidraw side). After useHandleLibrary completes the import it strips
 * `addLibrary` itself but leaves a residual `#token=…`. We deliberately do
 * NOT strip that token here — Excalidraw ignores standalone `token` (collab
 * also requires `room`), and calling `history.replaceState` during render
 * causes a "Cannot update a component (Router) while rendering …" warning
 * because Next.js App Router observes URL mutations.
 */
const EXCALIDRAW_HASH_KEYS = ["json", "room"];
function scrubExcalidrawHash() {
  if (typeof window === "undefined") return;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return;
  const params = new URLSearchParams(hash);
  // Library-import URLs are handled by useHandleLibrary — leave them alone.
  if (params.has("addLibrary")) return;
  let dirty = false;
  for (const k of EXCALIDRAW_HASH_KEYS) {
    if (params.has(k)) { params.delete(k); dirty = true; }
  }
  if (!dirty) return;
  const remaining = params.toString();
  const next = `${window.location.pathname}${window.location.search}${remaining ? `#${remaining}` : ""}`;
  window.history.replaceState(null, "", next);
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
  "editingGroupId",
  "editingLinearElement",
  "elementLocked",
  "lastPointerDownWith",
  "multiElement",
  "openDialog",
  "openMenu",
  "openPopup",
  "openSidebar",
  "resizingElement",
  "selectedElementIds",
  "selectedGroupIds",
  "selectionElement",
  "showHyperlinkPopup",
] as const;

function appStateForPersistence(raw: object): Record<string, unknown> {
  const out = { ...raw } as Record<string, unknown>;
  for (const key of VOLATILE_APP_STATE_KEYS) delete out[key];
  delete out.collaborators;
  return out;
}

export const WhiteboardCanvas = forwardRef<BaseCanvasHandle, Props>(function WhiteboardCanvas({ value, onChange }, ref) {
  // Must run synchronously before the Excalidraw instance reads location.hash.
  if (typeof window !== "undefined") scrubExcalidrawHash();
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
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
  });
  const [initialData] = useState(() => ({
    elements: (value.elements ?? []) as never[],
    appState: sanitizeAppState(value.appState) as never,
    files: (value.files ?? {}) as never,
    scrollToContent: true,
  }));
  const notifyRef = useRef<number | null>(null);
  const lastPersistedSnapshot = useRef("");
  const registerExcalidrawApi = useCallback((api: unknown) => {
    apiRef.current = api as ExcalidrawAPI;
    // useHandleLibrary only needs the first ready API instance. Re-setting this
    // state from Excalidraw's registration callback creates a render loop when
    // parent persistence updates re-render the custom MainMenu.
    setExcalidrawAPI((current: unknown) => current ?? api);
  }, []);

  const onAnyChange = useCallback((
    elements?: readonly unknown[],
    appState?: object,
    files?: Record<string, unknown>
  ) => {
    if (!onChange || !apiRef.current) return;
    const api = apiRef.current;
    const nextElements = [...(elements ?? api.getSceneElements())];
    const nextAppState = appStateForPersistence(appState ?? api.getAppState());
    const nextFiles = files ?? api.getFiles();
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
  }, [onChange]);

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
        },
      ] as never);
      api.updateScene({ elements: [...api.getSceneElements(), ...elements] });
    },
    []
  );

  const handleAssetDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
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
      const raw = event.dataTransfer.getData(
        "application/x-diagrammatic-whiteboard-asset"
      );
      if (!raw) return;
      event.preventDefault();
      event.stopPropagation();
      try {
        const asset = JSON.parse(raw) as { svg?: string; label?: string };
        if (!asset.svg || !asset.label) return;
        insertImageData(utf8ToBase64(asset.svg), "image/svg+xml", {
          width: 180,
          height: 180,
          idPrefix: `symbol-${asset.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          clientX: event.clientX,
          clientY: event.clientY,
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
    insertImage: (
      b64: string,
      mime: string,
      opts?: { width?: number; height?: number }
    ) =>
      insertImageData(b64, mime, { ...opts, idPrefix: "ai-img" }),
    insertSvgAsset: (svg: string, label: string) =>
      insertImageData(utf8ToBase64(svg), "image/svg+xml", {
        width: 180,
        height: 180,
        idPrefix: `symbol-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      }),
  }), [insertImageData, value]);

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
    if (
      !window.confirm(
        "Community libraries may contain third-party logos or trademarks with separate usage terms. Confirm that you have reviewed the library's rights for your intended use."
      )
    ) {
      return;
    }
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
    <div
      ref={wrapperRef}
      className="diagrammatic-whiteboard h-full w-full bg-slate-50"
      onDragOver={handleAssetDragOver}
      onDrop={handleAssetDrop}
    >
      <Excalidraw
        excalidrawAPI={registerExcalidrawApi}
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
          <MainMenu.Item
            onSelect={() => {
              if (
                window.confirm(
                  "Excalidraw community libraries are optional third-party content. Review each library's licensing and trademark terms before commercial use. Open the public catalog?"
                )
              ) {
                window.open(
                  "https://libraries.excalidraw.com/",
                  "_blank",
                  "noopener,noreferrer"
                );
              }
            }}
            icon={
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                <path d="M3 5h14v10H3z M3 9h14" />
              </svg>
            }
          >
            Browse public libraries
          </MainMenu.Item>
          <MainMenu.Separator />
          <MainMenu.DefaultItems.Help />
        </MainMenu>
      </Excalidraw>
    </div>
  );
});
