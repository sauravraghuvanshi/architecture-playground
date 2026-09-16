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
  generateGuidedArchitecture,
  GUIDED_ARCHITECTURE_JSON_SCHEMA,
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

test("generation prompt includes the complete schema and cross-field catalog rules", () => {
  const schema = GUIDED_ARCHITECTURE_JSON_SCHEMA;
  assert.ok(MODE_PROMPTS.architecture.includes(JSON.stringify(schema, null, 2)));
  assert.deepEqual(schema.required, ["metadata", "nodes", "edges", "designAssistance"]);
  assert.deepEqual(schema.properties.metadata.required, ["name", "description"]);
  const nodes = schema.properties.nodes;
  assert.equal(nodes.minItems, 1);
  assert.equal(nodes.maxItems, 60);
  assert.deepEqual(nodes.items.required, ["id", "type", "position", "data"]);
  assert.equal(nodes.items.properties.id.maxLength, 100);
  assert.equal(nodes.items.properties.id.pattern, "^[a-zA-Z0-9_-]+$");
  assert.equal(nodes.items.properties.position.properties.x.minimum, -100_000);
  assert.equal(nodes.items.properties.position.properties.y.maximum, 100_000);
  assert.deepEqual(nodes.items.properties.data.properties.cloud.enum, ["azure", "aws", "gcp"]);
  assert.equal(schema.properties.edges.maxItems, 180);
  assert.equal(schema.properties.edges.items.properties.data.properties.connectionType.const, "data-flow");
  assert.deepEqual(schema.properties.edges.items.properties.data.properties.lineStyle.enum, ["solid", "dashed"]);
  for (const field of ["assumptions", "recommendations", "tradeoffs", "nextSteps"]) {
    assert.ok(schema.properties.designAssistance.required.includes(field));
    const list = schema.properties.designAssistance.properties[field];
    assert.equal(list.minItems, 1);
    assert.equal(list.maxItems, 12);
    assert.equal(list.items.minLength, 1);
    assert.equal(list.items.maxLength, 1200);
  }
  assert.match(MODE_PROMPTS.architecture, /distinct existing node IDs/);
  assert.match(MODE_PROMPTS.architecture, /Copy the entire icon ID verbatim/);
});

test("real manifest IDs satisfy the graph schema but plausible aliases fail catalog membership", () => {
  for (const icon of icons) {
    const value = modelOutput();
    value.nodes[0].data = { iconId: icon.id, label: icon.label, cloud: icon.cloud };
    assert.equal(validateModeOutput("architecture", value), null, icon.id);
  }
  assert.ok(icons.some((icon) => icon.id === "azure/data/sql-database"));
  for (const alias of ["azure/compute/app-service", "azure/application/app-service", "azure/databases/sql-database"]) {
    const value = modelOutput();
    value.nodes[0].data.iconId = alias;
    assert.equal(validateModeOutput("architecture", value), null, "ID syntax alone is insufficient");
    assert.throws(() => parseGuidedArchitecture(value, icons), (error) => {
      assert.deepEqual(error.issues[0].path, ["nodes", 0, "data", "iconId"]);
      assert.match(error.issues[0].message, /exact icon ID/);
      return true;
    });
    assert.equal(value.nodes[0].data.iconId, alias, "never remap an invalid model ID");
  }
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
function generationRoute({ configured = true, rate = { ok: true }, output = JSON.stringify(modelOutput()), complete } = {}) {
  const calls = [];
  const logs = [];
  const modules = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/ai": {
      aiConfigured: () => configured,
      chatComplete: async (messages, options) => {
        calls.push([structuredClone(messages), { ...options }]);
        return complete ? complete(messages, options) : output;
      },
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
    exports, console: { ...console, error: (...args) => logs.push(args) },
    require: (name) => {
      if (!(name in modules)) throw new Error(`Unexpected route dependency: ${name}`);
      return modules[name];
    },
  });
  return {
    calls,
    logs,
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
  assert.equal(route.calls.length, 1);
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
    const route = generationRoute({ output });
    const result = await route.post({ prompt: "Azure app" });
    assert.equal(result.status, 502);
    assert.equal(route.calls.length, 2);
    const body = await result.json();
    assert.equal("raw" in body, false);
    assert.doesNotMatch(JSON.stringify(body), /private content/);
    assert.doesNotMatch(JSON.stringify(route.logs), /private content/);
  }
  const payloads = {
    flowchart: { nodes: [], edges: [] },
    mindmap: { nodes: [], edges: [] },
    sequence: { participants: [{ id: "user", label: "User" }], messages: [] },
    er: { entities: [], relationships: [] },
    uml: { classes: [], relations: [] },
    c4: { nodes: [], edges: [] },
    kanban: { columns: [], cards: {} },
  };
  for (const [mode, graph] of Object.entries(payloads)) {
    const route = generationRoute({ output: JSON.stringify(graph) });
    const result = await route.post({ prompt: "Synthetic diagram", mode });
    assert.deepEqual(await result.json(), { graph, mode });
    assert.equal(route.calls.length, 1);
    assert.equal(route.calls[0][0][0].content, MODE_PROMPTS[mode]);
    assert.equal(route.calls[0][0][1].content, "Synthetic diagram");
    assert.equal(route.calls[0][1].maxTokens, 2000);
    for (const invalid of ["not JSON", "{}"]) {
      const invalidRoute = generationRoute({ output: invalid });
      assert.equal((await invalidRoute.post({ prompt: "Synthetic diagram", mode })).status, 502);
      assert.equal(invalidRoute.calls.length, 1, `${mode} keeps its single-attempt behavior`);
    }
  }
});

const syntheticGenerationInput = {
  prompt: "Create a simple Azure App Service connected to Azure SQL Database.",
  businessConstraints: { budget: "Small prototype", recovery: "RTO four hours; RPO one hour", dataResidency: "East US only" },
};

test("generation corrects JSON, schema, reference and catalog failures once while preserving requirements", async () => {
  const unknownIcon = modelOutput();
  unknownIcon.nodes[0].data.iconId = "azure/compute/app-service";
  const missingAdvice = modelOutput();
  delete missingAdvice.designAssistance;
  const wrongEnum = modelOutput();
  wrongEnum.nodes[0].type = "icon";
  const missingPosition = modelOutput();
  delete missingPosition.nodes[0].position;
  const danglingEdge = modelOutput();
  danglingEdge.edges = [{ id: "e", source: "app", target: "missing", data: { label: "", connectionType: "data-flow", lineStyle: "dashed", arrowStyle: "forward" } }];
  for (const [invalid, issuePath] of [
    ["```json\n{", "invalid_json"],
    [JSON.stringify(unknownIcon), "nodes.0.data.iconId"],
    [JSON.stringify(missingAdvice), "designAssistance"],
    [JSON.stringify(wrongEnum), "nodes.0.type"],
    [JSON.stringify(missingPosition), "nodes.0.position"],
    [JSON.stringify(danglingEdge), "distinct existing nodes"],
  ]) {
    const corrected = modelOutput();
    let count = 0;
    const route = generationRoute({ complete: async () => ++count === 1 ? invalid : JSON.stringify(corrected) });
    const response = await route.post(syntheticGenerationInput);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ...parseGuidedArchitecture(corrected, icons), mode: "architecture" });
    assert.equal(route.calls.length, 2);
    const [first, second] = route.calls;
    assert.equal(first[0].length, 2);
    assert.equal(second[0].length, 4);
    assert.deepEqual(second[0].slice(0, 2), first[0]);
    assert.deepEqual(JSON.parse(second[0][1].content), {
      description: syntheticGenerationInput.prompt,
      businessConstraints: syntheticGenerationInput.businessConstraints,
    });
    assert.equal(second[0][0].content, `${MODE_PROMPTS.architecture}\nBundled icon catalog (exact IDs):\n${icons.map((icon) => icon.id).join("\n")}`);
    assert.equal(second[0][2].role, "assistant");
    assert.equal(second[0][2].content, invalid);
    assert.ok(second[0][3].content.includes(issuePath));
    assert.match(second[0][3].content, /Do not substitute services or invent requirements/);
    assert.match(second[0][3].content, /untrusted output to correct/);
    assert.equal(first[1].signal, second[1].signal);
    assert.equal(first[1].temperature, 0.4);
    assert.equal(second[1].temperature, 0);
    assert.equal(second[1].maxTokens, 5000);
    assert.equal(second[1].responseFormat, "json_object");
  }
});

test("invalid corrections fail closed without defaults, enum coercion or catalog remapping", async () => {
  const invalidOutputs = [
    (value) => { delete value.nodes[0].position; },
    (value) => { value.nodes[0].data.iconId = "azure/compute/app-service"; },
    (value) => { value.nodes[0].data.cloud = "Azure"; },
    (value) => { value.nodes[0].id = "service.app"; },
    (value) => { value.designAssistance.assumptions = []; },
  ];
  for (const mutate of invalidOutputs) {
    const invalid = modelOutput();
    mutate(invalid);
    const route = generationRoute({ output: JSON.stringify(invalid) });
    const response = await route.post(syntheticGenerationInput);
    assert.equal(response.status, 502);
    assert.equal(route.calls.length, 2);
    assert.deepEqual(await response.json(), { error: "AI request failed. Please try again." });
  }
});

test("generation bounds correction history and diagnostics", async () => {
  const invalid = modelOutput();
  invalid.nodes = Array.from({ length: 60 }, (_, index) => ({
    ...invalid.nodes[0], id: `n${index}`, data: { ...invalid.nodes[0].data, iconId: `azure/compute/unknown-${index}` },
  }));
  invalid.untrustedText = "untrusted ".repeat(4000);
  let count = 0;
  const route = generationRoute({ complete: async () => JSON.stringify(++count === 1 ? invalid : modelOutput()) });
  assert.equal((await route.post(syntheticGenerationInput)).status, 200);
  const correction = route.calls[1][0];
  assert.equal(correction[2].content.length, 32_000);
  assert.match(correction[3].content, /previous response was truncated/);
  const diagnostics = JSON.parse(correction[3].content.split("Validation issues: ")[1].split("\n")[0]);
  assert.equal(diagnostics.length, 8);
  assert.ok(diagnostics.every((issue) => issue.path.length <= 160 && issue.message.length <= 500));
});

test("transport exceptions never trigger validation retries or leak raw error details", async () => {
  for (const error of [
    new Error("private transport details"),
    new SyntaxError("private response parsing details"),
    modeHelpers.generatedArchitectureSchema.safeParse({}).error,
  ]) {
    const route = generationRoute({ complete: async () => { throw error; } });
    const response = await route.post(syntheticGenerationInput);
    assert.equal(response.status, 502);
    assert.equal(route.calls.length, 1);
    assert.deepEqual(await response.json(), { error: "AI request failed. Please try again." });
    assert.doesNotMatch(JSON.stringify(route.logs), /private/);
  }
  let transportCalls = 0;
  const failingCorrection = generationRoute({ complete: async () => {
    if (++transportCalls === 1) return "{}";
    throw new Error("private correction transport details");
  } });
  const failed = await failingCorrection.post(syntheticGenerationInput);
  assert.equal(failed.status, 502);
  assert.equal(failingCorrection.calls.length, 2);
  assert.deepEqual(await failed.json(), { error: "AI request failed. Please try again." });
  const failure = new Error("Unexpected catalog accessor failure");
  let calls = 0;
  let catalogReads = 0;
  await assert.rejects(generateGuidedArchitecture(
    generationRequestSchema.parse(syntheticGenerationInput),
    [{ get id() {
      if (++catalogReads === 1) return azureIcon.id;
      throw failure;
    } }],
    async () => { calls++; return JSON.stringify(modelOutput()); },
  ), (error) => error === failure);
  assert.equal(calls, 1);
});

test("cancellation prevents initial generation, corrections and late success", async () => {
  const input = generationRequestSchema.parse(syntheticGenerationInput);
  const alreadyAborted = new AbortController();
  alreadyAborted.abort();
  let calls = 0;
  await assert.rejects(generateGuidedArchitecture(input, icons, async () => {
    calls++;
    return JSON.stringify(modelOutput());
  }, alreadyAborted.signal), { name: "AbortError" });
  assert.equal(calls, 0);
  for (const output of ["{}", JSON.stringify(modelOutput())]) {
    const controller = new AbortController();
    calls = 0;
    await assert.rejects(generateGuidedArchitecture(input, icons, async () => {
      calls++;
      controller.abort();
      return output;
    }, controller.signal), { name: "AbortError" });
    assert.equal(calls, 1);
  }
  const controller = new AbortController();
  calls = 0;
  await assert.rejects(generateGuidedArchitecture(input, icons, async () => {
    if (++calls === 1) return "{}";
    controller.abort();
    return JSON.stringify(modelOutput());
  }, controller.signal), { name: "AbortError" });
  assert.equal(calls, 2);
});

test("both attempts share a single 120-second deadline, including correction time", async (t) => {
  const deadline = new AbortController();
  let deadlines = 0;
  t.mock.method(AbortSignal, "timeout", (duration) => {
    assert.equal(duration, 120_000);
    deadlines++;
    return deadline.signal;
  });
  const input = generationRequestSchema.parse(syntheticGenerationInput);
  let calls = 0;
  await assert.rejects(generateGuidedArchitecture(input, icons, async (_messages, options) => {
    assert.equal(options.signal, deadline.signal);
    if (++calls === 1) return "{}";
    deadline.abort(new DOMException("Generation deadline exceeded", "TimeoutError"));
    return JSON.stringify(modelOutput());
  }), { name: "TimeoutError" });
  assert.equal(calls, 2);
  assert.equal(deadlines, 1);
});
