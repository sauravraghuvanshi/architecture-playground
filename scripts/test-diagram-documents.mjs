import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { parseArchitectureDocument, hasArchitectureContent } from "../lib/architecture-document.ts";
import { parseDiagramPayload } from "../lib/diagram-payload.ts";
import { DiagramLibraryError, validateDiagramRecord } from "../lib/diagram-library.ts";

const source = readFileSync(new URL("../components/diagrammatic/shared/useDiagramDocuments.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const graph = (count = 1) => ({
  nodes: Array.from({ length: count }, (_, index) => ({
    kind: "shape", id: `node-${index}`, label: `Node ${index}`, shape: "rectangle", x: index * 10, y: 0,
  })),
  edges: [],
});
const document = (id = "original", overrides = {}) => ({
  schemaVersion: 1, id, name: id, mode: "architecture", payload: graph(), canvasTheme: "light",
  comments: [], versions: [], createdAt: 1, updatedAt: 1, revision: 1, ...overrides,
});
const comment = { id: "c1", body: "Added during save", author: "Architect", createdAt: 2 };
const version = { id: "v1", label: "Added during save", payload: graph(), createdAt: 2 };

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

// Deterministic hook lifecycle with real effect dependency/cleanup semantics.
// Only React scheduling, browser storage, and the IndexedDB boundary are stubbed.
function harness({ records = [document()], active = { architecture: "original" }, applyFailure, options: initialOptions = {} } = {}) {
  const stored = new Map(records.map((record) => [record.id, structuredClone(record)]));
  const local = new Map([["diagrammatic.active-documents", JSON.stringify(active)]]);
  const canvases = { architecture: graph(), whiteboard: { elements: [] } };
  const calls = [];
  const errors = [];
  const applyEvents = [];
  const timers = new Map();
  const slots = [];
  let effects = [];
  let hookIndex = 0;
  let nextId = 0;
  let nextTimer = 0;
  let dirty = true;
  let output;
  let nextSaveBarrier;
  let nextSaveFailure;
  let options;
  const same = (before, after) => before !== undefined && after !== undefined &&
    before.length === after.length && before.every((value, index) => Object.is(value, after[index]));
  const react = {
    useState(initial) {
      const index = hookIndex++;
      slots[index] ??= { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, (next) => {
        const value = typeof next === "function" ? next(slots[index].value) : next;
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; }
      }];
    },
    useRef(initial) {
      const index = hookIndex++;
      slots[index] ??= { current: initial };
      return slots[index];
    },
    useCallback(callback, dependencies) {
      const index = hookIndex++;
      if (!slots[index] || !same(slots[index].dependencies, dependencies)) slots[index] = { callback, dependencies };
      return slots[index].callback;
    },
    useEffect(effect, dependencies) {
      const index = hookIndex++;
      if (!slots[index] || !same(slots[index].dependencies, dependencies)) {
        const cleanup = slots[index]?.cleanup;
        slots[index] = { dependencies, cleanup };
        effects.push(() => { cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
  };
  const library = {
    validateDiagramRecord,
    listDiagrams: async () => [...stored.values()].map((record) => structuredClone(record)),
    getDiagram: async (id) => {
      const record = stored.get(id);
      if (!record) throw new DiagramLibraryError("not-found", "Missing diagram");
      return structuredClone(record);
    },
    saveDiagram: async (input) => {
      const captured = structuredClone(input);
      calls.push(captured);
      const barrier = nextSaveBarrier;
      nextSaveBarrier = undefined;
      if (barrier) await barrier.promise;
      if (nextSaveFailure) {
        const error = nextSaveFailure;
        nextSaveFailure = undefined;
        throw error;
      }
      const previous = input.id ? stored.get(input.id) : undefined;
      if (input.id && (!previous || previous.revision !== input.expectedRevision)) {
        throw new DiagramLibraryError("conflict", "The document changed in another tab.");
      }
      const saved = validateDiagramRecord({
        schemaVersion: 1, id: previous?.id ?? `copy-${++nextId}`,
        ...captured, comments: captured.comments ?? previous?.comments ?? [],
        versions: captured.versions ?? previous?.versions ?? [],
        createdAt: previous?.createdAt ?? 2, updatedAt: (previous?.updatedAt ?? 1) + 1,
        revision: (previous?.revision ?? 0) + 1,
      });
      stored.set(saved.id, structuredClone(saved));
      return saved;
    },
  };
  options = {
    mode: "architecture", revision: 0, externalSeed: false, suspended: false,
    capture: (mode) => canvases[mode] ?? { nodes: [], edges: [] },
    theme: () => "light",
    apply: (record) => {
      applyEvents.push({ id: record.id, active: JSON.parse(local.get("diagrammatic.active-documents")) });
      if (record.mode === "architecture") parseArchitectureDocument(record.payload);
      if (applyFailure?.(record)) throw new Error("Canvas hydration failed");
      canvases[record.mode] = structuredClone(record.payload);
    },
    onError: (message) => errors.push(message),
    ...initialOptions,
  };
  const dependencies = {
    react,
    "@/lib/diagram-library": library,
    "@/lib/architecture-document": { parseArchitectureDocument, hasArchitectureContent },
    "@/lib/diagram-payload": { parseDiagramPayload },
    "./types": { MODE_META: { architecture: { label: "Architecture" }, whiteboard: { label: "Whiteboard" } } },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    localStorage: {
      getItem: (key) => local.get(key) ?? null,
      setItem: (key, value) => local.set(key, value),
    },
    setTimeout: (callback) => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout: (id) => timers.delete(id),
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected hook dependency: ${name}`);
      return dependencies[name];
    },
  });
  function render() {
    hookIndex = 0;
    effects = [];
    dirty = false;
    output = exports.useDiagramDocuments(options);
    for (const effect of effects) effect();
  }
  async function flush() {
    for (let index = 0; index < 40; index++) {
      if (dirty) render();
      await Promise.resolve();
    }
  }
  return {
    get current() { return output; },
    stored, local, canvases, calls, errors, applyEvents,
    flush,
    configure(next) { options = { ...options, ...next }; dirty = true; },
    deferSave() { nextSaveBarrier = deferred(); return nextSaveBarrier; },
    failSave(error) { nextSaveFailure = error; },
    async autosave() {
      const callbacks = [...timers.values()];
      timers.clear();
      callbacks.forEach((callback) => callback());
      await flush();
    },
    timerCount: () => timers.size,
  };
}

test("failed initialization never activates or autosaves an oversized saved architecture", async () => {
  const invalid = document("oversized", { payload: graph(501) });
  const h = harness({ records: [invalid], active: { architecture: invalid.id } });
  await h.flush();
  assert.equal(h.current.ready, true);
  assert.equal(h.current.documents.architecture, undefined);
  assert.deepEqual(JSON.parse(h.local.get("diagrammatic.active-documents")), {});
  assert.equal(h.errors.length, 1);
  await h.autosave();
  assert.equal(h.calls.length, 0);
  assert.equal(h.stored.get(invalid.id).payload.nodes.length, 501);
});

test("initialization applies documents before publishing new active identity", async () => {
  const selected = document("selected");
  const h = harness({ records: [selected], active: {}, options: { requestedId: selected.id } });
  await h.flush();
  assert.deepEqual(h.applyEvents[0], { id: selected.id, active: {} });
  assert.equal(h.current.documents.architecture.id, selected.id);
  assert.equal(JSON.parse(h.local.get("diagrammatic.active-documents")).architecture, selected.id);
});

test("one failed initial hydration does not assign its ID or discard a valid other mode", async () => {
  const invalid = document("oversized", { payload: graph(501) });
  const board = document("board", { mode: "whiteboard", payload: { elements: [] } });
  const h = harness({ records: [invalid, board], active: { architecture: invalid.id, whiteboard: board.id } });
  await h.flush();
  assert.equal(h.current.documents.architecture, undefined);
  assert.equal(h.current.documents.whiteboard.id, board.id);
  assert.deepEqual(JSON.parse(h.local.get("diagrammatic.active-documents")), { whiteboard: board.id });
  assert.equal(h.stored.get(invalid.id).revision, 1);
});

test("capture rejects oversized architecture in manual save, autosave and recovery copy", async () => {
  const h = harness();
  await h.flush();
  h.canvases.architecture = graph(501);
  await assert.rejects(h.current.save());
  await h.flush();
  await assert.rejects(h.current.saveCopy());
  await h.flush();
  await h.autosave();
  assert.equal(h.calls.length, 0);
  assert.equal(h.stored.get("original").payload.nodes.length, 1);
  assert.ok(h.errors.some((message) => message.includes("autosave failed")));
});

test("corrupt Whiteboard recovery never activates or rewrites the retained scene", async () => {
  const payload = { elements: [{ id: "bad", type: "rectangle", x: "invalid", y: 0, width: 30, height: 20 }] };
  const saved = document("broken-board", { mode: "whiteboard", payload });
  const h = harness({ records: [saved], active: { whiteboard: saved.id }, options: { mode: "whiteboard" } });
  await h.flush();
  assert.equal(h.current.ready, true);
  assert.equal(h.current.documents.whiteboard, undefined);
  assert.equal(h.current.blockedDrafts.whiteboard, true);
  assert.equal(h.current.recoveryIssues.length, 1);
  await h.autosave();
  assert.equal(h.calls.length, 0);
  assert.deepEqual(h.stored.get(saved.id).payload, payload);
});

test("invalid Whiteboard creation fails before saving or activating any document", async () => {
  const h = harness();
  await h.flush();
  const initialApplications = h.applyEvents.length;
  await assert.rejects(h.current.create("whiteboard", "Broken", { elements: [null] }), /invalid/i);
  assert.equal(h.calls.length, 0);
  assert.equal(h.applyEvents.length, initialApplications);
  assert.equal(h.current.documents.architecture.id, "original");
});

for (const operation of ["manual save", "autosave"]) {
  test(`${operation} preserves comments and versions added during pending persistence`, async () => {
    const h = harness();
    await h.flush();
    h.canvases.architecture = graph(2);
    const barrier = h.deferSave();
    const saving = operation === "manual save" ? h.current.save() : h.autosave();
    await h.flush();
    assert.equal(h.calls.length, 1);
    h.current.annotate({ comments: [comment] });
    h.current.annotate({ versions: [version] });
    h.configure({ revision: 1 });
    await h.flush();
    barrier.resolve();
    await saving;
    await h.flush();
    assert.deepEqual(structuredClone(h.current.documents.architecture.comments), [comment]);
    assert.deepEqual(structuredClone(h.current.documents.architecture.versions), [version]);
    assert.equal(h.current.documents.architecture.revision, 2);
    assert.equal(h.current.saved, false);
    await h.autosave();
    assert.deepEqual(h.stored.get("original").comments, [comment]);
    assert.deepEqual(h.stored.get("original").versions, [version]);
    assert.equal(h.stored.get("original").revision, 3);
    assert.equal(h.current.saved, true);
    await h.autosave();
    assert.equal(h.calls.length, 2, "Advancing UI storage revision must not cause endless autosaves");
  });
}

test("failed open leaves the target document unassigned and its payload untouched", async () => {
  const invalid = document("broken", { payload: graph(501) });
  const h = harness({ records: [document(), invalid] });
  await h.flush();
  await assert.rejects(h.current.open(invalid));
  await h.flush();
  assert.equal(h.current.documents.architecture.id, "original");
  assert.equal(h.current.documents.architecture.revision, 2);
  assert.equal(JSON.parse(h.local.get("diagrammatic.active-documents")).architecture, "original");
  assert.equal(h.stored.get("broken").revision, 1);
  assert.equal(h.stored.get("broken").payload.nodes.length, 501);
  assert.equal(h.applyEvents.some((entry) => entry.id === "broken"), false, "Invalid payload must be rejected before calling the canvas");
});

test("failed create hydration cannot activate the newly saved document", async () => {
  const h = harness({ applyFailure: (record) => record.name === "New diagram" });
  await h.flush();
  await assert.rejects(h.current.create("architecture", "New diagram", graph()), /hydration failed/);
  await h.flush();
  assert.equal(h.current.documents.architecture.id, "original");
  assert.equal(h.current.documents.architecture.revision, 2);
  const created = [...h.stored.values()].find((entry) => entry.name === "New diagram");
  assert.ok(created);
  assert.notEqual(JSON.parse(h.local.get("diagrammatic.active-documents")).architecture, created.id);
  assert.notEqual(h.applyEvents.find((entry) => entry.id === created.id).active.architecture, created.id);
});

test("successful open and create publish identity only after applying the new canvas", async () => {
  const selected = document("selected", { payload: graph(2) });
  const h = harness({ records: [document(), selected] });
  await h.flush();
  await h.current.open(selected);
  await h.flush();
  assert.equal(h.applyEvents.find((entry) => entry.id === selected.id).active.architecture, "original");
  assert.equal(h.current.documents.architecture.id, selected.id);
  await h.current.create("architecture", "New diagram", graph(3));
  await h.flush();
  const created = h.current.documents.architecture;
  assert.equal(h.applyEvents.find((entry) => entry.id === created.id).active.architecture, selected.id);
  assert.equal(h.canvases.architecture.nodes.length, 3);
});

test("saveCopy bypasses a stale document revision and preserves its remote saved content", async () => {
  const h = harness();
  await h.flush();
  h.stored.set("original", document("original", { name: "Remote update", revision: 9, payload: graph(2) }));
  h.canvases.architecture = graph(3);
  h.current.annotate({ comments: [comment] });
  h.current.annotate({ versions: [version] });
  await h.flush();
  await assert.rejects(h.current.save(), { code: "conflict" });
  await h.flush();
  const before = structuredClone(h.stored.get("original"));
  const callsBefore = h.calls.length;
  const copy = await h.current.saveCopy("Recovery copy");
  await h.flush();
  assert.equal(h.calls.length, callsBefore + 1);
  assert.equal("id" in h.calls.at(-1), false);
  assert.equal("expectedRevision" in h.calls.at(-1), false);
  assert.notEqual(copy.id, "original");
  assert.equal(copy.name, "Recovery copy");
  assert.equal(copy.payload.nodes.length, 3);
  assert.deepEqual(structuredClone(copy.comments), [comment]);
  assert.deepEqual(structuredClone(copy.versions), [version]);
  assert.deepEqual(h.stored.get("original"), before);
  assert.equal(h.current.documents.architecture.id, copy.id);
  assert.equal(JSON.parse(h.local.get("diagrammatic.active-documents")).architecture, copy.id);
});

test("failed saveCopy does not change active identity and allows a later retry", async () => {
  const h = harness();
  await h.flush();
  h.failSave(new DiagramLibraryError("quota", "Storage full"));
  await assert.rejects(h.current.saveCopy(), { code: "quota" });
  await h.flush();
  assert.equal(h.current.documents.architecture.id, "original");
  assert.equal(h.current.busy, false);
  const copy = await h.current.saveCopy();
  await h.flush();
  assert.equal(copy.name, "original (copy)");
  assert.equal(h.current.documents.architecture.id, copy.id);
});

test("saveCopy retains annotations added during its write and schedules their persistence", async () => {
  const h = harness();
  await h.flush();
  const barrier = h.deferSave();
  const saving = h.current.saveCopy("Copy");
  await h.flush();
  h.current.annotate({ comments: [comment] });
  h.current.annotate({ versions: [version] });
  await h.flush();
  barrier.resolve();
  const copy = await saving;
  await h.flush();
  assert.deepEqual(structuredClone(h.current.documents.architecture.comments), [comment]);
  assert.deepEqual(structuredClone(h.current.documents.architecture.versions), [version]);
  assert.equal(h.current.saved, false);
  await h.autosave();
  assert.deepEqual(h.stored.get(copy.id).comments, [comment]);
  assert.deepEqual(h.stored.get(copy.id).versions, [version]);
});

test("rename completion also retains working annotations while advancing the revision", async () => {
  const h = harness();
  await h.flush();
  h.current.annotate({ comments: [comment] });
  h.current.annotate({ versions: [version] });
  h.current.renamed(document("original", { name: "Renamed", revision: 2 }));
  await h.flush();
  assert.equal(h.current.documents.architecture.name, "Renamed");
  assert.equal(h.current.documents.architecture.revision, 2);
  assert.deepEqual(structuredClone(h.current.documents.architecture.comments), [comment]);
  assert.deepEqual(structuredClone(h.current.documents.architecture.versions), [version]);
});

test("a malformed unrelated draft does not block a healthy named architecture", async () => {
  const h = harness();
  h.local.set("diagrammatic.draft.whiteboard", "{broken");
  await h.flush();
  assert.equal(h.current.ready, true);
  assert.equal(h.current.documents.architecture.id, "original");
  assert.equal(h.canvases.architecture.nodes.length, 1);
  assert.equal(h.local.get("diagrammatic.draft.whiteboard"), "{broken");
  assert.equal(h.current.blockedDrafts.whiteboard, true);
  assert.ok(h.errors.some((message) => message.includes("Whiteboard")));
});

test("an unreadable active document does not prevent another mode or an explicit selection loading", async () => {
  const selected = document("selected");
  const board = document("board", { mode: "whiteboard", payload: { elements: [] } });
  const h = harness({
    records: [selected, board], active: { architecture: "missing", whiteboard: board.id },
    options: { requestedId: selected.id },
  });
  await h.flush();
  assert.equal(h.current.documents.architecture.id, selected.id);
  assert.equal(h.current.documents.whiteboard.id, board.id);
  assert.ok(h.errors.some((message) => message.includes("Architecture")));
});

test("invalid legacy architecture is rejected before creating a recovered document", async () => {
  const h = harness({ records: [], active: {} });
  const raw = JSON.stringify({ payload: graph(501), savedAt: 1 });
  h.local.set("diagrammatic.draft", raw);
  await h.flush();
  assert.equal(h.calls.length, 0);
  assert.equal(h.stored.size, 0);
  assert.equal(h.local.get("diagrammatic.draft"), raw);
  assert.equal(h.current.blockedDrafts.architecture, true);
});

test("one malformed legacy annotation does not discard the other annotation collection", async () => {
  const h = harness({ records: [], active: {} });
  h.local.set("diagrammatic.draft", JSON.stringify({ payload: graph(), savedAt: 1 }));
  h.local.set("diagrammatic.comments.architecture:draft", "{broken");
  h.local.set("diagrammatic.versions.architecture:draft", JSON.stringify([version]));
  await h.flush();
  assert.equal(h.current.documents.architecture.payload.nodes.length, 1);
  assert.deepEqual(structuredClone(h.current.documents.architecture.versions), [version]);
  assert.deepEqual(structuredClone(h.current.documents.architecture.comments), []);
  assert.equal(h.local.get("diagrammatic.comments.architecture:draft"), "{broken");
  assert.ok(h.errors.some((message) => message.includes("comments")));
});

test("unchanged canvas notifications do not advance the persisted revision or cause tab conflicts", async () => {
  const h = harness();
  await h.flush();
  assert.equal(h.current.hasPendingChanges(), false);
  h.configure({ revision: 1 });
  await h.flush();
  await h.autosave();
  assert.equal(h.calls.length, 0);
  assert.equal(h.current.saved, true);
  h.canvases.architecture = graph(2);
  assert.equal(h.current.hasPendingChanges(), true);
  await h.current.save();
  await h.flush();
  assert.equal(h.current.hasPendingChanges(), false);
  h.current.annotate({ comments: [comment] });
  await h.flush();
  assert.equal(h.current.hasPendingChanges(), true);
});

test("empty versioned scratch does not resurrect a deleted document, but context and annotations are preserved", async () => {
  for (const variant of ["empty", "context", "comments"]) {
    const h = harness({ records: [], active: {} });
    const payload = { schemaVersion: 1, ...graph(0), ...(variant === "context" ? { metadata: { designIntent: "Capture intent before drawing." } } : {}) };
    const raw = JSON.stringify({ mode: "architecture", savedAt: 100, payload });
    h.local.set("diagrammatic.draft", raw);
    if (variant === "comments") h.local.set("diagrammatic.comments.architecture:draft", JSON.stringify([comment]));
    await h.flush();
    assert.equal(h.calls.length, variant === "empty" ? 0 : 1);
    assert.equal(h.local.get("diagrammatic.draft"), raw, "never delete the recoverable source during migration");
    if (variant === "context") assert.deepEqual(h.current.documents.architecture.payload.metadata, payload.metadata);
    if (variant === "comments") assert.deepEqual(structuredClone(h.current.documents.architecture.comments), [comment]);
  }
});
