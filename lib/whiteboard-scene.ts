import { z } from "zod";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { BinaryFileData } from "@excalidraw/excalidraw/types";
import { decodeEvidenceImageDataUrl, EvidenceImageValidationError } from "./review-image.ts";

/**
 * Synchronous persistence boundary for Excalidraw 0.18.1. This validates transport,
 * headers and references, NOT decoded pixels. Callers must still decode images
 * before insertion and must validate the entire scene before mutating the engine.
 */
export const WHITEBOARD_SCENE_LIMITS = Object.freeze({
  elements: 5_000,
  files: 1_000,
  pointsPerElement: 20_000,
  totalPoints: 100_000,
  groupsPerElement: 64,
  depth: 32,
  values: 1_000_000,
  sceneBytes: 40 * 1024 * 1024,
  fileBytes: 5 * 1024 * 1024,
  totalFileBytes: 25 * 1024 * 1024,
  coordinate: 1_000_000,
  textLength: 100_000,
  svgNodes: 20_000,
  imageSide: 8_192,
  imagePixels: 16_000_000,
  imageFrames: 256,
  containerBoxes: 10_000,
});
export const WHITEBOARD_SCENE_MIME_TYPES = [
  "image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif",
  "image/bmp", "image/x-icon", "image/avif", "image/jfif", "application/octet-stream",
] as const;
/**
 * Historical Canvas snapshots included transient editor state. Canvas already
 * discards these fields; none describe persisted scene content. Omit them before
 * appState type validation, even when serialized runtime artifacts are incomplete.
 * They still pass the global JSON size/depth/value budget.
 */
export const WHITEBOARD_VOLATILE_APP_STATE_KEYS = [
  "activeTool", "contextMenu", "cursorButton", "cursorX", "cursorY",
  "draggingElement", "editingElement", "editingTextElement", "editingGroupId",
  "editingLinearElement", "elementLocked", "lastPointerDownWith", "newElement",
  "multiElement", "openDialog", "openMenu", "openPopup", "openSidebar",
  "resizingElement", "isResizing", "isRotating", "selectedElementsAreBeingDragged",
  "selectedElementIds", "selectedGroupIds", "selectedLinearElement", "selectionElement",
  "showHyperlinkPopup",
] as const;

export type WhiteboardSceneErrorCode =
  | "invalid_scene" | "limit_exceeded" | "invalid_element" | "duplicate_id"
  | "invalid_reference" | "invalid_app_state" | "invalid_file" | "unsafe_svg";

export class WhiteboardSceneValidationError extends Error {
  readonly code: WhiteboardSceneErrorCode;
  readonly path: (string | number)[];
  constructor(code: WhiteboardSceneErrorCode, path: (string | number)[], message: string) {
    super(`Invalid Whiteboard scene at ${path.length ? path.join(".") : "scene"}: ${message}`);
    this.name = "WhiteboardSceneValidationError";
    this.code = code;
    this.path = path;
  }
}

export type WhiteboardSceneElement = Exclude<ExcalidrawElement, { type: "selection" }> & Record<string, unknown>;
export type WhiteboardSceneFile = BinaryFileData & Record<string, unknown>;
export interface WhiteboardScenePayload {
  elements: WhiteboardSceneElement[];
  appState?: Record<string, unknown>;
  files?: Record<string, WhiteboardSceneFile>;
  [key: string]: unknown;
}

type RecordValue = Record<string, unknown>;
type Path = (string | number)[];
const LIMIT = WHITEBOARD_SCENE_LIMITS;
const own = (object: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(object, key);
const forbiddenKey = (key: string) => ["__proto__", "constructor", "prototype"].includes(key);
const types = ["rectangle", "diamond", "ellipse", "text", "image", "line", "arrow", "freedraw", "frame", "magicframe", "embeddable", "iframe"];
const arrowheads = ["arrow", "bar", "dot", "circle", "circle_outline", "triangle", "triangle_outline", "diamond", "diamond_outline", "crowfoot_one", "crowfoot_many", "crowfoot_one_or_many"];
const fills = ["hachure", "cross-hatch", "solid", "zigzag"];
const strokes = ["solid", "dashed", "dotted"];

function fail(code: WhiteboardSceneErrorCode, path: Path, message: string): never {
  throw new WhiteboardSceneValidationError(code, path, message);
}
function record(value: unknown, path: Path, code: WhiteboardSceneErrorCode): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code, path, "expected an object.");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && Object.getPrototypeOf(prototype) !== null) fail(code, path, "expected a plain JSON object.");
  return value as RecordValue;
}
function number(value: unknown, path: Path, code: WhiteboardSceneErrorCode, min: number = -LIMIT.coordinate, max: number = LIMIT.coordinate): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) fail(code, path, `expected a finite number between ${min} and ${max}.`);
}
function integer(value: unknown, path: Path, code: WhiteboardSceneErrorCode, min = 0, max = Number.MAX_SAFE_INTEGER) {
  number(value, path, code, min, max);
  if (!Number.isSafeInteger(value)) fail(code, path, "expected a safe integer.");
}
function string(value: unknown, path: Path, code: WhiteboardSceneErrorCode, max: number = LIMIT.textLength): asserts value is string {
  if (typeof value !== "string" || value.length > max) fail(code, path, `expected a string of at most ${max} characters.`);
}
function id(value: unknown, path: Path, code: WhiteboardSceneErrorCode): asserts value is string {
  string(value, path, code, 256);
  if (!value.trim() || /[\u0000-\u001f\u007f]/.test(value) || forbiddenKey(value)) fail(code, path, "expected a nonempty safe identifier.");
}
function bool(value: unknown, path: Path, code: WhiteboardSceneErrorCode) {
  if (typeof value !== "boolean") fail(code, path, "expected a boolean.");
}
function choice(value: unknown, choices: readonly unknown[], path: Path, code: WhiteboardSceneErrorCode) {
  if (!choices.includes(value)) fail(code, path, `unsupported value ${String(value).slice(0, 80)}.`);
}
function point(value: unknown, path: Path, min: number = -LIMIT.coordinate, max: number = LIMIT.coordinate) {
  if (!Array.isArray(value) || value.length !== 2) fail("invalid_element", path, "expected a two-coordinate point.");
  value.forEach((coordinate, index) => number(coordinate, [...path, index], "invalid_element", min, max));
}

/** Clone bounded JSON without invoking getters, toJSON, or retaining caller-owned references. */
function boundedJson(input: unknown): unknown {
  let count = 0;
  let bytes = 0;
  const active = new Set<object>();
  const encoder = new TextEncoder();
  const addString = (text: string, path: Path) => {
    if (text.length > LIMIT.sceneBytes) fail("limit_exceeded", path, "scene exceeds the input byte budget.");
    bytes += encoder.encode(text).length + 2;
  };
  const visit = (value: unknown, path: Path, depth: number): unknown => {
    if (++count > LIMIT.values || depth > LIMIT.depth) fail("limit_exceeded", path, "scene exceeds the value/depth budget.");
    bytes += 8;
    if (typeof value === "string") addString(value, path);
    else if (typeof value === "number") {
      if (!Number.isFinite(value)) fail("invalid_scene", path, "nonfinite numbers are not persisted JSON.");
    } else if (value !== null && typeof value !== "boolean") {
      if (typeof value !== "object") fail("invalid_scene", path, "expected JSON data (no undefined, functions, or runtime objects).");
      if (active.has(value)) fail("invalid_scene", path, "cyclic scene data.");
      if (!Array.isArray(value)) record(value, path, "invalid_scene");
      const keys = Object.keys(value);
      if (keys.length > LIMIT.values - count) fail("limit_exceeded", path, "scene exceeds the value budget.");
      if (Reflect.ownKeys(value).some((key) => typeof key === "symbol")) fail("invalid_scene", path, "symbol properties are not persisted JSON.");
      if (Array.isArray(value) && (value.length > LIMIT.values || keys.length !== value.length || keys.some((key, index) => key !== String(index)))) fail("invalid_scene", path, "sparse arrays and custom array properties are not supported.");
      const result: RecordValue | unknown[] = Array.isArray(value) ? [] : {};
      active.add(value);
      for (const key of keys) {
        if (forbiddenKey(key)) fail("invalid_scene", [...path, key], "unsafe object key.");
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        if (!own(descriptor, "value")) fail("invalid_scene", [...path, key], "accessors are not persisted JSON.");
        // Native constructors emit customData: undefined. This optional field is
        // absent in JSON, unlike undefined geometry or arbitrary metadata.
        if (path.length === 2 && path[0] === "elements" && key === "customData" && descriptor.value === undefined) continue;
        // Native capture has real Map/Set instances; historical JSON has {}.
        // Neither collection is persisted scene content or restored peer state.
        if (path.length === 1 && path[0] === "appState" &&
            (key === "collaborators" && descriptor.value instanceof Map || key === "followedBy" && descriptor.value instanceof Set)) continue;
        addString(key, path);
        Object.defineProperty(result, key, { value: visit(descriptor.value, [...path, Array.isArray(value) ? Number(key) : key], depth + 1), enumerable: true, configurable: true, writable: true });
      }
      active.delete(value);
      return result;
    }
    if (bytes > LIMIT.sceneBytes) fail("limit_exceeded", path, "scene exceeds the input byte budget.");
    return value;
  };
  const result = visit(input, [], 0);
  if (bytes > LIMIT.sceneBytes) fail("limit_exceeded", [], "scene exceeds the input byte budget.");
  return result;
}

function element(input: unknown, index: number): RecordValue {
  const path: Path = ["elements", index];
  const item = record(input, path, "invalid_element");
  id(item.id, [...path, "id"], "invalid_element");
  if (item.type === "draw") item.type = "line"; // Excalidraw's historic polyline name.
  choice(item.type, types, [...path, "type"], "invalid_element");
  for (const key of ["x", "y", "width", "height"]) number(item[key], [...path, key], "invalid_element", key === "width" || key === "height" ? 0 : -LIMIT.coordinate);
  // Only absent historic fields are defaulted. Explicit null/invalid values never
  // receive defaults, and no measured geometry or declared text is regenerated.
  const defaults: RecordValue = {
    strokeColor: "#1b1b1f", backgroundColor: "transparent", fillStyle: "hachure",
    strokeWidth: 1, strokeStyle: "solid", roughness: 1, opacity: 100, angle: 0,
    seed: 1, version: 1, versionNonce: 0, index: null, isDeleted: false,
    groupIds: [], frameId: null, boundElements: null, updated: 0, link: null,
    locked: false, roundness: null,
  };
  for (const [key, value] of Object.entries(defaults)) if (!own(item, key)) item[key] = value;
  for (const key of ["strokeColor", "backgroundColor"]) string(item[key], [...path, key], "invalid_element", 256);
  choice(item.fillStyle, fills, [...path, "fillStyle"], "invalid_element");
  choice(item.strokeStyle, strokes, [...path, "strokeStyle"], "invalid_element");
  for (const key of ["strokeWidth", "roughness"]) number(item[key], [...path, key], "invalid_element", 0, 1_000);
  number(item.opacity, [...path, "opacity"], "invalid_element", 0, 100);
  number(item.angle, [...path, "angle"], "invalid_element");
  for (const key of ["seed", "versionNonce"]) integer(item[key], [...path, key], "invalid_element", -2_147_483_648, 4_294_967_295);
  for (const key of ["version", "updated"]) integer(item[key], [...path, key], "invalid_element");
  for (const key of ["isDeleted", "locked"]) bool(item[key], [...path, key], "invalid_element");
  for (const key of ["frameId", "index"]) if (item[key] !== null) id(item[key], [...path, key], "invalid_element");
  if (item.link !== null) string(item.link, [...path, "link"], "invalid_element", 8_192);
  if (own(item, "customData")) record(item.customData, [...path, "customData"], "invalid_element");
  if (item.roundness !== null) {
    const roundness = record(item.roundness, [...path, "roundness"], "invalid_element");
    choice(roundness.type, [1, 2, 3], [...path, "roundness", "type"], "invalid_element");
    if (own(roundness, "value")) number(roundness.value, [...path, "roundness", "value"], "invalid_element", 0);
  }
  if (!Array.isArray(item.groupIds) || item.groupIds.length > LIMIT.groupsPerElement) fail("invalid_element", [...path, "groupIds"], "expected a bounded group ID array.");
  const groups = new Set<string>();
  item.groupIds.forEach((group, offset) => {
    id(group, [...path, "groupIds", offset], "invalid_element");
    if (groups.has(group)) fail("invalid_reference", [...path, "groupIds", offset], "duplicate group membership.");
    groups.add(group);
  });
  if (item.boundElements !== null) {
    if (!Array.isArray(item.boundElements) || item.boundElements.length > LIMIT.elements) fail("invalid_element", [...path, "boundElements"], "expected a bounded binding array or null.");
    const bound = new Set();
    item.boundElements.forEach((entry, offset) => {
      const binding = record(entry, [...path, "boundElements", offset], "invalid_element");
      id(binding.id, [...path, "boundElements", offset, "id"], "invalid_element");
      choice(binding.type, ["arrow", "text"], [...path, "boundElements", offset, "type"], "invalid_element");
      if (bound.has(binding.id)) fail("invalid_reference", [...path, "boundElements", offset], "duplicate bound element.");
      bound.add(binding.id);
    });
  }
  const setMissing = (values: RecordValue) => { for (const [key, value] of Object.entries(values)) if (!own(item, key)) item[key] = value; };
  if (["line", "arrow", "freedraw"].includes(item.type as string)) {
    // Pre-point linear scenes represented their endpoint by width/height.
    if (item.type !== "freedraw") setMissing({ points: [[0, 0], [item.width, item.height]] });
    if (!Array.isArray(item.points) || item.points.length > LIMIT.pointsPerElement) fail("invalid_element", [...path, "points"], "expected bounded shape-specific points.");
    item.points.forEach((value, offset) => point(value, [...path, "points", offset]));
    if (item.points.length && (item.points[0] as number[]).some((coordinate) => coordinate !== 0)) fail("invalid_element", [...path, "points", 0], "persisted points must start at their local origin (0, 0).");
    if (item.points.length < 2 && (item.width !== 0 || item.height !== 0)) fail("invalid_element", [...path, "points"], "an initial stroke must have zero bounds until its second point.");
    setMissing({ lastCommittedPoint: null });
    if (item.lastCommittedPoint !== null) point(item.lastCommittedPoint, [...path, "lastCommittedPoint"]);
    if (item.type === "freedraw") {
      setMissing({ simulatePressure: true, pressures: [] });
      bool(item.simulatePressure, [...path, "simulatePressure"], "invalid_element");
      if (!Array.isArray(item.pressures) || item.pressures.length !== 0 && item.pressures.length !== item.points.length || item.simulatePressure === false && (item.pressures as unknown[]).length !== item.points.length) fail("invalid_element", [...path, "pressures"], "pressure count must match points (or be empty for simulated pressure).");
      item.pressures.forEach((value, offset) => number(value, [...path, "pressures", offset], "invalid_element", 0, 1));
    } else {
      const points = item.points as number[][];
      const width = points.length ? Math.max(...points.map(([x]) => x)) - Math.min(...points.map(([x]) => x)) : 0;
      const height = points.length ? Math.max(...points.map(([, y]) => y)) - Math.min(...points.map(([, y]) => y)) : 0;
      const close = (declared: unknown, measured: number) => Math.abs((declared as number) - measured) <= 1e-8 + measured * 1e-12;
      if (!close(item.width, width) || !close(item.height, height)) fail("invalid_element", [...path, "points"], "linear point bounds must equal the declared width and height.");
      setMissing({ startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: item.type === "arrow" ? "arrow" : null });
      if (item.type === "arrow") { setMissing({ elbowed: false }); bool(item.elbowed, [...path, "elbowed"], "invalid_element"); }
      for (const key of ["startArrowhead", "endArrowhead"]) if (item[key] !== null) choice(item[key], arrowheads, [...path, key], "invalid_element");
      for (const key of ["startBinding", "endBinding"]) if (item[key] !== null) {
        if (item.type === "line") fail("invalid_element", [...path, key], "only arrows support endpoint bindings.");
        const binding = record(item[key], [...path, key], "invalid_element");
        id(binding.elementId, [...path, key, "elementId"], "invalid_element");
        // Native focus and fixedPoint are ratios, not clamped percentages:
        // outline gaps and small/rotated targets can put them outside [-1, 1]/[0, 1].
        number(binding.focus, [...path, key, "focus"], "invalid_element", -Infinity, Infinity);
        number(binding.gap, [...path, key, "gap"], "invalid_element", 0);
        if (own(binding, "fixedPoint") && binding.fixedPoint !== null) point(binding.fixedPoint, [...path, key, "fixedPoint"], -Infinity, Infinity);
        else if (item.elbowed) fail("invalid_element", [...path, key, "fixedPoint"], "elbow bindings require fixedPoint.");
      }
      for (const key of ["startIsSpecial", "endIsSpecial"]) if (own(item, key) && item[key] !== null) bool(item[key], [...path, key], "invalid_element");
      if (own(item, "fixedSegments") && item.fixedSegments !== null) {
        if (!Array.isArray(item.fixedSegments) || item.fixedSegments.length > item.points.length) fail("invalid_element", [...path, "fixedSegments"], "expected bounded fixed segments.");
        const indices = new Set();
        item.fixedSegments.forEach((entry, offset) => {
          const segment = record(entry, [...path, "fixedSegments", offset], "invalid_element");
          point(segment.start, [...path, "fixedSegments", offset, "start"]);
          point(segment.end, [...path, "fixedSegments", offset, "end"]);
          integer(segment.index, [...path, "fixedSegments", offset, "index"], "invalid_element", 1, (item.points as unknown[]).length - 1);
          if (indices.has(segment.index)) fail("invalid_element", [...path, "fixedSegments", offset], "duplicate fixed segment.");
          indices.add(segment.index);
        });
      }
    }
  } else if (item.type === "text") {
    string(item.text, [...path, "text"], "invalid_element");
    if (own(item, "font")) {
      string(item.font, [...path, "font"], "invalid_element", 256);
      const legacyFont = item.font.match(/^(\d+(?:\.\d+)?)px (Virgil|Helvetica|Cascadia)$/);
      if (!legacyFont) fail("invalid_element", [...path, "font"], "unsupported historic font shorthand.");
      const size = Number(legacyFont[1]);
      const family = { Virgil: 1, Helvetica: 2, Cascadia: 3 }[legacyFont[2] as "Virgil" | "Helvetica" | "Cascadia"];
      if (own(item, "fontSize") && item.fontSize !== size || own(item, "fontFamily") && item.fontFamily !== family) fail("invalid_element", [...path, "font"], "historic and current font declarations conflict.");
      setMissing({ fontSize: size, fontFamily: family });
    }
    setMissing({ originalText: item.text, fontSize: 20, fontFamily: 1, textAlign: "left", verticalAlign: "top", containerId: null, autoResize: true });
    setMissing({ lineHeight: item.height ? (item.height as number) / item.text.split(/\r\n|\r|\n/).length / (item.fontSize as number) : 1.25 });
    string(item.originalText, [...path, "originalText"], "invalid_element");
    number(item.fontSize, [...path, "fontSize"], "invalid_element", 0.1, 10_000);
    integer(item.fontFamily, [...path, "fontFamily"], "invalid_element", 1, 1_000);
    number(item.lineHeight, [...path, "lineHeight"], "invalid_element", 0.1, 100);
    choice(item.textAlign, ["left", "center", "right"], [...path, "textAlign"], "invalid_element");
    choice(item.verticalAlign, ["top", "middle", "bottom"], [...path, "verticalAlign"], "invalid_element");
    bool(item.autoResize, [...path, "autoResize"], "invalid_element");
    if (item.containerId !== null) id(item.containerId, [...path, "containerId"], "invalid_element");
  } else if (item.type === "image") {
    setMissing({ scale: [1, 1], status: "saved", crop: null });
    if (item.fileId === null && (item.isDeleted || item.status === "pending" || item.status === "error")) { /* Native import placeholders and tombstones need not have a binary yet. */ }
    else id(item.fileId, [...path, "fileId"], "invalid_element");
    choice(item.status, ["pending", "saved", "error"], [...path, "status"], "invalid_element");
    point(item.scale, [...path, "scale"], -1, 1);
    if ((item.scale as number[]).some((value) => value !== -1 && value !== 1)) fail("invalid_element", [...path, "scale"], "image scales must be -1 or 1.");
    if (item.crop !== null) {
      const crop = record(item.crop, [...path, "crop"], "invalid_element");
      for (const key of ["x", "y", "width", "height", "naturalWidth", "naturalHeight"]) number(crop[key], [...path, "crop", key], "invalid_element", ["x", "y"].includes(key) ? 0 : Number.MIN_VALUE);
      if ((crop.x as number) + (crop.width as number) > (crop.naturalWidth as number) + 0.000001 || (crop.y as number) + (crop.height as number) > (crop.naturalHeight as number) + 0.000001) fail("invalid_element", [...path, "crop"], "crop exceeds natural dimensions.");
    }
  } else if (item.type === "frame" || item.type === "magicframe") {
    setMissing({ name: null });
    if (item.name !== null) string(item.name, [...path, "name"], "invalid_element");
  }
  return item;
}

function validateReferences(elements: RecordValue[], files: RecordValue) {
  const byId = new Map(elements.map((item) => [item.id, item]));
  if (byId.size !== elements.length) fail("duplicate_id", ["elements"], "element IDs must be unique, including tombstones.");
  const groupParents = new Map<string, string>();
  const reference = (source: RecordValue, targetId: unknown, allowed: string[], path: Path) => {
    if (targetId === source.id) fail("invalid_reference", path, "self-reference is not allowed.");
    const target = byId.get(targetId);
    if (!target) {
      if (source.isDeleted) return;
      fail("invalid_reference", path, `missing element ${String(targetId)}.`);
    }
    if (!allowed.includes(target.type as string)) fail("invalid_reference", path, "reference has an incompatible target.");
    return target;
  };
  for (const [index, item] of elements.entries()) {
    const path: Path = ["elements", index];
    const groups = item.groupIds as string[];
    groups.forEach((group, offset) => {
      if (byId.has(group)) fail("invalid_reference", [...path, "groupIds", offset], "group IDs must not alias element IDs.");
      if (item.isDeleted) return;
      const parent = groups[offset + 1] ?? "";
      if (groupParents.has(group) && groupParents.get(group) !== parent) fail("invalid_reference", [...path, "groupIds", offset], "inconsistent nested group membership.");
      groupParents.set(group, parent);
    });
    if (item.frameId !== null) reference(item, item.frameId, ["frame", "magicframe"], [...path, "frameId"]);
    if (item.type === "text" && item.containerId !== null) reference(item, item.containerId, ["rectangle", "diamond", "ellipse", "arrow"], [...path, "containerId"]);
    if (item.type === "image" && !item.isDeleted && item.fileId !== null && !own(files, item.fileId as string)) fail("invalid_reference", [...path, "fileId"], "image binary is missing.");
    for (const key of ["startBinding", "endBinding"]) if (item[key] != null) {
      const binding = record(item[key], [...path, key], "invalid_element");
      reference(item, binding.elementId, ["rectangle", "diamond", "ellipse", "text", "image", "frame", "magicframe", "embeddable", "iframe"], [...path, key, "elementId"]);
    }
    for (const [offset, binding] of ((item.boundElements ?? []) as RecordValue[]).entries()) {
      const target = reference(item, binding.id, [binding.type as string], [...path, "boundElements", offset]);
      if (!target || item.isDeleted || target.isDeleted) continue;
      if (binding.type === "text" && target.containerId !== item.id) fail("invalid_reference", [...path, "boundElements", offset], "bound text must refer back to its container.");
      if (binding.type === "arrow" && (target.startBinding as RecordValue | null)?.elementId !== item.id && (target.endBinding as RecordValue | null)?.elementId !== item.id) fail("invalid_reference", [...path, "boundElements", offset], "bound arrow must refer back to its target.");
    }
    // Reciprocal lists were optional historically. Existing lists must agree,
    // but missing lists are not regenerated (that would silently repair content).
  }
  for (const [index, item] of elements.entries()) {
    const seen = new Set<unknown>([item.id]);
    let current = item;
    while (current.frameId !== null && byId.has(current.frameId)) {
      if (seen.has(current.frameId)) fail("invalid_reference", ["elements", index, "frameId"], "cyclic frame hierarchy.");
      seen.add(current.frameId);
      if (seen.size > LIMIT.depth) fail("limit_exceeded", ["elements", index, "frameId"], "frame hierarchy is too deep.");
      current = byId.get(current.frameId)!;
    }
  }
}

function validateAppState(input: unknown): RecordValue {
  const path: Path = ["appState"];
  const state = record(input, path, "invalid_app_state");
  for (const key of WHITEBOARD_VOLATILE_APP_STATE_KEYS) delete state[key];
  const check = (keys: string[], callback: (value: unknown, path: Path) => void) => {
    for (const key of keys) if (own(state, key)) callback(state[key], [...path, key]);
  };
  check(["theme"], (value, path) => choice(value, ["light", "dark"], path, "invalid_app_state"));
  check(["viewBackgroundColor", "currentItemStrokeColor", "currentItemBackgroundColor"], (value, path) => string(value, path, "invalid_app_state", 256));
  check(["scrollX", "scrollY", "offsetTop", "offsetLeft"], (value, path) => number(value, path, "invalid_app_state"));
  check(["width", "height", "currentItemStrokeWidth", "currentItemRoughness"], (value, path) => number(value, path, "invalid_app_state", 0));
  check(["currentItemFontSize"], (value, path) => number(value, path, "invalid_app_state", 0.1, 10_000));
  check(["currentItemFontFamily", "currentHoveredFontFamily"], (value, path) => { if (value !== null || path[1] !== "currentHoveredFontFamily") integer(value, path, "invalid_app_state", 1, 1_000); });
  check(["gridSize", "gridStep"], (value, path) => { if (value !== null) number(value, path, "invalid_app_state", 1, 1_000); });
  check(["exportScale"], (value, path) => number(value, path, "invalid_app_state", 0.1, 100));
  check(["currentItemOpacity"], (value, path) => number(value, path, "invalid_app_state", 0, 100));
  check(["showWelcomeScreen", "isLoading", "isBindingEnabled", "penMode", "penDetected", "exportBackground", "exportEmbedScene", "exportWithDarkMode", "scrolledOutside", "defaultSidebarDockedPreference", "shouldCacheIgnoreZoom", "zenModeEnabled", "gridModeEnabled", "viewModeEnabled", "objectsSnapModeEnabled", "isCropping"], (value, path) => bool(value, path, "invalid_app_state"));
  check(["currentItemFillStyle"], (value, path) => choice(value, fills, path, "invalid_app_state"));
  check(["currentItemStrokeStyle"], (value, path) => choice(value, strokes, path, "invalid_app_state"));
  check(["currentItemTextAlign"], (value, path) => choice(value, ["left", "center", "right"], path, "invalid_app_state"));
  check(["currentItemRoundness"], (value, path) => choice(value, ["round", "sharp"], path, "invalid_app_state"));
  check(["currentItemArrowType"], (value, path) => choice(value, ["sharp", "round", "elbow"], path, "invalid_app_state"));
  check(["currentItemStartArrowhead", "currentItemEndArrowhead"], (value, path) => { if (value !== null) choice(value, arrowheads, path, "invalid_app_state"); });
  check(["currentChartType"], (value, path) => choice(value, ["bar", "line"], path, "invalid_app_state"));
  check(["name", "errorMessage", "editingFrame", "pendingImageElementId", "croppingElementId"], (value, path) => { if (value !== null) string(value, path, "invalid_app_state"); });
  check(["zoom"], (value, path) => number(record(value, path, "invalid_app_state").value, [...path, "value"], "invalid_app_state", 0.1, 30));
  check(["previousSelectedElementIds", "hoveredElementIds"], (value, path) => {
    for (const [key, selected] of Object.entries(record(value, path, "invalid_app_state"))) {
      id(key, [...path, key], "invalid_app_state");
      bool(selected, [...path, key], "invalid_app_state");
    }
  });
  check(["frameRendering"], (value, path) => {
    const rendering = record(value, path, "invalid_app_state");
    for (const key of ["enabled", "name", "outline", "clip"]) if (own(rendering, key)) bool(rendering[key], [...path, key], "invalid_app_state");
  });
  check(["stats"], (value, path) => {
    const stats = record(value, path, "invalid_app_state");
    bool(stats.open, [...path, "open"], "invalid_app_state");
    integer(stats.panels, [...path, "panels"], "invalid_app_state");
  });
  check(["suggestedBindings", "snapLines", "searchMatches"], (value, path) => { if (!Array.isArray(value)) fail("invalid_app_state", path, "expected an array."); });
  check(["elementsToHighlight"], (value, path) => { if (value !== null && !Array.isArray(value)) fail("invalid_app_state", path, "expected an array or null."); });
  check(["startBoundElement", "frameToHighlight", "activeEmbeddable", "toast", "fileHandle", "userToFollow", "originSnapOffset", "pasteDialog"], (value, path) => { if (value !== null) record(value, path, "invalid_app_state"); });
  // JSON.stringify historically persisted Map/Set as {}. Along with the listed
  // transient UI fields, omit these empty runtime collections during migration.
  for (const key of ["collaborators", "followedBy"]) if (own(state, key)) {
    const value = record(state[key], [...path, key], "invalid_app_state");
    if (Object.keys(value).length) fail("invalid_app_state", [...path, key], "only an empty legacy runtime collection is supported.");
    delete state[key];
  }
  return state;
}

const svgTags = new Set("svg g defs title desc path rect circle ellipse line polyline polygon text tspan linearGradient radialGradient stop clipPath mask image".split(" "));
const svgAttributes = new Set("id class xmlns xmlns:xlink xml:space width height viewBox x y x1 x2 y1 y2 cx cy r rx ry fx fy d points transform gradientTransform gradientUnits spreadMethod offset preserveAspectRatio href xlink:href clipPathUnits maskUnits maskContentUnits dx dy rotate textLength lengthAdjust role aria-label aria-hidden style".split(" "));
const svgPaint = new Set("fill fill-rule fill-opacity stroke stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset stroke-opacity opacity stop-color stop-opacity color color-interpolation color-interpolation-filters clip-rule clip-path mask display visibility overflow font-size font-family font-weight font-style text-anchor dominant-baseline".split(" "));

function validateSvg(bytes: Uint8Array, path: Path): void {
  const bad = (message: string): never => fail("unsafe_svg", path, message);
  let xml: string;
  try { xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { bad("SVG must contain valid UTF-8."); }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/.test(xml!)) bad("SVG contains an invalid XML character.");
  const decode = (text: string): string => text.replace(/&([^;]*);|&/g, (full, entity: string | undefined) => {
    const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
    if (entity && own(named, entity)) return named[entity];
    if (!entity || !/^#(?:[0-9]+|x[0-9a-f]+)$/i.test(entity)) return bad("SVG has an invalid or external entity.");
    const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    if (!Number.isInteger(code) || !(code === 9 || code === 10 || code === 13 || code >= 32 && code <= 0xd7ff || code >= 0xe000 && code <= 0xfffd || code >= 0x10000 && code <= 0x10ffff)) return bad("SVG has an invalid character entity.");
    return String.fromCodePoint(code);
  });
  const paintValue = (value: string) => {
    if (/[\\@{}<>]|\/\*|(?:expression|var)\s*\(/i.test(value)) bad("SVG CSS escapes, directives, and dynamic values are not supported.");
    const rest = value.replace(/url\(\s*(['"]?)#[a-zA-Z_][\w:.-]*\1\s*\)/g, "");
    if (/url\s*\(|[():]/i.test(rest) && !/^(?:rgb|rgba|hsl|hsla)\([\d\s.,%+-]+\)$/.test(rest)) bad("SVG paint may only use local fragment resources.");
  };
  const stack: string[] = [];
  let position = 0;
  let roots = 0;
  let nodes = 0;
  while (position < xml!.length) {
    if (++nodes > LIMIT.svgNodes) bad("SVG exceeds the markup budget.");
    if (xml![position] !== "<") {
      const end = xml!.indexOf("<", position);
      const text = xml!.slice(position, end < 0 ? xml!.length : end);
      if (!stack.length && text.trim()) bad("SVG text outside the root.");
      if (text.includes("]]>")) bad("SVG contains an invalid text delimiter.");
      decode(text);
      position += text.length;
      continue;
    }
    if (xml!.startsWith("<!--", position)) {
      const end = xml!.indexOf("-->", position + 4);
      if (end < 0 || xml!.slice(position + 4, end).includes("--")) bad("Malformed SVG comment.");
      position = end + 3;
      continue;
    }
    if (xml!.startsWith("<?xml ", position) && roots === 0 && !xml!.slice(0, position).trim()) {
      const declaration = xml!.slice(position).match(/^<\?xml\s+version=["']1\.0["'](?:\s+encoding=["']utf-8["'])?(?:\s+standalone=["'](?:yes|no)["'])?\s*\?>/i);
      if (!declaration) bad("Unsupported XML declaration.");
      position += declaration![0].length;
      continue;
    }
    const close = xml!.slice(position).match(/^<\/([A-Za-z][\w.-]*)\s*>/);
    if (close) {
      if (stack.pop() !== close[1]) bad("SVG closing tags do not match.");
      position += close[0].length;
      continue;
    }
    const open = xml!.slice(position).match(/^<([A-Za-z][\w.-]*)(?=[\s/>])/);
    if (!open || !svgTags.has(open[1])) bad("SVG contains unsupported markup (scripts, foreignObject, and external resources are forbidden).");
    const tag = open![1];
    if (!stack.length && (tag !== "svg" || ++roots !== 1)) bad("SVG must have exactly one svg root.");
    position += open![0].length;
    const attributes: Record<string, string> = {};
    while (!xml!.startsWith(">", position) && !xml!.startsWith("/>", position)) {
      const whitespace = xml!.slice(position).match(/^\s+/);
      if (!whitespace) bad("SVG attributes must be separated by whitespace.");
      position += whitespace![0].length;
      if (xml!.startsWith(">", position) || xml!.startsWith("/>", position)) break;
      const attribute = xml!.slice(position).match(/^([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/);
      if (!attribute) bad("Malformed or unquoted SVG attribute.");
      const key = attribute![1];
      if (own(attributes, key) || forbiddenKey(key) || !svgAttributes.has(key) && !svgPaint.has(key) && !/^data-[\w-]+$/.test(key)) bad("SVG contains a duplicate or unsupported attribute.");
      const value = decode(attribute![2] ?? attribute![3]);
      attributes[key] = value;
      position += attribute![0].length;
      if (key === "xmlns" && value !== "http://www.w3.org/2000/svg" || key === "xmlns:xlink" && value !== "http://www.w3.org/1999/xlink") bad("SVG namespace may not be rebound.");
      if (key === "href" || key === "xlink:href") {
        if (/^#[A-Za-z_][\w:.-]*$/.test(value)) {
          if (!["linearGradient", "radialGradient"].includes(tag)) bad("Only gradient inheritance may reference local SVG elements.");
        } else if (tag === "image" && /^data:image\/(?:png|jpeg|webp);base64,/.test(value)) {
          // XML attribute whitespace in bundled inline raster data is legal.
          const normalized = value.replace(/[\t\n\r ]/g, "");
          validateRaster(normalized.slice(5, normalized.indexOf(";")), normalized, path);
        } else bad("SVG href must not load external or nested SVG resources.");
      }
      if (svgPaint.has(key)) paintValue(value);
      if (key === "style") for (const declaration of value.split(";").filter((value) => value.trim())) {
        const colon = declaration.indexOf(":");
        if (colon < 0 || !svgPaint.has(declaration.slice(0, colon).trim())) bad("Unsupported SVG style property.");
        paintValue(declaration.slice(colon + 1).trim());
      }
    }
    if (tag === "svg") {
      let hasSize = false;
      if (attributes.viewBox !== undefined) {
        const bounds = attributes.viewBox.trim().split(/[\s,]+/).map(Number);
        if (bounds.length !== 4 || !bounds.every(Number.isFinite) || bounds.some((value) => Math.abs(value) > LIMIT.coordinate) || bounds[2] <= 0 || bounds[3] <= 0) bad("SVG viewBox must contain bounded, positive dimensions.");
        hasSize = true;
      }
      for (const key of ["width", "height"]) if (attributes[key] !== undefined) {
        if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:px|pt|pc|in|cm|mm|em|ex|%)?$/.test(attributes[key]) || parseFloat(attributes[key]) <= 0 || parseFloat(attributes[key]) > 8192) bad("SVG dimensions must be positive and bounded.");
      }
      if (!hasSize && !(attributes.width && attributes.height)) bad("SVG requires a viewBox or explicit dimensions.");
    }
    if (xml!.startsWith("/>", position)) position += 2;
    else {
      stack.push(tag);
      if (stack.length > LIMIT.depth) bad("SVG exceeds the nesting budget.");
      position++;
    }
  }
  if (stack.length || roots !== 1) bad("SVG is incomplete.");
}

const pngCrcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ crc >>> 1 : crc >>> 1;
  return crc >>> 0;
});

function validateRaster(mimeType: string, dataURL: string, path: Path): number {
  try {
    const bytes = decodeEvidenceImageDataUrl({ mimeType: mimeType as "image/png" | "image/jpeg" | "image/webp", dataUrl: dataURL });
    if (mimeType === "image/png") {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const depths: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      if (!depths[bytes[25]]?.includes(bytes[24]) || bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] > 1) fail("invalid_file", path, "PNG contains invalid IHDR fields.");
      let headers = 0;
      let animationFrames = 0;
      let frameControls = 0;
      let framePixels = 0;
      for (let offset = 8; offset < bytes.length;) {
        const length = view.getUint32(offset);
        const end = offset + 8 + length;
        const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
        if (!/^[A-Za-z]{4}$/.test(type) || type[2] !== type[2].toUpperCase()) fail("invalid_file", path, "PNG contains an invalid chunk type.");
        if (type === "IHDR") headers++;
        if (type === "acTL") {
          if (length !== 8 || animationFrames || !view.getUint32(offset + 8) || view.getUint32(offset + 8) > LIMIT.imageFrames) fail("invalid_file", path, "PNG animation exceeds its frame budget.");
          animationFrames = view.getUint32(offset + 8);
        }
        if (type === "fcTL") {
          if (length !== 26 || !animationFrames) fail("invalid_file", path, "PNG animation frame control is invalid.");
          const width = view.getUint32(offset + 12), height = view.getUint32(offset + 16);
          imageDimensions(width, height, path);
          if (view.getUint32(offset + 20) + width > view.getUint32(16) || view.getUint32(offset + 24) + height > view.getUint32(20)) fail("invalid_file", path, "PNG animation frame exceeds its canvas.");
          framePixels += width * height;
          if (++frameControls > animationFrames || framePixels > LIMIT.imagePixels) fail("invalid_file", path, "PNG animation exceeds its pixel budget.");
        }
        if (type === "IEND" && end + 4 !== bytes.length) fail("invalid_file", path, "PNG contains a premature end chunk.");
        let crc = 0xffffffff;
        for (let index = offset + 4; index < end; index++) crc = pngCrcTable[(crc ^ bytes[index]) & 0xff] ^ crc >>> 8;
        if (((crc ^ 0xffffffff) >>> 0) !== view.getUint32(end)) fail("invalid_file", path, "PNG chunk checksum is invalid.");
        offset = end + 4;
      }
      if (headers !== 1) fail("invalid_file", path, "PNG must have exactly one IHDR.");
      if (animationFrames !== frameControls) fail("invalid_file", path, "PNG animation frame count is inconsistent.");
    } else if (mimeType === "image/webp") {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const uint24 = (offset: number) => bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16;
      let frames = 0, pixels = 0;
      for (let offset = 12; offset + 8 <= bytes.length;) {
        const length = view.getUint32(offset + 4, true);
        if (bytesStart(bytes, "ANMF", offset)) {
          if (length < 16) fail("invalid_file", path, "WebP animation frame header is incomplete.");
          const width = uint24(offset + 14) + 1, height = uint24(offset + 17) + 1;
          imageDimensions(width, height, path);
          pixels += width * height;
          if (++frames > LIMIT.imageFrames || pixels > LIMIT.imagePixels) fail("invalid_file", path, "WebP animation exceeds its frame/pixel budget.");
        }
        offset += 8 + length + (length & 1);
      }
    }
    return bytes.byteLength;
  } catch (error) {
    if (error instanceof EvidenceImageValidationError) fail("invalid_file", path, error.message);
    throw error;
  }
}

function decodeSceneBinary(mimeType: string, dataURL: string, path: Path): { bytes: Uint8Array; encoded: string } {
  const prefix = `data:${mimeType};base64,`;
  if (!dataURL.startsWith(prefix)) fail("invalid_file", path, "binary requires a data URL matching its declared MIME type.");
  const encoded = dataURL.slice(prefix.length);
  if (!encoded || encoded.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) fail("invalid_file", path, "binary requires canonical base64.");
  const decoded = atob(encoded);
  if (btoa(decoded) !== encoded) fail("invalid_file", path, "base64 padding bits are invalid.");
  if (decoded.length > LIMIT.fileBytes) fail("limit_exceeded", path, "binary exceeds the file budget.");
  return { bytes: Uint8Array.from(decoded, (char) => char.charCodeAt(0)), encoded };
}

function imageDimensions(width: number, height: number, path: Path) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 ||
      width > LIMIT.imageSide || height > LIMIT.imageSide || width * height > LIMIT.imagePixels) {
    fail("invalid_file", path, "image dimensions exceed 8192 pixels/side or 16 megapixels.");
  }
}

function bytesStart(bytes: Uint8Array, text: string, offset = 0): boolean {
  return [...text].every((char, index) => bytes[offset + index] === char.charCodeAt(0));
}

function sniffSceneImage(bytes: Uint8Array): string | undefined {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytesStart(bytes, "RIFF") && bytesStart(bytes, "WEBP", 8)) return "image/webp";
  if (bytesStart(bytes, "GIF87a") || bytesStart(bytes, "GIF89a")) return "image/gif";
  if (bytesStart(bytes, "BM")) return "image/bmp";
  if (bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return "image/x-icon";
  if (bytesStart(bytes, "ftyp", 4)) return "image/avif";
  if (/^\s*(?:<\?xml\b[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/.test(new TextDecoder().decode(bytes.subarray(0, 1024)))) return "image/svg+xml";
  return undefined;
}

function validateGif(bytes: Uint8Array, path: Path) {
  const invalid = (message = "GIF container is incomplete or malformed."): never => fail("invalid_file", path, message);
  if (bytes.length < 14) invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint16(6, true);
  const height = view.getUint16(8, true);
  imageDimensions(width, height, path);
  let offset = 13 + (bytes[10] & 128 ? 3 * 2 ** ((bytes[10] & 7) + 1) : 0);
  let frames = 0;
  let pixels = 0;
  const blocks = () => {
    let data = 0;
    for (;;) {
      if (offset >= bytes.length) invalid();
      const size = bytes[offset++];
      if (!size) return data;
      if (offset + size > bytes.length) invalid();
      data += size;
      offset += size;
    }
  };
  while (offset < bytes.length) {
    const marker = bytes[offset++];
    if (marker === 0x3b) {
      if (!frames || offset !== bytes.length) invalid();
      return;
    }
    if (marker === 0x21) {
      if (offset >= bytes.length) invalid();
      const extension = bytes[offset++];
      if (extension === 0xf9) {
        if (bytes[offset] !== 4 || offset + 6 > bytes.length || bytes[offset + 5] !== 0) invalid();
        offset += 6;
      } else if ([0x01, 0xfe, 0xff].includes(extension)) {
        if (extension === 0x01 && bytes[offset] !== 12 || extension === 0xff && bytes[offset] !== 11) invalid();
        blocks();
      } else invalid("GIF contains an unknown extension.");
    } else if (marker === 0x2c) {
      if (offset + 9 > bytes.length) invalid();
      const x = view.getUint16(offset, true), y = view.getUint16(offset + 2, true);
      const w = view.getUint16(offset + 4, true), h = view.getUint16(offset + 6, true);
      imageDimensions(w, h, path);
      if (x + w > width || y + h > height) invalid("GIF frame exceeds its canvas.");
      const packed = bytes[offset + 8];
      if (!(packed & 128) && !(bytes[10] & 128)) invalid("GIF frame has no color table.");
      offset += 9 + (packed & 128 ? 3 * 2 ** ((packed & 7) + 1) : 0);
      if (offset >= bytes.length || bytes[offset] < 2 || bytes[offset] > 8) invalid("GIF LZW header is invalid.");
      offset++;
      if (!blocks()) invalid("GIF frame contains no image data.");
      pixels += w * h;
      if (++frames > LIMIT.imageFrames || pixels > LIMIT.imagePixels) invalid("GIF exceeds the total frame/pixel budget.");
    } else invalid();
  }
  invalid();
}

function validateDib(bytes: Uint8Array, path: Path, options: { icon?: boolean; pixelOffset?: number } = {}) {
  const invalid = (message = "Bitmap header or pixel envelope is invalid."): never => fail("invalid_file", path, message);
  if (bytes.length < 12) invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const header = view.getUint32(0, true);
  if (![12, 40, 52, 56, 108, 124].includes(header) || header > bytes.length) invalid("Unsupported or truncated DIB header.");
  const width = header === 12 ? view.getUint16(4, true) : view.getInt32(4, true);
  const storedHeight = header === 12 ? view.getUint16(6, true) : view.getInt32(8, true);
  const height = Math.abs(storedHeight) / (options.icon ? 2 : 1);
  imageDimensions(width, height, path);
  const planes = view.getUint16(header === 12 ? 8 : 12, true);
  const bits = view.getUint16(header === 12 ? 10 : 14, true);
  const compression = header === 12 ? 0 : view.getUint32(16, true);
  if (planes !== 1 || ![1, 4, 8, 16, 24, 32].includes(bits) || ![0, 1, 2, 3, 6].includes(compression)) invalid();
  if (compression === 1 && bits !== 8 || compression === 2 && bits !== 4 || [3, 6].includes(compression) && ![16, 32].includes(bits)) invalid();
  const colors = header === 12 ? 0 : view.getUint32(32, true);
  if (colors > 256 || bits <= 8 && colors > 2 ** bits) invalid();
  const paletteBytes = (colors || (bits <= 8 ? 2 ** bits : 0)) * (header === 12 ? 3 : 4);
  const masks = header === 40 && [3, 6].includes(compression) ? compression === 6 ? 16 : 12 : 0;
  const minimumOffset = header + masks + paletteBytes;
  const start = options.pixelOffset ?? minimumOffset;
  if (start < minimumOffset || start >= bytes.length) invalid();
  if ([0, 3, 6].includes(compression)) {
    const rasterBytes = Math.ceil(width * bits / 32) * 4 * height;
    const andMask = options.icon && bits !== 32 ? Math.ceil(width / 32) * 4 * height : 0;
    if (start + rasterBytes + andMask > bytes.length) invalid("Bitmap pixel data is truncated.");
  } else {
    if (options.icon || storedHeight < 0) invalid("Compressed icon/top-down bitmaps are unsupported.");
    const size = view.getUint32(20, true);
    if (size < 2 || start + size > bytes.length || bytes[start + size - 2] !== 0 || bytes[start + size - 1] !== 1) invalid("Compressed bitmap must have a bounded RLE end marker.");
  }
  return { width, height };
}

function validateBmp(bytes: Uint8Array, path: Path) {
  if (bytes.length < 26) fail("invalid_file", path, "BMP header is truncated.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(2, true) !== bytes.length || view.getUint32(10, true) < 26) fail("invalid_file", path, "BMP file length or pixel offset is invalid.");
  validateDib(bytes.subarray(14), path, { pixelOffset: view.getUint32(10, true) - 14 });
}

function validateIco(bytes: Uint8Array, path: Path) {
  const invalid = (message = "ICO directory or image envelope is invalid."): never => fail("invalid_file", path, message);
  if (bytes.length < 22) invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(4, true);
  if (!count || count > LIMIT.imageFrames || 6 + count * 16 > bytes.length) invalid();
  let pixels = 0;
  let imageBytes = 0;
  for (let index = 0; index < count; index++) {
    const entry = 6 + index * 16;
    const width = bytes[entry] || 256, height = bytes[entry + 1] || 256;
    const length = view.getUint32(entry + 8, true), offset = view.getUint32(entry + 12, true);
    if (bytes[entry + 3] !== 0 || offset < 6 + count * 16 || !length || offset + length > bytes.length) invalid();
    imageBytes += length;
    if (imageBytes > LIMIT.totalFileBytes) invalid("ICO exceeds its decoded-entry byte budget.");
    const image = bytes.subarray(offset, offset + length);
    let dimensions: { width: number; height: number };
    if (sniffSceneImage(image) === "image/png") {
      const encoded = btoa(Array.from(image, (byte) => String.fromCharCode(byte)).join(""));
      validateRaster("image/png", `data:image/png;base64,${encoded}`, path);
      const png = new DataView(image.buffer, image.byteOffset, image.byteLength);
      dimensions = { width: png.getUint32(16), height: png.getUint32(20) };
    } else dimensions = validateDib(image, path, { icon: true });
    if (dimensions.width !== width || dimensions.height !== height) invalid("ICO directory dimensions disagree with image data.");
    pixels += width * height;
    if (pixels > LIMIT.imagePixels) invalid("ICO exceeds its total pixel budget.");
  }
}

function validateAvif(bytes: Uint8Array, path: Path) {
  const invalid = (message = "AVIF box envelope is invalid."): never => fail("invalid_file", path, message);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let boxes = 0, dimensions = 0, codecs = 0, locations = 0, primary = 0;
  let avifBrand = false, payload = false;
  const media: { start: number; end: number; itemData: boolean }[] = [];
  const extents: { start: number; length: number; relative: boolean }[] = [];
  const walk = (start: number, end: number, depth: number) => {
    if (depth > LIMIT.depth) invalid("AVIF nesting exceeds its budget.");
    for (let offset = start; offset < end;) {
      if (++boxes > LIMIT.containerBoxes || offset + 8 > end) invalid();
      let size = view.getUint32(offset);
      let header = 8;
      const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      if (size === 1) {
        if (offset + 16 > end || view.getUint32(offset + 8) !== 0) invalid();
        size = view.getUint32(offset + 12); header = 16;
      } else if (size === 0) size = end - offset;
      if (size < header || offset + size > end) invalid();
      const data = offset + header, limit = offset + size;
      if (type === "ftyp") {
        if (depth !== 0 || offset !== 0 || limit - data < 8 || (limit - data) % 4) invalid();
        for (let index = data; index + 4 <= limit; index += 4) {
          if (index !== data + 4 && (bytesStart(bytes, "avif", index) || bytesStart(bytes, "avis", index))) avifBrand = true;
        }
      } else if (type === "ispe") {
        if (limit - data !== 12 || view.getUint32(data) !== 0) invalid();
        imageDimensions(view.getUint32(data + 4), view.getUint32(data + 8), path); dimensions++;
      } else if (type === "av1C") {
        if (limit - data < 4 || bytes[data] !== 0x81) invalid("AVIF codec configuration is invalid.");
        codecs++;
      } else if (type === "mdat" || type === "idat") {
        if (limit <= data) invalid();
        payload = true;
        media.push({ start: data, end: limit, itemData: type === "idat" });
      } else if (type === "pitm") {
        if (limit - data !== (bytes[data] === 0 ? 6 : bytes[data] === 1 ? 8 : -1)) invalid();
        primary++;
      } else if (type === "iloc") {
        if (limit - data < 8 || bytes[data] > 2) invalid();
        const version = bytes[data], offsetSize = bytes[data + 4] >> 4, lengthSize = bytes[data + 4] & 15;
        const baseSize = bytes[data + 5] >> 4, indexSize = version ? bytes[data + 5] & 15 : 0;
        if (![offsetSize, lengthSize, baseSize, indexSize].every((size) => [0, 4, 8].includes(size))) invalid("Unsupported AVIF location integer widths.");
        let cursor = data + 6;
        const read = (size: number): number => {
          if (cursor + size > limit) invalid();
          let value = 0;
          for (let index = 0; index < size; index++) value = value * 256 + bytes[cursor++];
          if (!Number.isSafeInteger(value)) invalid();
          return value;
        };
        const count = read(version < 2 ? 2 : 4);
        if (!count || count > LIMIT.containerBoxes) invalid();
        for (let item = 0; item < count; item++) {
          read(version < 2 ? 2 : 4);
          const method = version ? read(2) & 15 : 0;
          if (method > 1 || read(2) !== 0) invalid("AVIF external item resources are unsupported.");
          const base = read(baseSize), extentCount = read(2);
          if (!extentCount || extentCount > LIMIT.containerBoxes) invalid();
          for (let extent = 0; extent < extentCount; extent++) {
            read(indexSize);
            const position = read(offsetSize), length = read(lengthSize);
            if (!length || base + position + length > bytes.length) invalid("AVIF item extent exceeds its container.");
            extents.push({ start: base + position, length, relative: method === 1 });
            if (extents.length > LIMIT.containerBoxes) invalid("AVIF exceeds the item-extent budget.");
          }
        }
        if (cursor !== limit) invalid();
        locations++;
      }
      if (["meta", "iprp", "ipco", "moov", "trak", "mdia", "minf", "stbl"].includes(type)) {
        const skip = type === "meta" ? 4 : 0;
        if (data + skip > limit) invalid();
        walk(data + skip, limit, depth + 1);
      }
      offset = limit;
    }
  };
  walk(0, bytes.length, 0);
  if (!avifBrand || !dimensions || !codecs || !locations || !primary || !payload) invalid("AVIF requires an image item, dimensions, codec configuration and media payload.");
  for (const extent of extents) if (!media.some((region) => {
    if (extent.relative !== region.itemData) return false;
    const start = extent.start + (extent.relative ? region.start : 0);
    return start >= region.start && start + extent.length <= region.end;
  })) invalid("AVIF item extents must reference contained image payload, not headers or external resources.");
}

function validateSceneImage(file: RecordValue, path: Path): number {
  const declared = file.mimeType as string;
  const { bytes, encoded } = decodeSceneBinary(declared, file.dataURL as string, path);
  if (declared === "image/svg+xml") {
    validateSvg(bytes, path);
    return bytes.length;
  }
  const actual = sniffSceneImage(bytes);
  const pngFallback = actual === "image/png" && ["image/gif", "image/bmp", "image/x-icon", "image/avif", "image/jfif"].includes(declared);
  if (!actual || actual !== declared && !(declared === "image/jfif" && actual === "image/jpeg") && declared !== "application/octet-stream" && !pngFallback) {
    fail("invalid_file", path, "decoded signature does not match the declared image type.");
  }
  if (["image/png", "image/jpeg", "image/webp"].includes(actual)) validateRaster(actual, `data:${actual};base64,${encoded}`, path);
  else if (actual === "image/svg+xml") validateSvg(bytes, path);
  else if (actual === "image/gif") validateGif(bytes, path);
  else if (actual === "image/bmp") validateBmp(bytes, path);
  else if (actual === "image/x-icon") validateIco(bytes, path);
  else if (actual === "image/avif") validateAvif(bytes, path);
  // Native resizeImageFile uses canvas.toBlob(sourceType), then wraps output in
  // File({type: sourceType}). Unsupported encoders return PNG. Canonicalize this
  // proven historical mislabel without touching bytes/IDs; arbitrary mismatches
  // remain invalid. Generic binary images also need a real MIME for ImageCache.
  if (pngFallback || declared === "application/octet-stream") {
    file.mimeType = actual;
    file.dataURL = `data:${actual};base64,${encoded}`;
  }
  return bytes.length;
}

function validateFiles(input: unknown): RecordValue {
  const files = record(input, ["files"], "invalid_file");
  const entries = Object.entries(files);
  if (entries.length > LIMIT.files) fail("limit_exceeded", ["files"], "too many binary files.");
  let totalBytes = 0;
  for (const [key, value] of entries) {
    const path: Path = ["files", key];
    id(key, path, "invalid_file");
    const file = record(value, path, "invalid_file");
    if (file.id !== key) fail("invalid_file", [...path, "id"], "file ID must equal its record key.");
    choice(file.mimeType, WHITEBOARD_SCENE_MIME_TYPES, [...path, "mimeType"], "invalid_file");
    string(file.dataURL, [...path, "dataURL"], "invalid_file", 4 * Math.ceil(LIMIT.fileBytes / 3) + 64);
    integer(file.created, [...path, "created"], "invalid_file");
    for (const key of ["lastRetrieved", "version"]) if (own(file, key)) integer(file[key], [...path, key], "invalid_file");
    const size = validateSceneImage(file, [...path, "dataURL"]);
    if (own(file, "size")) {
      integer(file.size, [...path, "size"], "invalid_file");
      if (file.size !== size) fail("invalid_file", [...path, "size"], "declared size does not match decoded bytes.");
    }
    totalBytes += size;
    if (totalBytes > LIMIT.totalFileBytes) fail("limit_exceeded", ["files"], "binary files exceed the total byte budget.");
  }
  return files;
}

export function parseWhiteboardScene(input: unknown): WhiteboardScenePayload {
  const scene = record(boundedJson(input), [], "invalid_scene");
  if (!Array.isArray(scene.elements)) fail("invalid_scene", ["elements"], "expected an element array.");
  if (scene.elements.length > LIMIT.elements) fail("limit_exceeded", ["elements"], "too many elements.");
  const elements = scene.elements.map(element);
  const points = elements.reduce((sum, item) => sum + (Array.isArray(item.points) ? item.points.length : 0), 0);
  if (points > LIMIT.totalPoints) fail("limit_exceeded", ["elements"], "too many total points.");
  const files = own(scene, "files") ? validateFiles(scene.files) : {};
  if (own(scene, "appState")) scene.appState = validateAppState(scene.appState);
  validateReferences(elements, files);
  scene.elements = elements;
  return scene as unknown as WhiteboardScenePayload;
}

/**
 * Native onChange/capture can contain incomplete gestures or image imports. They
 * are valid, retained verbatim, and must not turn autosave into a validation error.
 * Excalidraw itself may elide unfinished geometry on restore. Callers wanting
 * only settled checkpoints can defer capture while this list is nonempty.
 */
export function getWhiteboardSceneTransientElementIds(scene: WhiteboardScenePayload): string[] {
  return scene.elements.filter((item) => !item.isDeleted && (
    (item.type === "arrow" || item.type === "line" || item.type === "freedraw"
      ? item.points.length < 2
      : item.width === 0 && item.height === 0) ||
    item.type === "text" && item.text === "" ||
    item.type === "image" && item.fileId === null && item.status === "pending"
  )).map((item) => item.id);
}

/** Zod adapter for shared hydration/import contracts, with the same limits and migrations. */
export const whiteboardSceneSchema = z.unknown().transform((input, context): WhiteboardScenePayload => {
  try { return parseWhiteboardScene(input); }
  catch (error) {
    if (!(error instanceof WhiteboardSceneValidationError)) throw error;
    context.addIssue({ code: "custom", path: error.path, message: error.message, params: { sceneCode: error.code } });
    return z.NEVER;
  }
});
