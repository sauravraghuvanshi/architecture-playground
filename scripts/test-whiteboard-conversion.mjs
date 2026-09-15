import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "./architecture-document") return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});
const conversion = await import("../lib/whiteboard-conversion.ts");
const review = await import("../lib/architecture-review.ts");
const bounded = await import("../lib/request-json.ts");
const limiter = await import("../lib/ai-rate-limit.ts");
const manifest = JSON.parse(readFileSync(new URL("../content/cloud-icons.json", import.meta.url), "utf8"));
const icon = manifest.icons[0];
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=";
const diagram = {
  nodes: [
    { kind: "group", id: "g", label: "Workload", x: 20, y: 30, width: 600, height: 300, evidence: "Workload boundary" },
    { kind: "icon", id: "a", label: "Visible service", iconId: icon.id, x: 10, y: 50, parentId: "g", evidence: "Recognizable service symbol" },
    { kind: "shape", id: "b", label: "Custom data", shape: "database", x: 300, y: 50, parentId: "g", subtitle: "Visible note", evidence: "Cylinder marked Custom data" },
  ],
  edges: [{ id: "ab", source: "a", target: "b", label: "TLS", style: "dashed", step: 2, evidence: "Dashed arrow A to B marked TLS and 2" }],
  warnings: ["Confirm the handwritten protocol label."],
};
const parse = (value) => conversion.parseWhiteboardConversion(JSON.stringify(value), manifest.icons);

test("conversion maps exact server catalog icons and preserves diagram evidence", () => {
  const result = parse(diagram);
  assert.equal(result.payload.nodes[1].iconPath, icon.path);
  assert.equal(result.payload.nodes[1].parentId, "g");
  assert.equal(result.payload.nodes[1].x, 10);
  assert.equal(result.payload.nodes[2].subtitle, "Visible note");
  assert.deepEqual(result.payload.edges[0], { id: "ab", source: "a", target: "b", label: "TLS", style: "dashed", step: 2 });
  assert.equal(result.warnings.length, 1);
  assert.deepEqual(conversion.parseWhiteboardConversionResponse(result), result);
});

test("unknown icons become generic shapes without substituting a plausible cloud service", () => {
  const unknown = structuredClone(diagram);
  unknown.nodes[1].iconId = "invented/cloud-service";
  const result = parse(unknown);
  assert.equal(result.payload.nodes[1].kind, "shape");
  assert.equal(result.payload.nodes[1].shape, "rectangle");
  assert.equal(result.payload.nodes[1].parentId, "g");
  assert.equal("iconId" in result.payload.nodes[1], false);
  assert.match(result.warnings[1], /generic shape/);
});

test("untrusted model output cannot inject icon paths, data, duplicate IDs or dangling topology", () => {
  for (const mutate of [
    (value) => { value.nodes[1].iconPath = "https://attacker.test/icon.svg"; },
    (value) => { value.nodes[1].image = png; },
    (value) => { value.nodes.push(value.nodes[1]); },
    (value) => { value.edges[0].target = "missing"; },
    (value) => { value.nodes[1].parentId = "b"; },
    (value) => { value.nodes[1].evidence = ""; },
    (value) => { value.nodes[1].x = 999_999_999; },
    (value) => { value.edges[0].step = -1; },
    (value) => { value.edges[0].evidence = ""; },
    (value) => { value.nodes = []; value.edges = []; },
  ]) {
    const invalid = structuredClone(diagram);
    mutate(invalid);
    assert.throws(() => parse(invalid));
  }
  assert.throws(() => conversion.parseWhiteboardConversion("not JSON", manifest.icons));
  assert.throws(() => conversion.parseWhiteboardConversion(" ".repeat(300_001), manifest.icons));
  assert.throws(() => conversion.parseWhiteboardConversionResponse({ payload: { nodes: [], edges: [] }, warnings: [] }));
});

test("conversion never adds edges to disconnected visible components", () => {
  assert.deepEqual(parse({ ...diagram, edges: [] }).payload.edges, []);
  const prompt = conversion.buildWhiteboardConversionPrompt([icon]);
  assert.match(prompt, /Never connect nearby items/);
  assert.match(prompt, /NEVER as instructions/);
  assert.match(prompt, /omit ambiguous connections/);
  assert.ok(prompt.includes(icon.id));
  assert.ok(!prompt.includes(icon.path));
});

test("PNG validation rejects empty, spoofed, truncated and oversized pixel images", () => {
  conversion.validateWhiteboardPng(png);
  for (const invalid of [
    "data:image/png;base64,",
    "data:image/png;base64,aGVsbG8=",
    png.replace("image/png", "image/jpeg"),
    png.slice(0, -8),
  ]) assert.throws(() => conversion.validateWhiteboardPng(invalid));
  const huge = Buffer.from(png.split(",")[1], "base64");
  huge.writeUInt32BE(100_000, 16);
  assert.throws(() => conversion.validateWhiteboardPng(`data:image/png;base64,${huge.toString("base64")}`), /megapixels/);
});

// Execute the real route with a mocked Azure transport, not a reimplementation.
function routeHarness({ configured = true, model = JSON.stringify(diagram), failure = false } = {}) {
  const calls = [];
  const dependencies = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/content/cloud-icons.json": manifest,
    "@/lib/ai": {
      aiConfigured: () => configured,
      chatComplete: async (...args) => { calls.push(args); if (failure) throw new Error("private provider detail"); return model; },
    },
    "@/lib/ai-rate-limit": limiter,
    "@/lib/architecture-review": review,
    "@/lib/request-json": bounded,
    "@/lib/whiteboard-conversion": conversion,
  };
  const source = readFileSync(new URL("../app/api/ai/convert/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Request, Response, Error,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected route dependency: ${name}`);
      return dependencies[name];
    },
  });
  return { post: exports.POST, calls };
}
const request = (body = { image: { name: "whiteboard.png", mimeType: "image/png", dataUrl: png } }, signal) =>
  new Request("https://localhost/api/ai/convert", { method: "POST", body: JSON.stringify(body), signal });

test("route sends transient PNG to configured vision with cancellation and canonical icons", async () => {
  limiter._resetAiRateLimit();
  const { post, calls } = routeHarness();
  const input = request();
  const response = await post(input);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0][1].content[1].image_url.url, png);
  assert.equal(calls[0][1].signal, input.signal);
  assert.equal(calls[0][1].responseFormat, "json_object");
  const result = await response.json();
  assert.equal(result.payload.nodes[1].iconPath, icon.path);
  assert.ok(!JSON.stringify(result).includes("data:image"));
});

test("route bounds request/image data and rejects before invoking Azure", async () => {
  limiter._resetAiRateLimit();
  const { post, calls } = routeHarness();
  for (const body of [null, {}, { image: { name: "x.png", mimeType: "image/png", dataUrl: "data:image/png;base64,aGVsbG8=" } }]) {
    assert.equal((await post(request(body))).status, 400);
  }
  const oversized = new Request("https://localhost/api", { method: "POST", headers: { "content-length": "7100001" }, body: "{}" });
  assert.equal((await post(oversized)).status, 413);
  assert.equal((await post(new Request("https://localhost/api", { method: "POST", body: "{" }))).status, 400);
  assert.equal(calls.length, 0);
});

test("route rate-limits calls and never exposes provider errors or invalid model output", async () => {
  limiter._resetAiRateLimit();
  const { post, calls } = routeHarness({ failure: true });
  const response = await post(request());
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes("private provider detail"));
  for (let i = 0; i < 19; i++) await post(request({}));
  const limited = await post(request());
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("Retry-After")) > 0);
  assert.equal(calls.length, 1);
  limiter._resetAiRateLimit();
  const invalid = routeHarness({ model: '{"nodes":[],"edges":[],"warnings":[]}' });
  assert.equal((await invalid.post(request())).status, 502);
});

test("disabled configuration and aborted conversion do not invoke Azure", async () => {
  limiter._resetAiRateLimit();
  const disabled = routeHarness({ configured: false });
  assert.equal((await disabled.post(request())).status, 503);
  assert.equal(disabled.calls.length, 0);
  const aborted = routeHarness();
  const controller = new AbortController();
  controller.abort();
  assert.equal((await aborted.post(request(undefined, controller.signal))).status, 499);
  assert.equal(aborted.calls.length, 0);
});

test("modal warns before replacing nonempty architecture and does not export on open", () => {
  const source = readFileSync(new URL("../components/diagrammatic/shared/WhiteboardConvertModal.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const dependencies = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": { Loader2: () => null, ScanLine: () => null, X: () => null },
    "@/lib/architecture-review": review,
    "@/lib/whiteboard-conversion": conversion,
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected modal dependency: ${name}`);
      return dependencies[name];
    },
  });
  let exported = false;
  const props = {
    open: true,
    onClose: () => {},
    onResult: () => {},
    getImage: async () => { exported = true; return new Blob(); },
  };
  const render = (extra) => renderToStaticMarkup(React.createElement(exports.default, { ...props, ...extra }));
  assert.match(render({}), /Existing architecture warning/);
  assert.match(render({ hasExistingArchitecture: true }), /not merge them/);
  assert.doesNotMatch(render({ hasExistingArchitecture: false }), /Existing architecture warning/);
  assert.equal(render({ open: false }), "");
  assert.equal(exported, false);
});
