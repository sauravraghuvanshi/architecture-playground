import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

const cache = new Map();
function load(relative, parent = new URL("../components/playground/lib/", import.meta.url)) {
  const url = new URL(relative.endsWith(".ts") ? relative : `${relative}.ts`, parent);
  if (cache.has(url.href)) return cache.get(url.href);
  const exports = {};
  cache.set(url.href, exports);
  const compiled = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (name === "zod") return { z };
      if (name.startsWith(".")) return load(name, url);
      throw new Error(`Unexpected graph module dependency: ${name}`);
    },
  });
  return exports;
}
const { validateImportedGraph } = load("validate");
const { applyAutoSequence } = load("sequence");
const { resolveTemplate } = load("template-engine");
const { PLAYGROUND_LIMITS } = load("types");
const group = (id, parentId) => ({ id, type: "group", position: { x: 0, y: 0 }, data: { label: id, variant: "custom" }, width: 600, height: 400, ...(parentId ? { parentId } : {}) });
const note = (id, parentId) => ({ id, type: "sticky", position: { x: 30.5, y: 40.25 }, data: { label: id }, ...(parentId ? { parentId } : {}) });
const validate = (graph) => validateImportedGraph(graph, [], { strictIcons: false });

test("102-node and 200-node auto-sequences remain valid on export/import", () => {
  for (const count of [102, 200]) {
    const graph = {
      nodes: Array.from({ length: count }, (_, i) => ({ ...note(`n${i}`), position: { x: i * 100, y: 0 } })),
      edges: Array.from({ length: count - 1 }, (_, i) => ({ id: `e${i}`, source: `n${i}`, target: `n${i + 1}`, sourceHandle: "bottom", targetHandle: "left" })),
    };
    assert.equal(validate(graph).ok, true);
    const sequenced = applyAutoSequence(graph);
    assert.equal(sequenced.ok, true);
    const imported = validate(JSON.parse(JSON.stringify(sequenced.graph)));
    assert.equal(imported.ok, true, imported.errors?.join("; "));
    assert.equal(imported.graph.edges.at(-1).data.step, count - 1);
    assert.equal(imported.graph.edges.at(-1).sourceHandle, "bottom");
  }
});

test("legacy imports reject missing, non-group, self and cyclic containment", () => {
  for (const nodes of [
    [note("orphan", "missing")],
    [note("not-group"), note("child", "not-group")],
    [group("self", "self")],
    [group("a", "b"), group("b", "a")],
  ]) {
    const result = validate({ nodes, edges: [] });
    assert.equal(result.ok, false);
    assert.ok(result.errors?.length);
  }
});

test("legacy sequence bounds match the shared UI limit without accepting invalid stages", () => {
  const edge = { id: "e", source: "a", target: "b", data: { step: PLAYGROUND_LIMITS.sequenceStep } };
  assert.equal(validate({ nodes: [note("a"), note("b")], edges: [edge] }).ok, true);
  for (const step of [0, 1.5, PLAYGROUND_LIMITS.sequenceStep + 1]) {
    assert.equal(validate({ nodes: [note("a"), note("b")], edges: [{ ...edge, data: { step } }] }).ok, false);
  }
});

test("legacy imports preserve valid nested hierarchy and positive fractional geometry", () => {
  const graph = { nodes: [group("root"), group("nested", "root"), { ...note("child", "nested"), width: 100.5, height: 50.25 }], edges: [] };
  const result = validate(graph);
  assert.equal(result.ok, true);
  assert.equal(result.graph.nodes[2].parentId, "nested");
  assert.equal(result.graph.nodes[2].width, 100.5);
  for (const width of [0, -10]) assert.equal(validate({ nodes: [{ ...note("bad"), width }], edges: [] }).ok, false);
});

test("out-of-order nested legacy groups are loaded parent-first without moving their children", () => {
  const result = validate({ nodes: [note("child", "nested"), group("nested", "root"), group("root")], edges: [] });
  assert.equal(result.ok, true);
  assert.deepEqual(Array.from(result.graph.nodes, (node) => node.id), ["root", "nested", "child"]);
  assert.equal(result.graph.nodes[2].position.x, 30.5);
  assert.equal(result.graph.nodes[2].position.y, 40.25);
});

test("duplicate legacy edge IDs are reported rather than silently omitted", () => {
  const edge = { id: "duplicate", source: "a", target: "b" };
  const result = validate({ nodes: [note("a"), note("b")], edges: [edge, edge] });
  assert.ok(result.errors?.some((error) => error.includes("duplicate edge")));
});

test("filtering a template group cascades to descendants and their edges", () => {
  const template = {
    id: "conditional", name: "Conditional group", description: "", cloud: "azure",
    parameters: [{ id: "include", label: "Include", type: "boolean", default: false }],
    graph: {
      nodes: [{ ...group("parent"), _when: { include: true } }, group("nested", "parent"), note("child", "nested"), note("outside")],
      edges: [{ id: "edge", source: "child", target: "outside" }],
    },
  };
  const filtered = resolveTemplate(template);
  assert.deepEqual(Array.from(filtered.nodes, (node) => node.id), ["outside"]);
  assert.equal(filtered.edges.length, 0);
  assert.equal(resolveTemplate(template, { include: true }).nodes.length, 4);
});

test("invalid template containment is rejected before it can replace a graph", () => {
  assert.throws(() => resolveTemplate({
    id: "invalid", name: "Invalid", description: "", cloud: "azure",
    graph: { nodes: [group("self", "self")], edges: [] },
  }), /hierarchy|cycle|parent/i);
});

test("every bundled template resolves to valid hierarchy and importable geometry", () => {
  const directory = new URL("../content/playground-templates/", import.meta.url);
  const files = readdirSync(directory).filter((file) => file.endsWith(".json"));
  assert.equal(files.length, 16);
  for (const file of files) {
    const graph = resolveTemplate(JSON.parse(readFileSync(new URL(file, directory), "utf8")));
    const result = validate(graph);
    assert.equal(result.ok, true, `${file}: ${result.errors?.join("; ")}`);
  }
});
