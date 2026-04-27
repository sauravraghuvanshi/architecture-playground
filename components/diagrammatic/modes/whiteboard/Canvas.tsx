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
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
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
  history: { clear: () => void };
}

export const WhiteboardCanvas = forwardRef<BaseCanvasHandle, Props>(function WhiteboardCanvas({ value, onChange }, ref) {
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const [initialData] = useState(() => ({
    elements: (value.elements ?? []) as never[],
    appState: { ...(value.appState ?? {}) } as never,
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
      api.updateScene({ elements: (data.elements ?? []) as unknown[], appState: data.appState as Record<string, unknown> });
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
