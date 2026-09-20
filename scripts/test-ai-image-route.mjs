import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as imageStyles from "../lib/image-styles.ts";
import * as requestJson from "../lib/request-json.ts";

const source = readFileSync(new URL("../app/api/ai/image/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

// Executes the production route. All outbound fetches are deterministic stubs;
// the synthetic bytes are not AI-generated and are not used as pixel evidence.
function routeHarness({ proxy = false } = {}) {
  const calls = [];
  const exports = {};
  const dependencies = {
    "next/server": { NextResponse: { json: (data, options) => Response.json(data, options) } },
    "@/lib/ai-rate-limit": { aiRateLimit: () => ({ ok: true }) },
    "@/lib/image-styles": imageStyles,
    "@/lib/request-json": requestJson,
    "@/lib/ai-image-config": {
      getImageAiConfig: () => proxy ? null : { endpoint: "https://fixture.invalid", apiKey: "fixture-only", deployment: "fixture-model" },
      getImageAiProxyBaseUrl: () => proxy ? "https://fixture-proxy.invalid" : null,
    },
  };
  vm.runInNewContext(compiled, {
    exports, Response, Headers, TextEncoder, ReadableStream, AbortController, AbortSignal,
    setInterval, clearInterval, setTimeout, clearTimeout,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
      return dependencies[name];
    },
    fetch: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return proxy
        ? new Response('data: {"type":"result","b64":"fixture"}\n\n', { headers: { "Content-Type": "text/event-stream" } })
        : Response.json({ data: [{ b64_json: "fixture-not-model-output" }] });
    },
  });
  return { post: (body) => exports.POST(new Request("https://app.invalid/api/ai/image", { method: "POST", body: JSON.stringify(body) })), calls };
}

test("production route forwards canvas-aware prompt and echoes captured context without unsupported background flags", async () => {
  for (const canvas of [
    { theme: "light", backgroundColor: "#f8fafc", foregroundColor: "#0f172a" },
    { theme: "dark", backgroundColor: "#05080d", foregroundColor: "#f8fafc" },
    { theme: "dark", backgroundColor: "#fff3bf", foregroundColor: "#0f172a" },
  ]) {
    const { post, calls } = routeHarness();
    const response = await post({ prompt: "Fixture order workflow", style: "workshop", size: "1536x1024", canvas });
    const events = (await response.text()).split("\n").filter((line) => line.startsWith("data: ")).map((line) => JSON.parse(line.slice(6)));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.size, "1536x1024");
    assert.ok(calls[0].body.prompt.includes(canvas.backgroundColor));
    assert.ok(calls[0].body.prompt.includes(canvas.foregroundColor));
    assert.equal(calls[0].body.background, undefined, "Never claim transparent-output support based on a deployment alias");
    assert.equal(events.at(-1).type, "result");
    assert.deepEqual(events.at(-1).canvas, canvas);
  }
});

test("development proxy preserves validated request surface and style", async () => {
  const { post, calls } = routeHarness({ proxy: true });
  const canvas = { theme: "light", backgroundColor: "#193a52", foregroundColor: "#f8fafc" };
  const response = await post({ prompt: "Fixture", canvas, style: "executive" });
  await response.text();
  assert.deepEqual(calls[0].body.canvas, canvas);
  assert.equal(calls[0].body.style, "executive");
});

test("invalid request surfaces are rejected before any outbound request", async () => {
  const { post, calls } = routeHarness();
  const response = await post({ prompt: "Fixture", canvas: { theme: "dark", backgroundColor: "red", foregroundColor: "#fff" } });
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});
