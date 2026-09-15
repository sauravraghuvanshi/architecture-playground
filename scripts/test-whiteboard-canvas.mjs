import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

const source = readFileSync(new URL("../components/diagrammatic/modes/whiteboard/Canvas.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const pngData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=";
const imageFile = { id: "image1", mimeType: "image/png", dataURL: pngData, created: 1, lastRetrieved: 2, version: 1 };
const plain = (value) => JSON.parse(JSON.stringify(value));

// Stub the drawing engine and hook lifecycle, but execute the actual canvas handle implementation.
function canvasHarness({ ready = true, pngFailure, gifFailure } = {}) {
  const calls = [];
  const files = {};
  let elements = [];
  const png = new Blob(["png"], { type: "image/png" });
  const gif = new Blob(["gif"], { type: "image/gif" });
  const api = {
    getFiles: () => files,
    getSceneElements: () => elements,
    getAppState: () => ({ exportEmbedScene: true }),
    addFiles: (added) => {
      calls.push(["addFiles", added]);
      for (const file of added) files[file.id] = file;
    },
    updateScene: (scene) => {
      calls.push(["updateScene", scene]);
      elements = scene.elements;
      for (const element of elements) {
        if (element.type === "image") assert.ok(files[element.fileId], "Image binaries must exist before scene restoration");
      }
    },
    history: { clear: () => calls.push(["clearHistory"]) },
  };
  const wrapper = { querySelector: (selector) => ({ click: () => calls.push(["click", selector]) }) };
  let refIndex = 0;
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
      convertToExcalidrawElements: (value) => value,
      exportToBlob: async (options) => {
        calls.push(["exportPng", options]);
        if (pngFailure) throw pngFailure;
        return png;
      },
    },
    "@excalidraw/excalidraw/index.css": {},
    "./export-gif": {
      exportWhiteboardFlowGif: async (options) => {
        calls.push(["exportGif", options]);
        if (gifFailure) throw gifFailure;
        return gif;
      },
    },
    zod: { z },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    document: { querySelector: () => { throw new Error("Canvas controls must not query the global document"); } },
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected canvas dependency: ${name}`);
      return dependencies[name];
    },
  });
  const ref = { current: null };
  exports.WhiteboardCanvas({ value: { elements: [], files: {} } }, ref);
  return { handle: ref.current, calls, files, png, gif };
}

test("snapshot hydration restores validated image binaries before elements after a fresh mount", () => {
  const { handle, calls, files } = canvasHarness();
  handle.hydrate({
    elements: [{ id: "drawing1", type: "image", fileId: "image1" }],
    files: { image1: imageFile },
    appState: { collaborators: {}, selectedElementIds: { stale: true } },
  });
  assert.deepEqual(calls.map(([operation]) => operation), ["addFiles", "updateScene", "clearHistory"]);
  assert.deepEqual(plain(files.image1), imageFile);
  assert.equal(calls[1][1].appState.selectedElementIds, undefined);
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
    assert.throws(() => handle.hydrate({ elements: [], files: { image1: file } }), /invalid/);
    assert.equal(calls.length, 0);
  }
  const { handle } = canvasHarness();
  assert.throws(() => handle.hydrate(null), /invalid/);
});

test("native PNG exports omit embedded scene metadata and use restored files", async () => {
  const { handle, calls, png } = canvasHarness();
  handle.hydrate({ elements: [{ type: "image", fileId: "image1" }], files: { image1: imageFile } });
  assert.equal(await handle.exportBlob("png"), png);
  const options = calls.find(([operation]) => operation === "exportPng")[1];
  assert.equal(options.appState.exportEmbedScene, false);
  assert.equal(options.appState.exportBackground, true);
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
