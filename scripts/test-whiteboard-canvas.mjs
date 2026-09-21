import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as appearance from "../lib/whiteboard-appearance.ts";
import { parseWhiteboardDocument } from "../lib/diagram-payload.ts";
import * as diagramDrag from "../lib/diagram-drag.ts";

const source = readFileSync(new URL("../components/diagrammatic/modes/whiteboard/Canvas.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const pngData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgqLjyHwAEFAJMURtfXQAAAABJRU5ErkJggg==";
const imageFile = { id: "image1", mimeType: "image/png", dataURL: pngData, created: 1, lastRetrieved: 2, version: 1 };
const imageElement = { id: "drawing1", type: "image", fileId: "image1", x: 0, y: 0, width: 100, height: 100, scale: [1, 1], status: "saved" };
const plain = (value) => JSON.parse(JSON.stringify(value));

// Stub the drawing engine and hook lifecycle, but execute the actual canvas handle implementation.
function canvasHarness({ ready = true, pngFailure, gifFailure, imageWidth = 1200, imageHeight = 800, state = {}, decode, onChange } = {}) {
  const calls = [];
  const files = {};
  let elements = [];
  const png = new Blob(["png"], { type: "image/png" });
  const gif = new Blob(["gif"], { type: "image/gif" });
  const api = {
    getFiles: () => files,
    getSceneElements: () => elements,
    getAppState: () => ({ exportEmbedScene: true, viewBackgroundColor: "#05080d", ...state }),
    addFiles: (added) => {
      calls.push(["addFiles", added]);
      for (const file of added) files[file.id] = file;
    },
    updateScene: (scene) => {
      calls.push(["updateScene", scene]);
      if (scene.elements) elements = scene.elements;
      for (const element of elements) {
        if (element.type === "image") assert.ok(files[element.fileId], "Image binaries must exist before scene restoration");
      }
    },
    history: { clear: () => calls.push(["clearHistory"]) },
  };
  const wrapper = {
    querySelector: (selector) => ({ click: () => calls.push(["click", selector]) }),
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
  let refIndex = 0;
  let nextElementId = 0;
  const dependencies = {
    react: {
      forwardRef: (render) => render,
      useCallback: (callback) => callback,
      useEffect: () => {},
      useImperativeHandle: (ref, factory) => { ref.current = factory(); },
      useRef: (initial) => ({ current: refIndex++ === 0 ? (ready ? api : null) : refIndex === 2 ? wrapper : initial }),
      useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
    },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    "@excalidraw/excalidraw": {
      Excalidraw: "Excalidraw",
      MainMenu: { DefaultItems: { SaveAsImage: "SaveAsImage", ClearCanvas: "ClearCanvas" } },
      convertToExcalidrawElements: (value) => value.map((element) => ({ ...element, id: `native-${++nextElementId}` })),
      newElementWith: (element, updates) => ({ ...element, ...updates, version: (element.version ?? 0) + 1 }),
      CaptureUpdateAction: { IMMEDIATELY: "IMMEDIATELY", NEVER: "NEVER", EVENTUALLY: "EVENTUALLY" },
      exportToBlob: async (options) => {
        calls.push(["exportPng", options]);
        if (pngFailure) throw pngFailure;
        return png;
      },
    },
    "@excalidraw/excalidraw/index.css": {},
    "@/lib/whiteboard-appearance": {
      ...appearance,
      decodeWhiteboardImage: decode ?? (async () => ({ width: imageWidth, height: imageHeight })),
    },
    "./export-gif": {
      exportWhiteboardFlowGif: async (options) => {
        calls.push(["exportGif", options]);
        if (gifFailure) throw gifFailure;
        return gif;
      },
    },
    "@/lib/diagram-payload": { parseWhiteboardDocument },
    "@/lib/diagram-drag": diagramDrag,
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    TextEncoder,
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
    requestAnimationFrame: (callback) => { callback(); return 1; },
    cancelAnimationFrame: () => {},
    document: { querySelector: () => { throw new Error("Canvas controls must not query the global document"); } },
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected canvas dependency: ${name}`);
      return dependencies[name];
    },
  });
  const ref = { current: null };
  const readiness = [];
  const rendered = exports.WhiteboardCanvas({ value: { elements: [], files: {} }, onChange, onReadyChange: (ready) => readiness.push(ready) }, ref);
  return {
    handle: ref.current, calls, files, png, gif, readiness,
    onChange: rendered.props.children.props.onChange,
    pointerDown: rendered.props.children.props.onPointerDown,
    pointerUp: rendered.props.children.props.onPointerUp,
    stageElements: (next) => { elements = next; },
  };
}

test("snapshot hydration restores validated image binaries before elements after a fresh mount", () => {
  const { handle, calls, files } = canvasHarness();
  handle.hydrate({
    elements: [imageElement],
    files: { image1: imageFile },
    appState: { collaborators: {}, selectedElementIds: { stale: true }, newElement: { id: "stale" }, editingTextElement: { id: "stale" }, isResizing: true },
  });
  assert.deepEqual(calls.map(([operation]) => operation), ["addFiles", "updateScene", "clearHistory"]);
  assert.deepEqual(plain(files.image1), imageFile);
  assert.equal(calls[1][1].appState.selectedElementIds, undefined);
  assert.equal(calls[1][1].appState.newElement, undefined);
  assert.equal(calls[1][1].appState.editingTextElement, undefined);
  assert.equal(calls[1][1].appState.isResizing, undefined);
  assert.deepEqual(plain(handle.serialize().files), { image1: imageFile });
});

test("invalid snapshot binaries fail atomically without changing the canvas", () => {
  for (const file of [
    { ...imageFile, id: "different-key" },
    { ...imageFile, dataURL: "https://example.test/customer.png" },
    { ...imageFile, mimeType: "text/html", dataURL: "data:text/html;base64,PHNjcmlwdD4=" },
    { ...imageFile, mimeType: "image/jpeg" },
    { ...imageFile, created: "yesterday" },
    { ...imageFile, dataURL: 123 },
    { ...imageFile, dataURL: "data:image/png;base64,invalid!" },
  ]) {
    const { handle, calls } = canvasHarness();
    assert.throws(() => handle.hydrate({ elements: [], files: { image1: file } }), /invalid/i);
    assert.equal(calls.length, 0);
  }
  const { handle } = canvasHarness();
  assert.throws(() => handle.hydrate(null), /invalid/i);
});

test("native PNG exports omit embedded scene metadata and use restored files", async () => {
  const { handle, calls, png } = canvasHarness();
  handle.hydrate({ elements: [imageElement], files: { image1: imageFile } });
  assert.equal(await handle.exportBlob("png"), png);
  const options = calls.find(([operation]) => operation === "exportPng")[1];
  assert.equal(options.appState.exportEmbedScene, false);
  assert.equal(options.appState.exportBackground, true);
  assert.equal(options.appState.exportWithDarkMode, false);
  assert.equal(options.appState.theme, "light");
  assert.equal(options.files.image1.dataURL, pngData);
});

test("native PNG and GIF failures propagate instead of returning fallback success", async () => {
  const failure = new Error("Native export failed");
  const { handle } = canvasHarness({ pngFailure: failure, gifFailure: failure });
  await assert.rejects(handle.exportBlob("png"), (error) => error === failure);
  await assert.rejects(handle.exportBlob("gif"), (error) => error === failure);
  assert.equal(await handle.exportBlob("svg"), null);
});

test("unready canvas rejects supported export and restore operations", async () => {
  const { handle } = canvasHarness({ ready: false });
  await assert.rejects(handle.exportBlob("png"), /not ready/);
  await assert.rejects(handle.exportBlob("gif"), /not ready/);
  assert.throws(() => handle.hydrate({ elements: [] }), /not ready/);
  assert.equal(await handle.exportBlob("svg"), null);
});

test("restoration invalidates an image still decoding on the same engine instance", async () => {
  let finish;
  const decoding = new Promise((resolve) => { finish = resolve; });
  const { handle, calls } = canvasHarness({ decode: () => decoding });
  const insertion = handle.insertImage(pngData.split(",")[1], "image/png");
  handle.hydrate({ elements: [], files: {} });
  const restoredCalls = calls.length;
  finish({ width: 1, height: 1 });
  await assert.rejects(insertion, /changed while decoding/);
  assert.equal(calls.length, restoredCalls);
  assert.deepEqual(plain(handle.serialize().elements), []);
});

test("cancelling generation during pixel decoding prevents any image or binary insertion", async () => {
  let finish;
  const decoding = new Promise((resolve) => { finish = resolve; });
  const { handle, calls } = canvasHarness({ decode: () => decoding });
  const controller = new AbortController();
  const pending = handle.insertImage(pngData.split(",")[1], "image/png", { signal: controller.signal });
  controller.abort();
  finish({ width: 1, height: 1 });
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(calls.length, 0);
});

test("invalid scene elements fail before adding files, changing elements or clearing history", () => {
  for (const element of [null, { ...imageElement, x: Infinity }, { ...imageElement, fileId: "missing" }]) {
    const { handle, calls } = canvasHarness();
    assert.throws(() => handle.hydrate({ elements: [element], files: { image1: imageFile } }), /invalid/i);
    assert.equal(calls.length, 0);
  }
});

test("unfinished scenes cannot be restored as apparently successful empty geometry", () => {
  const { handle, calls } = canvasHarness();
  assert.throws(() => handle.hydrate({ elements: [{ ...imageElement, fileId: null, status: "pending" }] }), /unfinished/);
  assert.equal(calls.length, 0);
});

test("undo, redo and delete use only this canvas's Excalidraw controls", () => {
  const { handle, calls } = canvasHarness();
  handle.undo();
  handle.redo();
  handle.deleteSelection();
  assert.deepEqual(calls, [
    ["click", ".excalidraw [aria-label='Undo']"],
    ["click", ".excalidraw [aria-label='Redo']"],
    ["click", ".excalidraw [aria-label='Delete']"],
  ]);
});

test("each custom image and symbol insertion registers files before an immediate history checkpoint", async () => {
  const { handle, calls, files } = canvasHarness();
  await handle.insertImage(pngData.split(",")[1], "image/png");
  handle.insertSvgAsset('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>', "Symbol");
  const updates = calls.filter(([operation]) => operation === "updateScene");
  assert.equal(updates.length, 2);
  assert.deepEqual(updates.map(([, scene]) => scene.captureUpdate), ["IMMEDIATELY", "IMMEDIATELY"]);
  assert.equal(updates[0][1].elements.length, 1);
  assert.equal(updates[1][1].elements.length, 2);
  assert.equal(Object.keys(files).length, 2);
  assert.deepEqual(calls.map(([operation]) => operation), ["addFiles", "updateScene", "addFiles", "updateScene"]);
});

test("malformed dragged SVG cannot register a file or mutate the scene before validation", () => {
  const { handle, calls, files } = canvasHarness();
  assert.throws(() => handle.insertSvgAsset('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "Invalid"), /Invalid Whiteboard/);
  assert.equal(calls.length, 0);
  assert.deepEqual(files, {});
});

test("decoded aspect ratio and captured request surface survive insertion and serialization", async () => {
  const canvas = { theme: "dark", backgroundColor: "#193a52", foregroundColor: "#f8fafc" };
  const { handle, calls } = canvasHarness({ imageWidth: 1536, imageHeight: 1024, state: { viewBackgroundColor: canvas.backgroundColor } });
  assert.deepEqual(plain(handle.getImageCanvasContext()), canvas);
  await handle.insertImage(pngData.split(",")[1], "image/png", { canvas });
  const element = calls.find(([operation]) => operation === "updateScene")[1].elements[0];
  assert.equal(element.width, 480);
  assert.equal(element.height, 320);
  assert.deepEqual(plain(element.customData.diagrammaticImageCanvas), canvas);
  assert.equal(Object.values(handle.serialize().files)[0].dataURL, pngData);
});

test("custom background is passed unchanged into PNG and GIF exports", async () => {
  const { handle, calls } = canvasHarness({ state: { viewBackgroundColor: "#193a52", exportWithDarkMode: true, theme: "dark" } });
  await handle.exportBlob("png");
  await handle.exportBlob("gif");
  const png = calls.find(([operation]) => operation === "exportPng")[1];
  const gif = calls.find(([operation]) => operation === "exportGif")[1];
  assert.equal(png.appState.viewBackgroundColor, "#193a52");
  assert.equal(png.appState.exportWithDarkMode, false);
  assert.equal(gif.backgroundColor, "#193a52");
  assert.equal(gif.appState.exportWithDarkMode, false);
});

test("semantic annotation waits until a live native drawing gesture finishes", () => {
  const { onChange, calls } = canvasHarness();
  const arrow = { id: "live-arrow", type: "arrow", strokeColor: "#f8fafc", width: 0, height: 0, points: [[0, 0], [0, 0]] };
  onChange([arrow], { viewBackgroundColor: "#05080d", newElement: arrow }, {});
  assert.equal(calls.length, 0, "Never replace the element referenced by the active pointer gesture");
  const completed = { ...arrow, width: 240, points: [[0, 0], [240, 0]] };
  onChange([completed], { viewBackgroundColor: "#05080d", newElement: null }, {});
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].elements[0].width, 240);
  assert.deepEqual(plain(calls[0][1].elements[0].points), [[0, 0], [240, 0]]);
  assert.equal(calls[0][1].elements[0].customData.diagrammaticForeground, "#f8fafc");
  assert.equal(calls[0][1].captureUpdate, "NEVER");
});

test("pointer callbacks protect live geometry even when an onChange snapshot lacks interaction flags", () => {
  const h = canvasHarness();
  const early = { id: "arrow", type: "arrow", x: 0, y: 0, width: 20, height: 0, points: [[0, 0], [20, 0]], strokeColor: "#f8fafc" };
  const final = { ...early, width: 240, points: [[0, 0], [240, 0]] };
  h.pointerDown();
  h.onChange([early], { viewBackgroundColor: "#05080d" }, {});
  assert.equal(h.calls.length, 0);
  assert.throws(() => h.handle.serialize(), /Finish or cancel/);
  h.stageElements([final]);
  h.pointerUp();
  const update = h.calls.find(([operation]) => operation === "updateScene");
  assert.equal(update[1].elements[0].width, 240);
  assert.deepEqual(plain(update[1].elements[0].points), final.points);
});

test("loading defaults cannot overwrite the document or foreground before native restoration completes", () => {
  const state = { isLoading: true, viewBackgroundColor: "#ffffff" };
  const changes = [];
  const h = canvasHarness({ state, onChange: (payload) => changes.push(payload) });
  h.onChange([], state, {});
  assert.equal(h.calls.length, 0);
  assert.equal(changes.length, 0);
  assert.throws(() => h.handle.serialize(), /still restoring/);
  state.isLoading = false;
  state.viewBackgroundColor = "#05080d";
  h.onChange([], state, {});
  assert.deepEqual(h.readiness, [true]);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].appState.viewBackgroundColor, "#05080d");
  assert.equal(changes[0].appState.isLoading, undefined);
});
