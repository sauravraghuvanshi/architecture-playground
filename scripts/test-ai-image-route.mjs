import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as imageStyles from "../lib/image-styles.ts";
import * as requestJson from "../lib/request-json.ts";
import * as imageEvents from "../lib/ai-image-events.ts";
import * as imageServer from "../lib/review-image-server.ts";
import * as imageValidation from "../lib/review-image.ts";
import sharp from "sharp";

const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgqLjyHwAEFAJMURtfXQAAAABJRU5ErkJggg==";

const source = readFileSync(new URL("../app/api/ai/image/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

// Executes the production route. All outbound fetches are deterministic stubs;
// the synthetic bytes are not AI-generated and are not used as pixel evidence.
function routeHarness({ proxy = false, proxyUrl = "https://fixture-proxy.invalid", failure = false, upstream, timers } = {}) {
  const calls = [];
  const exports = {};
  const dependencies = {
    "next/server": { NextResponse: { json: (data, options) => Response.json(data, options) } },
    "@/lib/ai-rate-limit": { aiRateLimit: () => ({ ok: true }) },
    "@/lib/image-styles": imageStyles,
    "@/lib/request-json": requestJson,
    "@/lib/ai-image-events": imageEvents,
    "@/lib/review-image-server": imageServer,
    "@/lib/review-image": imageValidation,
    "@/lib/ai-image-config": {
      getImageAiConfig: () => proxy ? null : { endpoint: "https://fixture.invalid", apiKey: "fixture-only", deployment: "fixture-model" },
      getImageAiProxyBaseUrl: () => proxy ? proxyUrl : null,
    },
  };
  vm.runInNewContext(compiled, {
    exports, URL, Response, Headers, Buffer, TextEncoder, ReadableStream, AbortController, AbortSignal,
    setInterval, clearInterval, setTimeout: timers?.setTimeout ?? setTimeout, clearTimeout,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
      return dependencies[name];
    },
    fetch: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body), headers: options.headers, redirect: options.redirect });
      if (failure) throw new Error("private provider or proxy diagnostic");
      if (upstream) return upstream(options);
      return proxy
        ? new Response('data: {"type":"result","b64":"fixture"}\n\n', { headers: { "Content-Type": "text/event-stream" } })
        : Response.json({ data: [{ b64_json: b64 }] });
    },
  });
  return { post: (body, headers, signal) => exports.POST(new Request("https://app.invalid/api/ai/image", { method: "POST", headers, signal, body: JSON.stringify(body) })), calls };
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
    assert.equal(events.at(-1).mimeType, "image/png");
    assert.deepEqual(events.at(-1).canvas, canvas);
  }
});

const events = async (response) => (await response.text()).split("\n").filter((line) => line.startsWith("data: ")).map((line) => JSON.parse(line.slice(6)));

test("server rejects URL-only, empty, duplicated or corrupt image output instead of emitting success", async () => {
  for (const data of [[], [{ url: "https://external.invalid/image" }], [{ b64_json: b64 }, { b64_json: b64 }], [{ b64_json: "bad-data" }]]) {
    const route = routeHarness({ upstream: async () => Response.json({ data }) });
    const result = await events(await route.post({ prompt: "Fixture" }));
    assert.equal(result.at(-1).type, "error");
    assert.equal(result.at(-1).code, "invalid_output");
    assert.equal(result.some((event) => event.type === "result"), false);
  }
});

test("provider errors are classified without returning diagnostic text", async () => {
  for (const [status, body, code] of [
    [429, {}, "throttled"], [400, { error: { code: "contentFilter", message: "PRIVATE" } }, "refused"],
    [401, {}, "unavailable"], [502, {}, "upstream"],
  ]) {
    const route = routeHarness({ upstream: async () => Response.json(body, { status }) });
    const result = await events(await route.post({ prompt: "Fixture" }));
    assert.equal(result.at(-1).code, code);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
  }
});

test("insertable output reports actual JPEG and WebP MIME instead of labeling every image PNG", async () => {
  for (const format of ["jpeg", "webp"]) {
    const bytes = await sharp({ create: { width: 2, height: 1, channels: 3, background: "#0078d4" } }).toFormat(format).toBuffer();
    const route = routeHarness({ upstream: async () => Response.json({ data: [{ b64_json: bytes.toString("base64") }] }) });
    const terminal = (await events(await route.post({ prompt: "Fixture" }))).at(-1);
    assert.equal(terminal.type, "result");
    assert.equal(terminal.mimeType, `image/${format}`);
    assert.equal(terminal.b64, bytes.toString("base64"));
  }
});

test("provider byte budget and malformed output fail explicitly without leaking network errors", async () => {
  const tooLarge = routeHarness({ upstream: async () => new Response("{}", { headers: { "content-length": String(imageEvents.IMAGE_RESPONSE_MAX_BYTES + 1) } }) });
  assert.equal((await events(await tooLarge.post({ prompt: "Fixture" }))).at(-1).code, "invalid_output");
  const network = routeHarness({ failure: true });
  const failed = await events(await network.post({ prompt: "Fixture" }));
  assert.equal(failed.at(-1).code, "upstream");
  assert.doesNotMatch(JSON.stringify(failed), /private provider/);
});

test("cancelling the response interrupts pending upstream work before producer completion", async () => {
  let signal;
  const route = routeHarness({ upstream: (options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  } });
  const response = await route.post({ prompt: "Fixture" });
  const reader = response.body.getReader();
  await reader.read();
  await reader.cancel();
  assert.equal(signal.aborted, true);
});

test("pre-aborted input never invokes the provider and timeout has its own terminal code", async () => {
  const route = routeHarness();
  assert.equal((await route.post({ prompt: "Fixture" }, undefined, AbortSignal.abort())).status, 499);
  assert.equal(route.calls.length, 0);
  const timeout = routeHarness({
    timers: { setTimeout: (callback) => setTimeout(callback, 10) },
    upstream: ({ signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })),
  });
  assert.equal((await events(await timeout.post({ prompt: "Fixture" }))).at(-1).code, "timeout");
});

test("development proxy preserves validated request surface and style", async () => {
  const { post, calls } = routeHarness({ proxy: true });
  const canvas = { theme: "light", backgroundColor: "#193a52", foregroundColor: "#f8fafc" };
  const response = await post({ prompt: "Fixture", canvas, style: "executive" });
  await response.text();
  assert.deepEqual(calls[0].body.canvas, canvas);
  assert.equal(calls[0].body.style, "executive");
  assert.equal(calls[0].redirect, "error");
  assert.equal(calls[0].headers["X-Diagrammatic-Image-Proxy"], "1");
});

test("self and chained proxies cannot forward prompts or create forwarding loops", async () => {
  const self = routeHarness({ proxy: true, proxyUrl: "https://app.invalid" });
  assert.equal((await self.post({ prompt: "Synthetic" })).status, 503);
  assert.equal(self.calls.length, 0);
  const chained = routeHarness({ proxy: true });
  assert.equal((await chained.post({ prompt: "Synthetic" }, { "x-diagrammatic-image-proxy": "1" })).status, 503);
  assert.equal(chained.calls.length, 0);
});

test("configured proxy failure is explicit, redacted and never tries another destination", async () => {
  const route = routeHarness({ proxy: true, failure: true });
  const response = await route.post({ prompt: "Synthetic" });
  assert.equal(response.status, 502);
  assert.doesNotMatch(JSON.stringify(await response.json()), /private provider/);
  assert.equal(route.calls.length, 1);
});

test("invalid request surfaces are rejected before any outbound request", async () => {
  const { post, calls } = routeHarness();
  const response = await post({ prompt: "Fixture", canvas: { theme: "dark", backgroundColor: "red", foregroundColor: "#fff" } });
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});
