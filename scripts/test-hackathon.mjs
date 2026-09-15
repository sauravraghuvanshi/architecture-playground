import assert from "node:assert/strict";
import test from "node:test";
import { parseArchitectureDocument } from "../lib/architecture-document.ts";
import { imageRequestSchema, buildImagePrompt } from "../lib/image-styles.ts";
import { aiRateLimit, _resetAiRateLimit } from "../lib/ai-rate-limit.ts";
import { readBoundedJson } from "../lib/request-json.ts";

const graph = {
  nodes: [
    { kind: "group", id: "tier", label: "Compute", x: 0, y: 0, width: 600, height: 300 },
    { kind: "shape", id: "api", label: "API", shape: "rectangle", x: 30, y: 40, parentId: "tier" },
    { kind: "shape", id: "db", label: "Data", shape: "database", x: 250, y: 40, parentId: "tier" },
  ],
  edges: [{ id: "e1", source: "api", target: "db", label: "TLS", style: "dashed", step: 2 }],
};

test("architecture JSON round-trip preserves grouping, shapes, protocols, styles and stages", () => {
  assert.deepEqual(parseArchitectureDocument(JSON.parse(JSON.stringify(graph))), graph);
});

test("architecture import rejects dangling edges, duplicate IDs, invalid positions and remote icons", () => {
  assert.throws(() => parseArchitectureDocument({ ...graph, edges: [{ id: "x", source: "missing", target: "db" }] }));
  assert.throws(() => parseArchitectureDocument({ ...graph, nodes: [...graph.nodes, graph.nodes[0]] }));
  assert.throws(() => parseArchitectureDocument({ nodes: [{ ...graph.nodes[1], x: Infinity }], edges: [] }));
  assert.throws(() => parseArchitectureDocument({ nodes: [{ kind: "icon", id: "x", label: "X", x: 0, y: 0, iconId: "x", iconPath: "https://example.com/icon.svg" }], edges: [] }));
});

test("image styles preserve default prompt and validate explicit presets", () => {
  const original = imageRequestSchema.parse({ prompt: "An order workflow" });
  assert.equal(buildImagePrompt(original), "An order workflow");
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
