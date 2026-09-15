import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { promptToArchitecture } from "../lib/prompt-to-arch.ts";
import * as modeHelpers from "../lib/ai-mode-prompts.ts";
import * as requestHelpers from "../lib/request-json.ts";
import {
  buildGenerationUserPrompt,
  generationRequestSchema,
  parseGuidedArchitecture,
  validateModeOutput,
  MODE_PROMPTS,
} from "../lib/ai-mode-prompts.ts";

const { icons } = JSON.parse(readFileSync(new URL("../content/cloud-icons.json", import.meta.url), "utf8"));
const azureIcon = icons.find((icon) => icon.cloud === "azure");
const modelOutput = () => ({
  metadata: { name: "Customer portal", description: "Proposed Azure workload" },
  nodes: [{ id: "app", type: "service", position: { x: 0, y: 0 }, data: { iconId: azureIcon.id, label: "Application", cloud: "azure" } }],
  edges: [],
  designAssistance: {
    assumptions: ["Availability target needs confirmation."],
    recommendations: ["Use managed identities and least-privilege RBAC."],
    tradeoffs: ["Multi-region increases cost and operational complexity."],
    nextSteps: ["Define RTO/RPO and test restore before release."],
  },
});

test("guided Azure scaffold includes proposed controls and business/recovery checkpoints", () => {
  const graph = promptToArchitecture("Secure production Azure customer portal", icons);
  assert.ok(graph);
  const serviceIds = graph.nodes.filter((node) => node.kind === "icon").map((node) => node.iconId);
  assert.ok(serviceIds.every((id) => id.startsWith("azure/")));
  assert.ok(serviceIds.some((id) => /key-vault/.test(id)));
  assert.ok(serviceIds.some((id) => /monitor/.test(id)));
  assert.ok(serviceIds.some((id) => /identity|identities|directory|entra/.test(id)));
  assert.ok(graph.nodes.some((node) => node.label === "Microsoft Entra ID"));
  const notes = graph.nodes.filter((node) => node.kind === "shape").map((node) => node.subtitle).join(" ");
  assert.match(notes, /RTO and RPO/);
  assert.match(notes, /residency, cost and business need/);
  assert.match(notes, /do not prove configuration, availability or compliance/);
  const controls = graph.edges.filter((edge) => edge.target.startsWith("n_ops"));
  assert.ok(controls.length > 0);
  assert.ok(controls.every((edge) => edge.style === "dashed" && edge.step === undefined));
  assert.deepEqual(graph, promptToArchitecture("Secure production Azure customer portal", icons));
});

test("explicit template services and cloud remain intact without forced guidance", () => {
  const azure = promptToArchitecture("Three tier web app on Azure with Front Door, App Service, and Azure SQL Database", icons);
  assert.ok(azure.nodes.some((node) => node.label === "Azure Front Door"));
  assert.ok(azure.nodes.some((node) => node.label === "SQL Database"));
  assert.equal(azure.nodes.some((node) => node.id === "g_design_guidance"), false);
  const aws = promptToArchitecture("Secure production serverless AWS system with S3, Lambda and DynamoDB", icons);
  assert.ok(aws.nodes.filter((node) => node.kind === "icon").every((node) => node.iconId.startsWith("aws/")));
  assert.ok(aws.nodes.some((node) => node.label === "Lambda"));
  assert.equal(aws.nodes.some((node) => node.id === "g_design_guidance"), false);
  const explicit = promptToArchitecture("Secure production Azure App Service", icons, { guidedDesign: false });
  assert.equal(explicit.nodes.some((node) => node.id === "g_design_guidance"), false);
});

test("keyword boundaries avoid building accidental UI or RAG services", () => {
  assert.equal(promptToArchitecture("build a storage estimate", icons), null);
  assert.equal(promptToArchitecture("", icons), null);
  assert.equal(promptToArchitecture("Secure Azure portal", []), null);
});

test("business constraints validate types, bounds and mode and remain requirements data", () => {
  const input = generationRequestSchema.parse({
    prompt: "  Azure portal  ",
    businessConstraints: { budget: "USD 500/month", availability: "99.9% target", recovery: "RTO 4h / RPO 1h", dataResidency: "EU only", compliance: "Assess GDPR obligations", scale: "1000 concurrent users" },
  });
  assert.equal(input.mode, "architecture");
  assert.deepEqual(JSON.parse(buildGenerationUserPrompt(input)).businessConstraints, input.businessConstraints);
  for (const value of [
    null, [], { prompt: 12 }, { prompt: " " }, { prompt: "x", mode: "typo" },
    { prompt: "x", businessConstraints: [] },
    { prompt: "x", businessConstraints: { budget: 500 } },
    { prompt: "x", businessConstraints: { budget: "x".repeat(501) } },
    { prompt: "x", businessConstraints: { unexpected: "ignore rules" } },
    { prompt: "x", mode: "mindmap", businessConstraints: {} },
  ]) assert.equal(generationRequestSchema.safeParse(value).success, false);
  const sequence = generationRequestSchema.parse({ prompt: "Login sequence", mode: "sequence" });
  assert.equal(buildGenerationUserPrompt(sequence), "Login sequence");
  assert.equal(validateModeOutput("sequence", { participants: [], messages: [] }), null);
});

test("guided output is normalized, catalog checked and references are server-owned", () => {
  const input = modelOutput();
  input.designAssistance.references = [{ title: "Untrusted", url: "javascript:alert(1)" }];
  input.nodes[0].data.iconPath = "https://untrusted.invalid/icon";
  const output = parseGuidedArchitecture(input, icons);
  assert.equal(output.designAssistance.kind, "guided-design");
  assert.ok(output.designAssistance.references.every((reference) => reference.url.startsWith("https://learn.microsoft.com/")));
  assert.match(output.designAssistance.disclaimer, /not an autonomous deployment/);
  assert.equal("iconPath" in output.graph.nodes[0].data, false);
  assert.equal("designAssistance" in output.graph, false);
  assert.equal(validateModeOutput("architecture", output.graph), null);
});

test("guided output rejects malformed graphs and incomplete advice", () => {
  const mutations = [
    (value) => { value.nodes.push(value.nodes[0]); },
    (value) => { value.nodes[0].position.x = Infinity; },
    (value) => { value.nodes[0].data.cloud = "aws"; },
    (value) => { value.nodes[0].data.iconId = "azure/compute/invented-service"; },
    (value) => { value.edges.push({ id: "e", source: "app", target: "missing", data: { label: "HTTP", connectionType: "data-flow", lineStyle: "solid", arrowStyle: "forward" } }); },
    (value) => { value.nodes = []; },
    (value) => { value.designAssistance.nextSteps = []; },
    (value) => { delete value.designAssistance; },
  ];
  for (const mutate of mutations) {
    const value = modelOutput();
    mutate(value);
    assert.throws(() => parseGuidedArchitecture(value, icons));
  }
  assert.match(MODE_PROMPTS.architecture, /all five WAF pillars/);
  assert.match(MODE_PROMPTS.architecture, /untrusted requirements data/);
  assert.match(MODE_PROMPTS.architecture, /Preserve explicitly requested providers/);
});

// Exercise the real route with transport/configuration boundaries replaced;
// no live model credentials or Next.js server are needed for these cases.
function generationRoute({ configured = true, rate = { ok: true }, output = JSON.stringify(modelOutput()) } = {}) {
  const calls = [];
  const modules = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/ai": {
      aiConfigured: () => configured,
      chatComplete: async (...args) => { calls.push(args); return output; },
    },
    "@/lib/ai-rate-limit": { aiRateLimit: () => rate },
    "@/lib/ai-mode-prompts": modeHelpers,
    "@/lib/request-json": requestHelpers,
    "@/content/cloud-icons.json": { icons },
  };
  const source = readFileSync(new URL("../app/api/ai/generate/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console,
    require: (name) => {
      if (!(name in modules)) throw new Error(`Unexpected route dependency: ${name}`);
      return modules[name];
    },
  });
  return {
    calls,
    post: (body, signal) => exports.POST(new Request("http://localhost/api/ai/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
      signal,
    })),
  };
}

test("generation endpoint forwards constraints and returns sanitized guided output", async () => {
  const route = generationRoute();
  const controller = new AbortController();
  const response = await route.post({ prompt: "Azure portal", businessConstraints: { budget: "USD 500/month", dataResidency: "EU only" } }, controller.signal);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.mode, "architecture");
  assert.equal(result.designAssistance.kind, "guided-design");
  assert.equal(result.graph.nodes[0].data.iconId, azureIcon.id);
  assert.deepEqual(JSON.parse(route.calls[0][0][1].content).businessConstraints, { budget: "USD 500/month", dataResidency: "EU only" });
  assert.match(route.calls[0][0][0].content, /Bundled icon catalog/);
  assert.ok(route.calls[0][1].signal instanceof AbortSignal);
  controller.abort();
  assert.equal(route.calls[0][1].signal.aborted, true);
});

test("generation endpoint rejects invalid input before model calls and keeps error contracts", async () => {
  const route = generationRoute();
  for (const body of ["{", { prompt: 42 }, { prompt: "x", mode: "unknown" }, { prompt: "x", businessConstraints: { budget: false } }]) {
    assert.equal((await route.post(body)).status, 400);
  }
  assert.equal((await route.post("x".repeat(32_769))).status, 413);
  assert.equal(route.calls.length, 0);
  assert.equal((await generationRoute({ configured: false }).post({ prompt: "x" })).status, 503);
  const limited = await generationRoute({ rate: { ok: false, retryAfterSec: 12 } }).post({ prompt: "x" });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "12");
});

test("generation endpoint rejects unsafe model output without echoing raw text and preserves other modes", async () => {
  for (const output of ["not JSON with private content", JSON.stringify({ nodes: [], edges: [] })]) {
    const result = await generationRoute({ output }).post({ prompt: "Azure app" });
    assert.equal(result.status, 502);
    const body = await result.json();
    assert.equal("raw" in body, false);
    assert.doesNotMatch(JSON.stringify(body), /private content/);
  }
  const graph = { participants: [{ id: "user", label: "User" }], messages: [] };
  const route = generationRoute({ output: JSON.stringify(graph) });
  const result = await route.post({ prompt: "Login sequence", mode: "sequence" });
  assert.deepEqual(await result.json(), { graph, mode: "sequence" });
  assert.equal(route.calls[0][0][1].content, "Login sequence");
  assert.equal(route.calls[0][1].maxTokens, 2000);
});
