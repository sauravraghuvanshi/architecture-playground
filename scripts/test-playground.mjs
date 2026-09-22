// Exercise production modules directly with Node's native TypeScript support.
// Run: node --test scripts/test-playground.mjs (also in npm run test:playground).
import test from "node:test";
import assert from "node:assert/strict";
import {
  HISTORY_LIMIT, canRedo, canUndo, historyReducer, initialHistory, snapshotGraph,
} from "../components/playground/lib/history.ts";
import {
  applyAutoSequence, autoSequenceFromTopology, normalizeSequence,
} from "../components/playground/lib/sequence.ts";
import { migrateGraph, migratePayload, normalizeGraph } from "../components/playground/lib/migrations.ts";
import {
  ServiceRegistry, createServiceRegistry, getServiceRegistry,
} from "../components/playground/lib/service-registry.ts";
import { CURRENT_SCHEMA_VERSION, DEFAULT_LAYER } from "../components/playground/lib/types.ts";

function deepFreeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

// ---------- Tests ----------

test("history: snapshots preserve graph data independently of later edits", () => {
  const graph = {
    nodes: [{ id: "a", position: { x: 10, y: 20 }, data: { label: "Original" } }],
    edges: [],
    layers: [{ ...DEFAULT_LAYER }],
    metadata: { name: "Diagram" },
  };
  const expected = structuredClone(graph);
  const snapshot = snapshotGraph(graph);
  const state = initialHistory(graph);
  graph.nodes[0].data.label = "Edited";
  assert.deepEqual(JSON.parse(snapshot), expected);
  assert.deepEqual(state, { past: [], present: snapshot, future: [] });
});

test("history: push then undo restores previous", () => {
  const h0 = initialHistory({ nodes: [], edges: [] });
  const h1 = historyReducer(h0, { type: "push", snapshot: '{"nodes":[1],"edges":[]}' });
  const h2 = historyReducer(h1, { type: "undo" });
  assert.equal(h2.present, h0.present);
  assert.equal(h2.future.length, 1);
});

test("history: redo replays after undo", () => {
  const h0 = initialHistory({ nodes: [], edges: [] });
  const h1 = historyReducer(h0, { type: "push", snapshot: "A" });
  const h2 = historyReducer(h1, { type: "undo" });
  const h3 = historyReducer(h2, { type: "redo" });
  assert.equal(h3.present, "A");
});

test("history: push truncates redo tail", () => {
  let h = initialHistory({ nodes: [], edges: [] });
  h = historyReducer(h, { type: "push", snapshot: "A" });
  h = historyReducer(h, { type: "undo" });
  h = historyReducer(h, { type: "push", snapshot: "B" });
  assert.equal(h.future.length, 0);
  assert.equal(h.present, "B");
});

test("history: dedupes identical consecutive snapshots", () => {
  let h = initialHistory({ nodes: [], edges: [] });
  h = historyReducer(h, { type: "push", snapshot: "A" });
  assert.equal(historyReducer(h, { type: "push", snapshot: "A" }), h);
  assert.equal(h.past.length, 1);
});

test("history: caps at 50 entries", () => {
  assert.equal(HISTORY_LIMIT, 50);
  let h = initialHistory({ nodes: [], edges: [] });
  for (let i = 0; i < 100; i++) h = historyReducer(h, { type: "push", snapshot: String(i) });
  assert.equal(h.past.length, 50);
  assert.equal(h.past[0], "49");
  assert.equal(h.past.at(-1), "98");
  for (let i = 0; i < 50; i++) h = historyReducer(h, { type: "undo" });
  assert.equal(h.present, "49");
  assert.equal(canUndo(h), false);
  assert.equal(h.future.length, 50);
  for (let i = 0; i < 50; i++) h = historyReducer(h, { type: "redo" });
  assert.equal(h.present, "99");
  assert.equal(h.past.length, 50);
  assert.equal(canRedo(h), false);
});

test("history: unavailable undo/redo and duplicate pushes preserve state and redo tail", () => {
  const empty = deepFreeze(initialHistory({ nodes: [], edges: [] }));
  assert.equal(canUndo(empty), false);
  assert.equal(canRedo(empty), false);
  assert.equal(historyReducer(empty, { type: "undo" }), empty);
  assert.equal(historyReducer(empty, { type: "redo" }), empty);
  const undone = deepFreeze(historyReducer(
    historyReducer(empty, { type: "push", snapshot: "A" }),
    { type: "undo" },
  ));
  assert.equal(historyReducer(undone, { type: "push", snapshot: undone.present }), undone);
  assert.equal(canRedo(undone), true);
  assert.deepEqual(undone.future, ["A"]);
});

test("history: undo/redo maintains chronological order without mutating prior states", () => {
  const state = deepFreeze({ past: ["A", "B"], present: "C", future: ["D"] });
  const undone = deepFreeze(historyReducer(state, { type: "undo" }));
  assert.deepEqual(undone, { past: ["A"], present: "B", future: ["C", "D"] });
  assert.deepEqual(historyReducer(undone, { type: "redo" }), state);
  assert.deepEqual(historyReducer(undone, { type: "push", snapshot: "E" }), {
    past: ["A", "B"], present: "E", future: [],
  });
  assert.equal(canUndo(undone), true);
  assert.equal(canRedo(undone), true);
  assert.deepEqual(state, { past: ["A", "B"], present: "C", future: ["D"] });
});

test("history: reset clears both stacks", () => {
  const state = deepFreeze({ past: ["A"], present: "B", future: ["C"] });
  const reset = historyReducer(state, { type: "reset", snapshot: "D" });
  assert.deepEqual(reset, { past: [], present: "D", future: [] });
  assert.equal(canUndo(reset), false);
  assert.equal(canRedo(reset), false);
});

test("normalizeSequence: empty edges → no frames", () => {
  const r = normalizeSequence([]);
  assert.deepEqual(r, { frames: [], totalSteps: 0 });
});

test("normalizeSequence: ignores edges without step", () => {
  const r = normalizeSequence([
    { id: "e1", source: "a", target: "b", data: {} },
    { id: "e2", source: "b", target: "c", data: { step: 1 } },
  ]);
  assert.equal(r.totalSteps, 1);
  assert.deepEqual(r.frames[0].edgeIds, ["e2"]);
});

test("normalizeSequence: groups parallel steps + renumbers", () => {
  const r = normalizeSequence([
    { id: "e1", source: "a", target: "b", data: { step: 5 } },
    { id: "e2", source: "a", target: "c", data: { step: 5 } },
    { id: "e3", source: "b", target: "d", data: { step: 9 } },
  ]);
  assert.equal(r.totalSteps, 2);
  assert.equal(r.frames[0].step, 1);
  assert.equal(r.frames[0].edgeIds.length, 2);
  assert.equal(r.frames[1].step, 2);
  assert.deepEqual(r.frames[1].edgeIds, ["e3"]);
});

test("normalizeSequence: filters nonnumeric/nonfinite stages and sorts numerically without mutation", () => {
  const invalid = [undefined, null, "2", NaN, Infinity, -Infinity];
  const edges = deepFreeze([
    { id: "late", source: "b", target: "d", data: { step: 10 } },
    ...invalid.map((step, i) => ({ id: `invalid-${i}`, source: "x", target: "y", data: { step } })),
    { id: "missing-data", source: "x", target: "y" },
    { id: "early", source: "a", target: "b", data: { step: 2 } },
    { id: "parallel", source: "a", target: "c", data: { step: 2 } },
  ]);
  const original = structuredClone(edges);
  assert.deepEqual(normalizeSequence(edges), {
    frames: [
      { step: 1, edgeIds: ["early", "parallel"], activeNodeIds: ["a", "b", "c"] },
      { step: 2, edgeIds: ["late"], activeNodeIds: ["b", "d"] },
    ],
    totalSteps: 2,
  });
  assert.deepEqual(edges, original);
});

test("autoSequenceFromTopology: simple chain", () => {
  const nodes = [
    { id: "a", position: { x: 0, y: 0 } },
    { id: "b", position: { x: 100, y: 0 } },
    { id: "c", position: { x: 200, y: 0 } },
  ];
  const edges = [
    { id: "e1", source: "a", target: "b", data: {} },
    { id: "e2", source: "b", target: "c", data: {} },
  ];
  const r = autoSequenceFromTopology(nodes, edges);
  assert.ok(r.ok);
  const map = Object.fromEntries(r.edgeUpdates.map((u) => [u.id, u.step]));
  assert.equal(map.e1, 1);
  assert.equal(map.e2, 2);
});

test("autoSequenceFromTopology: parallel fan-out gets same step", () => {
  const nodes = [
    { id: "a", position: { x: 0, y: 0 } },
    { id: "b", position: { x: 100, y: 0 } },
    { id: "c", position: { x: 100, y: 50 } },
  ];
  const edges = [
    { id: "e1", source: "a", target: "b", data: {} },
    { id: "e2", source: "a", target: "c", data: {} },
  ];
  const r = autoSequenceFromTopology(nodes, edges);
  assert.ok(r.ok);
  const map = Object.fromEntries(r.edgeUpdates.map((u) => [u.id, u.step]));
  assert.equal(map.e1, 1);
  assert.equal(map.e2, 1);
});

test("autoSequenceFromTopology: refuses on cycle", () => {
  const nodes = [
    { id: "a", position: { x: 0, y: 0 } },
    { id: "b", position: { x: 100, y: 0 } },
  ];
  const edges = [
    { id: "e1", source: "a", target: "b", data: {} },
    { id: "e2", source: "b", target: "a", data: {} },
  ];
  const r = autoSequenceFromTopology(nodes, edges);
  assert.equal(r.ok, false);
  assert.match(r.reason, /cycle detected.*set edge steps manually/i);
  assert.equal(r.edgeUpdates, undefined);
});

test("autoSequenceFromTopology: disconnected components ordered by leftmost position", () => {
  const nodes = [
    // Component 1 (left)
    { id: "a1", position: { x: 0, y: 0 } },
    { id: "a2", position: { x: 100, y: 0 } },
    // Component 2 (right)
    { id: "b1", position: { x: 500, y: 0 } },
    { id: "b2", position: { x: 600, y: 0 } },
  ];
  const edges = [
    { id: "ea", source: "a1", target: "a2", data: {} },
    { id: "eb", source: "b1", target: "b2", data: {} },
  ];
  for (const orderedNodes of [nodes, nodes.toReversed()]) {
    const r = autoSequenceFromTopology(orderedNodes, edges);
    assert.deepEqual(r, {
      ok: true, edgeUpdates: [{ id: "ea", step: 1 }, { id: "eb", step: 3 }],
    });
  }
});

test("autoSequenceFromTopology: fan-in waits for the longest prerequisite path", () => {
  const nodes = deepFreeze(["a", "b", "c", "d"].map((id, i) => ({
    id, position: { x: i * 100, y: 0 },
  })));
  const edges = deepFreeze([
    { id: "ac", source: "a", target: "c" },
    { id: "ab", source: "a", target: "b" },
    { id: "bc", source: "b", target: "c" },
    { id: "cd", source: "c", target: "d" },
  ]);
  assert.deepEqual(autoSequenceFromTopology(nodes, edges), {
    ok: true,
    edgeUpdates: [
      { id: "ac", step: 1 }, { id: "ab", step: 1 },
      { id: "bc", step: 2 }, { id: "cd", step: 3 },
    ],
  });
});

test("autoSequenceFromTopology: component position ties are ordered top-to-bottom", () => {
  const nodes = [
    { id: "lower", position: { x: 0, y: 100 } },
    { id: "lower-end", position: { x: 100, y: 100 } },
    { id: "upper", position: { x: 0, y: 0 } },
    { id: "upper-end", position: { x: 100, y: 0 } },
  ];
  assert.deepEqual(autoSequenceFromTopology(nodes, [
    { id: "lower-edge", source: "lower", target: "lower-end" },
    { id: "upper-edge", source: "upper", target: "upper-end" },
  ]), {
    ok: true,
    edgeUpdates: [{ id: "lower-edge", step: 3 }, { id: "upper-edge", step: 1 }],
  });
});

test("autoSequenceFromTopology: empty and isolated nodes produce no updates", () => {
  assert.deepEqual(autoSequenceFromTopology([], []), { ok: true, edgeUpdates: [] });
  assert.deepEqual(autoSequenceFromTopology([
    { id: "isolated", position: { x: 0, y: 0 } },
  ], []), { ok: true, edgeUpdates: [] });
});

test("applyAutoSequence: preserves graph/edge metadata and returns new animated edges", () => {
  const graph = deepFreeze({
    nodes: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 100, y: 0 } },
      { id: "c", position: { x: 200, y: 0 } },
    ],
    edges: [
      { id: "ab", source: "a", target: "b", sourceHandle: "bottom", targetHandle: "left",
        data: { step: 99, animated: false, label: "Request", connectionType: "data-flow", lineStyle: "dashed" } },
      { id: "bc", source: "b", target: "c" },
    ],
    layers: [{ ...DEFAULT_LAYER }],
    metadata: { name: "Retained diagram" },
  });
  const original = structuredClone(graph);
  const result = applyAutoSequence(graph);
  assert.equal(result.ok, true);
  assert.notEqual(result.graph, graph);
  assert.equal(result.graph.nodes, graph.nodes);
  assert.equal(result.graph.layers, graph.layers);
  assert.equal(result.graph.metadata, graph.metadata);
  assert.notEqual(result.graph.edges, graph.edges);
  assert.notEqual(result.graph.edges[0], graph.edges[0]);
  assert.notEqual(result.graph.edges[0].data, graph.edges[0].data);
  assert.deepEqual(result.graph.edges, [
    { ...graph.edges[0], data: { ...graph.edges[0].data, step: 1, animated: true } },
    { ...graph.edges[1], data: { step: 2, animated: true } },
  ]);
  assert.deepEqual(graph, original);
});

test("applyAutoSequence: self-loop refuses without returning or mutating a graph", () => {
  const graph = deepFreeze({
    nodes: [{ id: "a", position: { x: 0, y: 0 } }],
    edges: [{ id: "loop", source: "a", target: "a", data: { step: 7 } }],
  });
  const result = applyAutoSequence(graph);
  assert.equal(result.ok, false);
  assert.match(result.reason, /cycle detected.*manually/i);
  assert.equal(result.graph, undefined);
  assert.equal(graph.edges[0].data.step, 7);
});

// ==========================================================================
// Migration tests
// ==========================================================================

test("migrateGraph: v1 → v2 adds default connection fields to edges", () => {
  const v1Graph = {
    nodes: [{ id: "n1", type: "service", position: { x: 0, y: 0 }, data: { iconId: "azure/compute/vm", label: "VM", cloud: "azure" } }],
    edges: [{ id: "e1", source: "n1", target: "n1", data: { label: "test", step: 1 } }],
  };
  const result = migrateGraph(v1Graph, 1);
  assert.equal(result.version, 2);
  assert.equal(result.graph.edges[0].data.connectionType, "data-flow");
  assert.equal(result.graph.edges[0].data.lineStyle, "solid");
  assert.equal(result.graph.edges[0].data.arrowStyle, "forward");
  // Preserved existing fields
  assert.equal(result.graph.edges[0].data.label, "test");
  assert.equal(result.graph.edges[0].data.step, 1);
});

test("migrateGraph: v1 → v2 adds default layer", () => {
  const v1Graph = { nodes: [], edges: [] };
  const result = migrateGraph(v1Graph, 1);
  assert.ok(Array.isArray(result.graph.layers));
  assert.equal(result.graph.layers.length, 1);
  assert.equal(result.graph.layers[0].id, "default");
  assert.equal(result.graph.layers[0].name, "Default");
});

test("migrateGraph: v1 → v2 adds empty metadata", () => {
  const v1Graph = { nodes: [], edges: [] };
  const result = migrateGraph(v1Graph, 1);
  assert.deepEqual(result.graph.metadata, {});
});

test("migrateGraph: v1 → v2 preserves existing layers/metadata if present", () => {
  const v1Graph = {
    nodes: [],
    edges: [],
    layers: [{ id: "custom", name: "Custom", visible: true, locked: false, color: "#ff0000", order: 0 }],
    metadata: { name: "My Diagram" },
  };
  const result = migrateGraph(v1Graph, 1);
  assert.equal(result.graph.layers[0].id, "custom");
  assert.equal(result.graph.metadata.name, "My Diagram");
});

test("migrateGraph: v2 stays at v2 (no-op)", () => {
  const v2Graph = {
    nodes: [],
    edges: [{ id: "e1", source: "a", target: "b", data: { connectionType: "network", lineStyle: "dashed", arrowStyle: "bidirectional" } }],
    layers: [{ ...DEFAULT_LAYER }],
    metadata: {},
  };
  const result = migrateGraph(v2Graph, 2);
  assert.equal(result.version, 2);
  assert.equal(result.graph, v2Graph);
  assert.equal(result.graph.edges[0].data.connectionType, "network");
});

test("migratePayload: v1 payload gets migrated to v2", () => {
  const v1Payload = {
    version: 1,
    savedAt: "2025-01-01T00:00:00Z",
    graph: { nodes: [], edges: [{ id: "e1", source: "a", target: "b", data: { label: "hello" } }] },
  };
  const result = migratePayload(v1Payload);
  assert.ok(result);
  assert.equal(result.version, 2);
  assert.equal(result.graph.edges[0].data.connectionType, "data-flow");
  assert.equal(result.savedAt, "2025-01-01T00:00:00Z");
});

test("migratePayload: v2 payload passes through unchanged", () => {
  const v2Payload = {
    version: 2,
    savedAt: "2025-01-01T00:00:00Z",
    graph: { nodes: [], edges: [] },
  };
  const result = migratePayload(v2Payload);
  assert.ok(result);
  assert.equal(result, v2Payload);
});

test("migratePayload: future version returns null", () => {
  const futurePayload = { version: 99, savedAt: "2025-01-01", graph: { nodes: [], edges: [] } };
  assert.equal(migratePayload(futurePayload), null);
});

test("migratePayload: null/invalid returns null", () => {
  assert.equal(migratePayload(null), null);
  assert.equal(migratePayload("string"), null);
  assert.equal(migratePayload({ version: 1 }), null); // no graph
});

test("migrateGraph: edges with no data get defaults", () => {
  const v1Graph = {
    nodes: [],
    edges: [{ id: "e1", source: "a", target: "b" }],
  };
  const result = migrateGraph(v1Graph, 1);
  assert.equal(result.graph.edges[0].data.connectionType, "data-flow");
  assert.equal(result.graph.edges[0].data.lineStyle, "solid");
  assert.equal(result.graph.edges[0].data.arrowStyle, "forward");
});

test("migrateGraph: rejects unsupported, fractional and nonfinite versions", () => {
  for (const version of [0, -1, 1.5, NaN, Infinity, -Infinity, CURRENT_SCHEMA_VERSION + 1, "1"]) {
    assert.throws(
      () => migrateGraph({ nodes: [], edges: [] }, version),
      /Unsupported playground schema version/,
      `version ${version}`,
    );
  }
});

test("migratePayload: rejects malformed versions rather than partly migrating", () => {
  for (const version of [undefined, null, 0, -1, 1.5, NaN, Infinity, -Infinity, "1"]) {
    assert.equal(migratePayload({ version, graph: { nodes: [], edges: [] } }), null, `version ${version}`);
  }
});

test("migratePayload: supplies a savedAt timestamp when migrating an unsaved payload", () => {
  const before = Date.now();
  const result = migratePayload({ version: 1, graph: { nodes: [], edges: [] } });
  assert.equal(result.version, CURRENT_SCHEMA_VERSION);
  const savedAt = Date.parse(result.savedAt);
  assert.ok(savedAt >= before && savedAt <= Date.now());
});

test("migrateGraph: migration preserves explicit edge styles and does not mutate its input", () => {
  const graph = deepFreeze({
    nodes: [],
    edges: [{ id: "styled", source: "a", target: "b", data: {
      connectionType: "network", lineStyle: "dotted", arrowStyle: "none", label: "Kept", step: 4,
    } }],
  });
  const result = migrateGraph(graph, 1);
  assert.notEqual(result.graph, graph);
  assert.notEqual(result.graph.edges, graph.edges);
  assert.notEqual(result.graph.edges[0], graph.edges[0]);
  assert.notEqual(result.graph.edges[0].data, graph.edges[0].data);
  assert.deepEqual(result.graph.edges, graph.edges);
  assert.equal(graph.layers, undefined);
  assert.equal(graph.metadata, undefined);
});

test("normalizeGraph: fills defaults with independent layers and is value-idempotent", () => {
  const graph = deepFreeze({
    nodes: [], edges: [{ id: "bare", source: "a", target: "b" }],
  });
  const normalized = normalizeGraph(graph);
  assert.deepEqual(normalized.edges[0].data, {
    connectionType: "data-flow", lineStyle: "solid", arrowStyle: "forward",
  });
  assert.deepEqual(normalized.layers, [DEFAULT_LAYER]);
  assert.deepEqual(normalized.metadata, {});
  assert.notEqual(normalized.layers[0], DEFAULT_LAYER);
  assert.notEqual(normalized.layers[0], normalizeGraph(graph).layers[0]);
  assert.deepEqual(normalizeGraph(normalized), normalized);
  assert.equal(graph.edges[0].data, undefined);
});

// ==========================================================================
// Service Registry tests
// ==========================================================================

const SAMPLE_ICONS = [
  { id: "azure/compute/vm", cloud: "azure", cloudLabel: "Azure", category: "compute", categoryLabel: "Compute", slug: "vm", label: "Virtual Machine", path: "/cloud-icons/azure/compute/vm.svg" },
  { id: "azure/compute/aks", cloud: "azure", cloudLabel: "Azure", category: "compute", categoryLabel: "Compute", slug: "aks", label: "AKS", path: "/cloud-icons/azure/compute/aks.svg" },
  { id: "aws/compute/ec2", cloud: "aws", cloudLabel: "AWS", category: "compute", categoryLabel: "Compute", slug: "ec2", label: "EC2", path: "/cloud-icons/aws/compute/ec2.svg" },
  { id: "gcp/networking/vpc", cloud: "gcp", cloudLabel: "GCP", category: "networking", categoryLabel: "Networking", slug: "vpc", label: "VPC", path: "/cloud-icons/gcp/networking/vpc.svg" },
];

test("ServiceRegistry: size matches icon count", () => {
  const reg = new ServiceRegistry(SAMPLE_ICONS);
  assert.equal(reg.size, 4);
});

test("ServiceRegistry: get returns correct definition", () => {
  const reg = new ServiceRegistry(SAMPLE_ICONS);
  const vm = reg.get("azure/compute/vm");
  assert.ok(vm);
  assert.equal(vm.displayName, "Virtual Machine");
  assert.equal(vm.provider, "azure");
  assert.equal(vm.category, "Compute");
  assert.equal(vm.serviceId, SAMPLE_ICONS[0].id);
  assert.equal(vm.icon, SAMPLE_ICONS[0].path);
  assert.equal(vm.description, "Virtual machines, containers, and serverless compute");
  assert.equal(reg.getOrFallback(vm.serviceId), vm);
});

test("ServiceRegistry: get returns undefined for unknown", () => {
  const reg = new ServiceRegistry(SAMPLE_ICONS);
  assert.equal(reg.get("unknown/service"), undefined);
});

test("ServiceRegistry: getOrFallback returns fallback for unknown", () => {
  const reg = new ServiceRegistry(SAMPLE_ICONS);
  const fallback = reg.getOrFallback("old/removed/service");
  assert.equal(fallback.serviceId, "old/removed/service");
  assert.equal(fallback.displayName, "service");
  assert.equal(fallback.provider, "generic");
  assert.equal(fallback.category, "Unknown");
  assert.equal(fallback.icon, "");
  assert.match(fallback.description, /unknown service.*removed from the manifest/i);
  assert.equal(reg.has(fallback.serviceId), false);
  assert.equal(reg.size, SAMPLE_ICONS.length);
});

test("ServiceRegistry: getByCategory returns grouped services", () => {
  const reg = new ServiceRegistry(SAMPLE_ICONS);
  const compute = reg.getByCategory("compute");
  assert.deepEqual(compute.map((service) => service.serviceId), [
    "azure/compute/vm", "azure/compute/aks", "aws/compute/ec2",
  ]);
  assert.equal(compute[0], reg.get("azure/compute/vm"));
});

test("ServiceRegistry: getByProvider returns provider services", () => {
  const reg = new ServiceRegistry(SAMPLE_ICONS);
  assert.equal(reg.getByProvider("azure").length, 2);
  assert.equal(reg.getByProvider("aws").length, 1);
  assert.equal(reg.getByProvider("gcp").length, 1);
  assert.deepEqual(reg.getByProvider("azure").map((service) => service.serviceId), [
    "azure/compute/vm", "azure/compute/aks",
  ]);
  assert.deepEqual(reg.getByProvider("generic"), []);
});

test("ServiceRegistry: has checks existence", () => {
  const reg = new ServiceRegistry(SAMPLE_ICONS);
  assert.ok(reg.has("azure/compute/vm"));
  assert.ok(!reg.has("nonexistent"));
});

test("ServiceRegistry: empty icons produces empty registry", () => {
  const reg = new ServiceRegistry([]);
  assert.equal(reg.size, 0);
  assert.equal(reg.get("anything"), undefined);
  assert.deepEqual(reg.getByCategory("compute"), []);
  assert.deepEqual(reg.categories, []);
  assert.deepEqual(reg.providers, []);
});

test("ServiceRegistry: exposes sorted category and provider indexes", () => {
  const reg = new ServiceRegistry(deepFreeze(structuredClone(SAMPLE_ICONS).reverse()));
  assert.deepEqual(reg.categories, ["compute", "networking"]);
  assert.deepEqual(reg.providers, ["aws", "azure", "gcp"]);
  assert.deepEqual(reg.getByCategory("missing"), []);
});

test("ServiceRegistry: categories without enrichment still resolve manifest metadata", () => {
  const icon = { ...SAMPLE_ICONS[0], category: "custom", categoryLabel: "Custom" };
  const reg = new ServiceRegistry([icon]);
  assert.equal(reg.get(icon.id).category, "Custom");
  assert.equal(reg.get(icon.id).description, undefined);
  assert.deepEqual(reg.getByCategory("custom"), [reg.get(icon.id)]);
});

test("ServiceRegistry: singleton factory publishes and replaces the manifest registry", () => {
  assert.equal(getServiceRegistry(), null);
  const first = createServiceRegistry(SAMPLE_ICONS);
  assert.ok(first instanceof ServiceRegistry);
  assert.equal(getServiceRegistry(), first);
  assert.equal(first.size, 4);
  const second = createServiceRegistry([]);
  assert.notEqual(second, first);
  assert.equal(getServiceRegistry(), second);
  assert.equal(second.size, 0);
  assert.equal(first.size, 4);
});
