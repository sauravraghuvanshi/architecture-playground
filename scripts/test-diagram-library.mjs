import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as library from "../lib/diagram-library.ts";

const record = {
  schemaVersion: 1, id: "diagram-1", name: "Customer baseline", mode: "whiteboard",
  payload: { elements: [{ id: "image-1", type: "image" }], files: { image: { dataURL: "data:image/png;base64,aW1hZ2U=" } } },
  canvasTheme: "dark",
  comments: [{ id: "c1", body: "Keep the customer note", author: "Architect", createdAt: 10 }],
  versions: [{ id: "v1", label: "Baseline", payload: { elements: [] }, createdAt: 15 }],
  createdAt: 10, updatedAt: 20, revision: 1,
};

test("library validates mode-agnostic documents without losing binary or collaboration metadata", () => {
  for (const mode of ["architecture", "flowchart", "mindmap", "sequence", "er", "uml", "whiteboard", "kanban", "c4"]) {
    assert.deepEqual(library.validateDiagramRecord({ ...record, mode }), { ...record, mode });
  }
});

test("library summaries omit large payloads and retain counts for efficient listing", () => {
  const summary = library.summarizeDiagram(record);
  assert.equal(summary.commentCount, 1);
  assert.equal(summary.versionCount, 1);
  assert.equal("payload" in summary, false);
  assert.equal("comments" in summary, false);
  assert.equal("versions" in summary, false);
  assert.equal(summary.revision, 1);
});

test("library names and records reject malformed input with explicit typed errors", () => {
  assert.equal(library.normalizeDiagramName("  workshop  "), "workshop");
  for (const name of [null, 42, "", " ", "x".repeat(201)]) {
    assert.throws(() => library.normalizeDiagramName(name), { name: "DiagramLibraryError", code: "invalid" });
  }
  for (const change of [
    { schemaVersion: 2 }, { id: "../other" }, { mode: "unsupported" }, { canvasTheme: "pink" },
    { createdAt: -1 }, { updatedAt: 5 }, { revision: 0 }, { payload: null },
    { comments: {} }, { versions: [{ ...record.versions[0], payload: undefined }] },
    { comments: [record.comments[0], record.comments[0]] },
    { versions: [record.versions[0], record.versions[0]] },
  ]) {
    assert.throws(() => library.validateDiagramRecord({ ...record, ...change }), { code: "invalid" });
  }
});

test("library search is case-insensitive, searches modes, and orders copies newest first", () => {
  const first = library.summarizeDiagram(record);
  const second = { ...first, id: "diagram-2", name: "API design", mode: "architecture", updatedAt: 30 };
  const input = [first, second];
  assert.deepEqual(library.filterDiagramSummaries(input, "  WHITEBOARD "), [first]);
  assert.deepEqual(library.filterDiagramSummaries(input, "api"), [second]);
  assert.deepEqual(library.filterDiagramSummaries(input), [second, first]);
  assert.deepEqual(input, [first, second]);
});

test("library rejects unavailable storage instead of falling back to localStorage or downloads", async () => {
  const input = { name: "Test", mode: "architecture", payload: { nodes: [], edges: [] }, canvasTheme: "light" };
  await assert.rejects(library.listDiagrams(), { code: "unavailable" });
  await assert.rejects(library.loadDiagram("missing"), { code: "unavailable" });
  await assert.rejects(library.saveDiagram(input), { code: "unavailable" });
  await assert.rejects(library.renameDiagram("missing", "Renamed"), { code: "unavailable" });
  await assert.rejects(library.deleteDiagram("missing"), { code: "unavailable" });
  await assert.rejects(library.saveDiagram({ ...input, payload: { runtime: () => {} } }), { code: "invalid" });
  await assert.rejects(library.saveDiagram(null), { code: "invalid" });
});

test("library modal explains browser-local storage and exposes explicit save/new/search controls", () => {
  const source = readFileSync(new URL("../components/diagrammatic/shared/DiagramLibraryModal.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  const icons = Object.fromEntries(["Check", "FilePlus2", "FolderOpen", "Loader2", "Pencil", "RefreshCw", "Save", "Search", "Trash2", "X"].map((key) => [key, () => null]));
  const dependencies = {
    react: React, "react/jsx-runtime": jsxRuntime, "lucide-react": icons,
    "react-dom": { createPortal: (children) => children },
    "./useDialogFocus": { useDialogFocus: () => ({ current: null }) },
    "@/lib/diagram-library": library,
    "./types": { MODE_META: { architecture: { label: "Cloud Architecture" }, whiteboard: { label: "Whiteboard" } } },
  };
  vm.runInNewContext(compiled, {
    exports,
    document: { body: {} },
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected modal dependency: ${name}`);
      return dependencies[name];
    },
  });
  let actionCalled = false;
  const props = {
    open: true, onClose: () => {}, onOpen: () => { actionCalled = true; },
    onSave: async () => { actionCalled = true; },
    onNew: async () => { actionCalled = true; },
  };
  const html = renderToStaticMarkup(React.createElement(exports.default, props));
  assert.match(html, /Saved diagrams/);
  assert.match(html, /No account sync or cloud backup/);
  assert.match(html, /Save current diagram/);
  assert.match(html, /Create blank diagram/);
  assert.match(html, /Search saved diagrams/);
  assert.match(html, /Existing drafts are recovered without deleting their original data/);
  assert.equal(renderToStaticMarkup(React.createElement(exports.default, { ...props, open: false })), "");
  assert.equal(actionCalled, false);
});
