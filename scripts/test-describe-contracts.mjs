import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server.js";
import * as bounded from "../lib/request-json.ts";
import * as evidence from "../lib/review-evidence.ts";

const source = readFileSync(new URL("../app/api/ai/describe/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function harness(failure) {
  const calls = [];
  const dependencies = {
    "next/server": { NextResponse },
    "@/lib/ai-rate-limit": { aiRateLimit: () => ({ ok: true }) },
    "@/lib/request-json": bounded, "@/lib/review-evidence": evidence,
    "@/lib/ai": {
      aiConfigured: () => true,
      chatComplete: async (...args) => { calls.push(args); if (failure) throw failure; return "Complete synthetic explanation"; },
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, Error, require: (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
    return dependencies[name];
  } });
  return { ...exports, calls };
}
const request = (body) => new Request("http://localhost/api/ai/describe", { method: "POST", body: JSON.stringify(body) });
test("explanations retain the complete bounded graph instead of truncating input", async () => {
  const route = harness();
  const graph = { nodes: [{ id: "n", label: "original" }], edges: [], metadata: { text: "x".repeat(35_000) + "END-EVIDENCE" } };
  const response = await route.POST(request({ graph }));
  assert.equal(response.status, 200);
  assert.equal(route.calls[0][0][1].content, JSON.stringify(graph));
});
test("invalid/oversized explanation inputs never call a provider", async () => {
  const route = harness();
  for (const graph of [{ nodes: [{}], edges: [] }, { nodes: [{ id: "n" }], edges: [{ id: "e", source: "n", target: "missing" }] }]) {
    assert.equal((await route.POST(request({ graph }))).status, 400);
  }
  const over = await route.POST(request({ graph: { nodes: [], edges: [], metadata: { text: "x".repeat(130_000) } } }));
  assert.equal(over.status, 413);
  assert.equal(route.calls.length, 0);
});
test("explanation provider errors do not disclose raw internal diagnostics", async () => {
  const route = harness(new Error("sensitive-fixture-token and internal URL"));
  const response = await route.POST(request({ graph: { nodes: [{ id: "n" }], edges: [] } }));
  assert.equal(response.status, 502);
  assert.doesNotMatch(JSON.stringify(await response.json()), /sensitive-fixture|internal URL/);
});
