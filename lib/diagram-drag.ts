const PREFIX = "diagrammatic-drag-v1:";
const MAX_LENGTH = 1_000_000;
const MIME_TYPES = {
  icon: "application/x-diagrammatic-icon",
  shape: "application/x-diagrammatic-shape",
  whiteboard: "application/x-diagrammatic-whiteboard-asset",
  playground: "application/playground-item",
} as const;
export type DiagramDragKind = keyof typeof MIME_TYPES;

export function writeDiagramDrag(transfer: DataTransfer, kind: DiagramDragKind, data: string): void {
  if (!data || data.length > MAX_LENGTH) throw new Error("Dragged diagram data is empty or too large.");
  transfer.setData(MIME_TYPES[kind], data);
  transfer.setData("text/plain", PREFIX + JSON.stringify({ mime: MIME_TYPES[kind], data }));
  transfer.effectAllowed = "copy";
}

export function readDiagramDrag(transfer: Pick<DataTransfer, "getData">, kind: DiagramDragKind): string {
  const custom = transfer.getData(MIME_TYPES[kind]);
  if (custom) {
    if (custom.length > MAX_LENGTH) throw new Error("Dragged diagram data is too large.");
    return custom;
  }
  const text = transfer.getData("text/plain");
  if (!text.startsWith(PREFIX)) return "";
  if (text.length > MAX_LENGTH * 6 + 256) throw new Error("Dragged diagram data is too large.");
  let payload: unknown;
  try { payload = JSON.parse(text.slice(PREFIX.length)); }
  catch { throw new Error("Dragged diagram data is malformed."); }
  if (!payload || typeof payload !== "object" || !("mime" in payload) || !("data" in payload) ||
    typeof payload.mime !== "string" || typeof payload.data !== "string" || !payload.data || payload.data.length > MAX_LENGTH) {
    throw new Error("Dragged diagram data is malformed.");
  }
  return payload.mime === MIME_TYPES[kind] ? payload.data : "";
}

export function mayContainDiagramDrag(transfer: Pick<DataTransfer, "types">, kind: DiagramDragKind): boolean {
  // Protected drag-over data cannot be read until drop. Only the marked
  // envelope is interpreted on drop; ordinary text stays with the native editor.
  return Array.from(transfer.types).some((type) => type === MIME_TYPES[kind] || type === "text/plain");
}
