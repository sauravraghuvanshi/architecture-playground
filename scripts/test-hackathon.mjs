import assert from "node:assert/strict";
import test from "node:test";
import { parseArchitectureDocument } from "../lib/architecture-document.ts";
import { imageRequestSchema, buildImagePrompt } from "../lib/image-styles.ts";
import { aiRateLimit, _resetAiRateLimit } from "../lib/ai-rate-limit.ts";
import { readBoundedJson } from "../lib/request-json.ts";
import { dataUrlToBlob } from "../lib/data-url.ts";

const graph = {
  nodes: [
    { kind: "group", id: "tier", label: "Compute", x: 0, y: 0, width: 600, height: 300 },
    { kind: "shape", id: "api", label: "API", shape: "rectangle", x: 30, y: 40, parentId: "tier" },
    { kind: "shape", id: "db", label: "Data", shape: "database", x: 250, y: 40, parentId: "tier" },
  ],
  edges: [{ id: "e1", source: "api", target: "db", label: "TLS", style: "dashed", step: 2 }],
};

test("SVG data URL conversion preserves UTF-8 rather than truncating Unicode characters", async () => {
  const text = '<svg xmlns="http://www.w3.org/2000/svg"><text>\u2014 \u2192 \u4e2d\u6587 \ud83d\ude80</text></svg>';
  const blob = dataUrlToBlob(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`);
  assert.equal(blob.type, "image/svg+xml");
  assert.equal(await blob.text(), text);
  assert.deepEqual(Buffer.from(await blob.arrayBuffer()), Buffer.from(text, "utf8"));
});

test("base64 exports preserve every binary byte and malformed data URLs fail", async () => {
  const bytes = Buffer.from(Array.from({ length: 256 }, (_, index) => index));
  const blob = dataUrlToBlob(`data:image/png;base64,${bytes.toString("base64")}`);
  assert.equal(blob.type, "image/png");
  assert.deepEqual(Buffer.from(await blob.arrayBuffer()), bytes);
  assert.throws(() => dataUrlToBlob("not-a-data-url"));
  assert.throws(() => dataUrlToBlob("data:image/svg+xml,%ZZ"));
});

test("architecture JSON round-trip preserves grouping, shapes, protocols, styles and stages", () => {
  assert.deepEqual(parseArchitectureDocument(JSON.parse(JSON.stringify(graph))), { ...graph, schemaVersion: 1 });
});

test("architecture import rejects dangling edges, duplicate IDs, invalid positions and remote icons", () => {
  assert.throws(() => parseArchitectureDocument({ ...graph, edges: [{ id: "x", source: "missing", target: "db" }] }));
  assert.throws(() => parseArchitectureDocument({ ...graph, nodes: [...graph.nodes, graph.nodes[0]] }));
  assert.throws(() => parseArchitectureDocument({ nodes: [{ ...graph.nodes[1], x: Infinity }], edges: [] }));
  assert.throws(() => parseArchitectureDocument({ nodes: [{ kind: "icon", id: "x", label: "X", x: 0, y: 0, iconId: "x", iconPath: "https://example.com/icon.svg" }], edges: [] }));
});

test("native JSON preserves all connection sides, null defaults and explicit geometry", () => {
  for (const sourceHandle of ["top", "right", "bottom", "left", null]) {
    for (const targetHandle of ["top", "right", "bottom", "left", null]) {
      const input = {
        ...graph,
        nodes: graph.nodes.map((node) => ({ ...node, width: 240.5, height: 160.25 })),
        edges: [{ ...graph.edges[0], sourceHandle, targetHandle, step: 100_000 }],
      };
      assert.deepEqual(parseArchitectureDocument(JSON.parse(JSON.stringify(input))), { ...input, schemaVersion: 1 });
    }
  }
});

test("native import rejects unsupported handles and nested groups instead of silently stripping them", () => {
  assert.throws(() => parseArchitectureDocument({ ...graph, edges: [{ ...graph.edges[0], sourceHandle: "invalid-side" }] }));
  assert.throws(() => parseArchitectureDocument({
    ...graph, nodes: [{ ...graph.nodes[0], parentId: "tier" }, ...graph.nodes.slice(1)],
  }));
});

test("image styles preserve user intent with canvas-aware instructions and validate explicit presets", () => {
  const original = imageRequestSchema.parse({ prompt: "An order workflow" });
  assert.match(buildImagePrompt(original), /Visual requested by the user:\nAn order workflow$/);
  assert.match(buildImagePrompt(original), /Exact canvas background: #05080d/);
  assert.match(buildImagePrompt(imageRequestSchema.parse({ prompt: original.prompt, style: "executive" })), /presentation style/);
  for (const input of [{ prompt: 42 }, { prompt: "x", style: "unknown" }, { prompt: "x", size: "huge" }, { prompt: "x".repeat(1001) }]) {
    assert.equal(imageRequestSchema.safeParse(input).success, false);
  }
});

test("AI request limiter rejects excess requests with retry guidance", () => {
  _resetAiRateLimit();
  const request = new Request("https://localhost/api/ai/image");
  for (let i = 0; i < 20; i++) assert.equal(aiRateLimit(request).ok, true);
  const limited = aiRateLimit(request);
  assert.equal(limited.ok, false);
  assert.ok(limited.retryAfterSec > 0);
  _resetAiRateLimit();
});

test("bounded JSON rejects oversized and malformed bodies before model invocation", async () => {
  const request = (body) => new Request("https://localhost/api", { method: "POST", body });
  assert.deepEqual(await readBoundedJson(request('{"x":1}'), 20), { x: 1 });
  await assert.rejects(readBoundedJson(request("x".repeat(21)), 20), { status: 413 });
  await assert.rejects(readBoundedJson(request("{"), 20), { status: 400 });
});
