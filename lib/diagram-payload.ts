import { parseArchitectureDocument } from "./architecture-document.ts";
import { getWhiteboardSceneTransientElementIds, parseWhiteboardScene } from "./whiteboard-scene.ts";
import type { DiagrammaticMode } from "../components/diagrammatic/shared/types";

export function parseWhiteboardDocument(payload: unknown) {
  const scene = parseWhiteboardScene(payload);
  if (getWhiteboardSceneTransientElementIds(scene).length) {
    throw new Error("Whiteboard contains unfinished drawing, text or image elements. Finish or cancel the current action before saving or restoring; no partial scene was applied.");
  }
  return scene;
}

export function parseDiagramPayload(mode: DiagrammaticMode, payload: unknown): unknown {
  if (mode === "architecture") return parseArchitectureDocument(payload);
  if (mode === "whiteboard") return parseWhiteboardDocument(payload);
  return payload;
}
