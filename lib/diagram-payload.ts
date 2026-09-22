import { parseArchitectureDocument } from "./architecture-document.ts";
import { getWhiteboardSceneTransientElementIds, parseWhiteboardScene } from "./whiteboard-scene.ts";
import type { DiagrammaticMode } from "../components/diagrammatic/shared/types";

export function parseWhiteboardDocument(payload: unknown) {
  const scene = parseWhiteboardScene(payload);
  const omitted = new Set(getWhiteboardSceneTransientElementIds(scene));
  if (!omitted.size) return scene;
  // Native restoration discards unfinished placeholders. Do not reject the
  // entire board; library intake retains the original as a version first.
  return parseWhiteboardScene({
    ...scene,
    elements: scene.elements.filter((element) => !omitted.has(element.id)).map((element) => ({
      ...element,
      ...(element.boundElements ? { boundElements: element.boundElements.filter((binding) => !omitted.has(binding.id)) } : {}),
      ...(element.frameId && omitted.has(element.frameId) ? { frameId: null } : {}),
      ...(element.type === "text" && element.containerId && omitted.has(element.containerId) ? { containerId: null } : {}),
      ...((element.type === "arrow" || element.type === "line") && element.startBinding && omitted.has(element.startBinding.elementId) ? { startBinding: null } : {}),
      ...((element.type === "arrow" || element.type === "line") && element.endBinding && omitted.has(element.endBinding.elementId) ? { endBinding: null } : {}),
    })),
  });
}

export function parseDiagramPayload(mode: DiagrammaticMode, payload: unknown): unknown {
  if (mode === "architecture") return parseArchitectureDocument(payload);
  if (mode === "whiteboard") return parseWhiteboardDocument(payload);
  return payload;
}
