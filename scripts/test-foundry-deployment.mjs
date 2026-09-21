import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { randomUUID, webcrypto } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
import { AIProjectClient } from "@azure/ai-projects";
import { z } from "zod";
import * as deployment from "../lib/deployment-assistance.ts";
import * as document from "../lib/architecture-document.ts";
import * as bounded from "../lib/request-json.ts";
import * as codegen from "../components/diagrammatic/csa/architecture-codegen.ts";
import * as privacy from "../lib/foundry-contract.ts";
import * as aiPrivacyContract from "../lib/ai-privacy-contract.ts";
import * as engineeringContract from "../lib/engineering-validation-contract.ts";
import * as engineeringCoverage from "../lib/engineering-coverage.ts";
import { ArtifactParserError } from "../lib/artifact-parser.ts";

function validationFixture(canPublish = true) {
  return {
    version: 1, profile: "azure-static-v1", artifactHash: "a".repeat(64), checkedAt: "2026-09-20T00:00:00.000Z",
    status: canPublish ? "passed-static-checks" : "needs-review", canPublish,
    checks: ["syntax", "resource-mappings", "coverage", "prerequisites", "artifact-consistency", "azure-environment"].map((id) => ({
      id, status: id === "azure-environment" || (!canPublish && id === "artifact-consistency") ? "not-verified" : "passed",
      summary: "Mocked component boundary; real parsers are tested separately.", details: [],
    })),
    coverage: [], parser: { name: "test-fixture", version: "1" }, disclaimer: engineeringContract.ENGINEERING_VALIDATION_DISCLAIMER,
  };
}

function load(path, dependencies, globals = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console, URL, Request, Response, AbortSignal, AbortController, TextEncoder, TextDecoder,
    crypto: webcrypto, btoa, atob, setTimeout, clearTimeout, ...globals,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

const env = {
  AZURE_AI_PROJECT_ENDPOINT: "https://test-foundry.services.ai.azure.com/api/projects/test-project",
  AZURE_AI_REVIEW_AGENT_NAME: "review-agent",
  AZURE_AI_DEPLOY_AGENT_NAME: "deployment-agent",
  NEXT_PUBLIC_SITE_URL: "https://diagram.example",
};
const payload = {
  nodes: [{ kind: "icon", id: "app", label: "Customer app", iconId: "azure/application/application-service", iconPath: "/cloud-icons/azure/application/application-service.svg", x: 0, y: 0 }],
  edges: [],
};
const arm = () => ({
  $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  contentVersion: "1.0.0.0",
  parameters: { location: { type: "string", defaultValue: "[resourceGroup().location]" } },
  resources: [{ type: "Microsoft.Web/sites", apiVersion: "2024-04-01", name: "customer-app", location: "[parameters('location')]", properties: { httpsOnly: true } }],
});
const draft = () => ({
  format: "bicep", code: "param location string = resourceGroup().location",
  armTemplate: arm(), warnings: ["Validate using What-If before deployment."],
  assumptions: ["An existing plan must be selected."],
  resourceMappings: [{ nodeId: "app", resourceType: "Microsoft.Web/sites", resourceName: "customer-app" }],
});
const request = (body, signal) => new Request("https://diagram.example/api/ai/deploy", {
  method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), signal,
});

function foundryHarness({ response = { status: "completed", output_text: '{"ok":true}' }, failure, environment = env, pending = false, timeoutSignal } = {}) {
  const calls = [];
  const clients = [];
  class Credential {}
  class Projects {
    constructor(endpoint, credential) { clients.push({ endpoint, credential }); }
    getOpenAIClient(options) {
      clients.at(-1).options = options;
      return { responses: { create: async (...args) => {
        calls.push(args);
        if (failure) throw failure;
        if (pending) return new Promise(() => {});
        return response;
      } } };
    }
  }
  const timeoutValues = [];
  const signalApi = {
    timeout: (ms) => { timeoutValues.push(ms); return timeoutSignal ?? AbortSignal.timeout(ms); },
    any: (signals) => AbortSignal.any(signals),
  };
  const loaded = load("lib/foundry-agent.ts", {
    "@azure/ai-projects": { AIProjectClient: Projects },
    "@azure/identity": { DefaultAzureCredential: Credential },
  }, { process: { env: environment }, AbortSignal: signalApi });
  return { ...loaded, calls, clients, timeoutValues };
}

test("Foundry invokes the named role agent with Entra auth, stateless requests and tools disabled", async () => {
  const agent = foundryHarness();
  const image = [{ role: "user", content: [{ type: "input_text", text: "Review evidence" }, { type: "input_image", image_url: "data:image/png;base64,AAAA", detail: "auto" }] }];
  assert.equal(await agent.invokeFoundryAgent("review", "Return JSON", image), '{"ok":true}');
  await agent.invokeFoundryAgent("deployment", "Generate JSON", "diagram");
  const retryInput = [
    ...image,
    { role: "assistant", content: '{"invalid":"first response"}' },
    { role: "user", content: "Correct the schema without changing the original evidence." },
  ];
  await agent.invokeFoundryAgent("review", "Return corrected JSON", retryInput);
  assert.equal(agent.calls.length, 3);
  for (const [body, options] of agent.calls) {
    assert.equal(body.store, false);
    assert.equal(body.tool_choice, "none");
    assert.equal("model" in body, false);
    assert.equal("instructions" in body, false);
    assert.equal("text" in body, false);
    assert.equal("conversation" in body, false);
    assert.equal("previous_response_id" in body, false);
    assert.equal(body.input[0].role, "developer");
    assert.ok(body.input.every((message) => message.type === "message"));
    assert.ok(options.signal instanceof AbortSignal);
  }
  assert.equal(agent.calls[0][1].body.agent_reference.name, "review-agent");
  assert.equal(agent.calls[1][1].body.agent_reference.name, "deployment-agent");
  assert.equal(agent.calls[0][1].body.agent_reference.type, "agent_reference");
  assert.deepEqual(JSON.parse(JSON.stringify(agent.calls[0][0].input)), [
    { type: "message", role: "developer", content: "Return JSON" },
    ...image.map((message) => ({ ...message, type: "message" })),
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(agent.calls[1][0].input)), [
    { type: "message", role: "developer", content: "Generate JSON" },
    { type: "message", role: "user", content: "diagram" },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(agent.calls[2][0].input)), [
    { type: "message", role: "developer", content: "Return corrected JSON" },
    ...retryInput.map((message) => ({ ...message, type: "message" })),
  ]);
  assert.equal(agent.calls[2][0].input[1].content[1].image_url, "data:image/png;base64,AAAA");
  assert.equal(agent.calls[2][1].body.agent_reference.name, "review-agent");
  assert.equal(agent.clients[0].options.maxRetries, 0);
  assert.equal(agent.clients[0].endpoint, env.AZURE_AI_PROJECT_ENDPOINT);
  assert.equal(agent.timeoutValues[0], 120_000);
});

test("installed Foundry SDK sends service-compatible named-agent messages without forbidden overrides", async () => {
  let sent;
  class Credential {
    async getToken() { return { token: "test-only-token", expiresOnTimestamp: Date.now() + 60_000 }; }
  }
  class Projects extends AIProjectClient {
    getOpenAIClient(options) {
      const client = super.getOpenAIClient(options);
      // Replace the public transport so this check cannot contact a project.
      client.fetch = async (url, options) => {
      assert.match(String(url), /\/openai\/v1\/responses/);
      sent = JSON.parse(options.body);
      assert.equal("instructions" in sent, false, "named agents reject top-level instructions");
      assert.equal("text" in sent, false, "named agents reject top-level output format");
      assert.ok(sent.input.every((message) => message.type === "message"), "Foundry requires explicit message discriminators");
      return Response.json({
        id: "resp-test", object: "response", created_at: 1, status: "completed",
        output: [{ id: "msg-test", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: '{"ok":true}', annotations: [] }] }],
      });
      };
      return client;
    }
  }
  const agent = load("lib/foundry-agent.ts", {
    "@azure/ai-projects": { AIProjectClient: Projects },
    "@azure/identity": { DefaultAzureCredential: Credential },
  }, { process: { env } });
  await agent.invokeFoundryAgent("deployment", "Return JSON", "diagram");
  assert.deepEqual(sent.input, [
    { type: "message", role: "developer", content: "Return JSON" },
    { type: "message", role: "user", content: "diagram" },
  ]);
  assert.equal(sent.store, false);
  assert.equal(sent.tool_choice, "none");
  assert.equal(sent.agent_reference.name, "deployment-agent");
  const correction = [
    { role: "user", content: [{ type: "input_image", image_url: "data:image/png;base64,AAAA", detail: "high" }] },
    { role: "assistant", content: '{"invalid":"first response"}' },
    { role: "user", content: "Correct only the response schema." },
  ];
  await agent.invokeFoundryAgent("review", "Return corrected JSON", correction);
  assert.deepEqual(sent.input, [
    { type: "message", role: "developer", content: "Return corrected JSON" },
    ...correction.map((message) => ({ ...message, type: "message" })),
  ]);
  assert.equal(sent.agent_reference.name, "review-agent");
  assert.equal(sent.store, false);
});

test("Foundry rejects missing/unsafe configuration without fallback or outbound calls", async () => {
  for (const endpoint of [undefined, "http://localhost/api/projects/x", "https://attacker.invalid/api/projects/x", `${env.AZURE_AI_PROJECT_ENDPOINT}?key=secret`]) {
    const agent = foundryHarness({ environment: { ...env, AZURE_AI_PROJECT_ENDPOINT: endpoint } });
    assert.equal(agent.isFoundryAgentConfigured("deployment"), false);
    await assert.rejects(agent.invokeFoundryAgent("deployment", "instructions", "input"), { status: 503 });
    assert.equal(agent.calls.length, 0);
  }
  const oneRole = foundryHarness({ environment: { ...env, AZURE_AI_DEPLOY_AGENT_NAME: "" } });
  assert.equal(oneRole.isFoundryAgentConfigured("review"), true);
  assert.equal(oneRole.isFoundryAgentConfigured("deployment"), false);
});

test("Foundry cancellation and timeout are bounded and provider errors are redacted", async () => {
  const before = new AbortController();
  before.abort();
  const cancelled = foundryHarness();
  await assert.rejects(cancelled.invokeFoundryAgent("review", "instructions", "input", before.signal), { status: 499 });
  assert.equal(cancelled.calls.length, 0);
  const controller = new AbortController();
  const active = foundryHarness({ pending: true });
  const result = active.invokeFoundryAgent("review", "instructions", "input", controller.signal);
  controller.abort();
  await assert.rejects(result, { status: 499 });
  assert.equal(active.calls[0][1].signal.aborted, true);
  const timeout = new AbortController();
  const slow = foundryHarness({ pending: true, timeoutSignal: timeout.signal });
  const pending = slow.invokeFoundryAgent("deployment", "instructions", "input");
  timeout.abort();
  await assert.rejects(pending, { status: 504 });
  const failed = foundryHarness({ failure: new Error("Bearer top-secret https://tenant.private/internal") });
  await assert.rejects(failed.invokeFoundryAgent("review", "instructions", "input"), (error) => {
    assert.equal(error.status, 502);
    assert.doesNotMatch(error.message, /top-secret|tenant\.private/);
    return true;
  });
  for (const response of [{ status: "incomplete", output_text: "{}" }, { status: "completed", output_text: "" }]) {
    await assert.rejects(foundryHarness({ response }).invokeFoundryAgent("review", "i", "x"), { status: 502 });
  }
});

test("deployment drafts bind every ARM resource to evidence and preserve explicit coverage gaps", () => {
  const evidence = { nodes: [...payload.nodes, { kind: "shape", id: "unknown", label: "External dependency" }] };
  const result = deployment.parseDeploymentDraft(draft(), evidence, "bicep");
  assert.equal(result.source, "foundry-agent");
  assert.deepEqual(result.excludedNodeIds, ["unknown"]);
  assert.match(result.warnings.at(-1), /no ARM resource mapping/);
  assert.match(result.disclaimer, /Nothing is executed/);
  for (const mutate of [
    (value) => { value.resourceMappings[0].nodeId = "invented"; },
    (value) => { value.resourceMappings[0].resourceName = "invented"; },
    (value) => { value.resourceMappings = []; },
    (value) => { value.resourceMappings.push(value.resourceMappings[0]); },
    (value) => { value.format = "powershell"; },
    (value) => { value.armTemplate.resources = []; },
  ]) {
    const value = draft(); mutate(value);
    assert.throws(() => deployment.parseDeploymentDraft(value, payload, "bicep"));
  }
  assert.throws(() => deployment.parseDeploymentDraft(draft(), { nodes: [{ ...payload.nodes[0], iconId: "aws/compute/lambda" }] }, "bicep"));
});

function draftWithSupportingPlan(format = "bicep") {
  const value = draft();
  value.format = format;
  value.armTemplate.resources.unshift({
    type: "Microsoft.Web/serverfarms", apiVersion: "2024-04-01",
    name: "[parameters('planName')]", location: "[parameters('location')]", properties: {},
  });
  value.armTemplate.parameters.planName = { type: "string" };
  value.resourceMappings.unshift({
    nodeId: "app", resourceType: "Microsoft.Web/serverfarms", resourceName: "[parameters('planName')]",
  });
  return value;
}

test("supporting resources need their own exact mapping to an existing node in every format", () => {
  for (const format of deployment.DEPLOYMENT_FORMATS) {
    const value = draftWithSupportingPlan(format);
    assert.equal(deployment.parseDeploymentDraft(value, payload, format).resourceMappings.length, 2);
    value.resourceMappings.shift();
    assert.throws(() => deployment.parseDeploymentDraft(value, payload, format), (error) => {
      assert.deepEqual(error.issues[0].path, ["resourceMappings"]);
      assert.equal(error.issues[0].code, "custom");
      return true;
    });
  }
  const wrongExpression = draftWithSupportingPlan();
  wrongExpression.resourceMappings[0].resourceName = "planName";
  assert.throws(() => deployment.parseDeploymentDraft(wrongExpression, payload, "bicep"), z.ZodError);
  assert.match(deployment.DEPLOYMENT_AGENT_INSTRUCTIONS, /iterating over EVERY entry in armTemplate\.resources/);
  assert.match(deployment.DEPLOYMENT_AGENT_INSTRUCTIONS, /TWO mappings with nodeId "app"/);
  assert.deepEqual(deployment.DEPLOYMENT_DRAFT_JSON_SCHEMA.properties.format.enum, [...deployment.DEPLOYMENT_FORMATS]);
});

test("deployment prompt uses documented Web resource root shapes without claiming deployed security", () => {
  const [plan, site] = deployment.WEB_RESOURCE_SHAPE_EXAMPLES;
  assert.equal(plan.type, "Microsoft.Web/serverfarms");
  assert.equal(plan.kind, "app");
  assert.equal(plan.sku.name, "[parameters('planSku')]");
  assert.equal(site.type, "Microsoft.Web/sites");
  assert.deepEqual(site.identity, { type: "SystemAssigned" });
  for (const resource of [plan, site]) {
    for (const property of ["kind", "identity", "sku"]) assert.equal(property in resource.properties, false);
  }
  assert.equal(site.properties.httpsOnly, true);
  assert.equal(site.properties.siteConfig.minTlsVersion, "1.2");
  const template = arm();
  template.parameters = Object.fromEntries(["location", "planName", "planSku", "siteName"].map((name) => [name, { type: "string" }]));
  template.resources = deployment.WEB_RESOURCE_SHAPE_EXAMPLES;
  assert.equal(deployment.parseArmTemplate(template).resources.length, 2);
  assert.match(deployment.DEPLOYMENT_AGENT_INSTRUCTIONS, /never properties\.identity/);
  assert.match(deployment.DEPLOYMENT_AGENT_INSTRUCTIONS, /do not add a redundant Bicep dependsOn/);
  assert.match(deployment.DEPLOYMENT_AGENT_INSTRUCTIONS, /NOT observed or verified deployed security/);
});

test("Bicep syntax example is supplied only for Bicep generation and correction", async () => {
  for (const format of ["bicep", "powershell"]) {
    let calls = 0;
    await deployment.generateDeploymentDraft(payload, format, "", async (instructions) => {
      calls++;
      assert.equal(instructions.includes(deployment.WEB_BICEP_SHAPE_EXAMPLE), format === "bicep");
      return calls === 1 ? "{}" : JSON.stringify(draftWithSupportingPlan(format));
    });
    assert.equal(calls, 2);
  }
});

test("deployment generation corrects the observed missing-plan mapping without changing evidence", async () => {
  const valid = draftWithSupportingPlan();
  const missing = structuredClone(valid);
  missing.resourceMappings.shift();
  const calls = [];
  const result = await deployment.generateDeploymentDraft(payload, "bicep", "User chooses region.", async (...args) => {
    calls.push(structuredClone({ instructions: args[0], input: args[1] }));
    return JSON.stringify(calls.length === 1 ? missing : valid);
  });
  assert.equal(result.resourceMappings.length, 2);
  assert.equal(calls.length, 2);
  assert.deepEqual(JSON.parse(calls[0].input), { format: "bicep", context: "User chooses region.", diagram: payload });
  assert.equal(calls[1].input[0].content, calls[0].input);
  assert.equal(calls[1].input[1].role, "assistant");
  assert.match(calls[1].input[2].content, /resourceMappings/);
  assert.match(calls[1].input[2].content, /Do not remove required resources/);
  assert.equal(calls[0].instructions, calls[1].instructions);
});

test("deployment correction retains security checks, retries validation only and never returns rejected drafts", async () => {
  for (const initial of [
    "not JSON",
    JSON.stringify({ ...draft(), format: "terraform" }),
    JSON.stringify({ ...draft(), armTemplate: { ...arm(), outputs: { key: { value: "[listKeys('x','2024-01-01')]" } } } }),
  ]) {
    let calls = 0;
    const result = await deployment.generateDeploymentDraft(payload, "bicep", "", async () => {
      calls++;
      return calls === 1 ? initial : JSON.stringify(draft());
    });
    assert.equal(calls, 2);
    assert.equal(result.format, "bicep");
  }
  let calls = 0;
  await assert.rejects(deployment.generateDeploymentDraft(payload, "bicep", "", async () => {
    calls++;
    return JSON.stringify({ ...draft(), resourceMappings: [] });
  }), deployment.DeploymentDraftError);
  assert.equal(calls, 2);
  calls = 0;
  const transport = new Error("transport unavailable");
  await assert.rejects(deployment.generateDeploymentDraft(payload, "bicep", "", async () => {
    calls++;
    throw transport;
  }), (error) => error === transport);
  assert.equal(calls, 1);
});

test("deployment validation reports safe ARM paths while retaining security rejection", () => {
  const value = draft();
  value.armTemplate.resources[0].properties.adminPassword = "synthetic-not-a-real-secret";
  assert.throws(() => deployment.parseDeploymentDraft(value, payload, "bicep"), (error) => {
    assert.deepEqual(error.issues[0].path, ["armTemplate", "resources", 0, "properties", "adminPassword"]);
    assert.doesNotMatch(error.message, /synthetic-not-a-real-secret/);
    return true;
  });
});

test("deployment correction shares one deadline and bounds previous output", async () => {
  const timeout = new AbortController();
  const deadlines = [];
  const helper = load("lib/deployment-assistance.ts", { zod: { z } }, {
    AbortSignal: {
      timeout: (ms) => { deadlines.push(ms); return timeout.signal; },
      any: (signals) => AbortSignal.any(signals),
    },
  });
  const signals = [];
  await assert.rejects(helper.generateDeploymentDraft(payload, "bicep", "", async (_instructions, _input, signal) => {
    signals.push(signal);
    if (signals.length === 1) return "{}";
    timeout.abort();
    throw new Error("aborted transport");
  }), (error) => error instanceof helper.DeploymentDraftError && error.status === 504);
  assert.deepEqual(deadlines, [120_000]);
  assert.equal(signals[0], signals[1]);
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(deployment.generateDeploymentDraft(payload, "bicep", "", async () => {
    calls++;
    return "{}";
  }, controller.signal));
  assert.equal(calls, 0);
  const inputs = [];
  await deployment.generateDeploymentDraft(payload, "bicep", "", async (_instructions, input) => {
    inputs.push(input);
    return inputs.length === 1 ? "x".repeat(40_000) : JSON.stringify(draft());
  });
  assert.equal(inputs[1][1].content.length, 32_000);
  assert.match(inputs[1][2].content, /truncated/);
});

test("ARM validation blocks embedded secrets, unsafe execution resources and oversized templates", () => {
  for (const mutate of [
    (value) => { value.resources[0].type = "Microsoft.Resources/deploymentScripts"; },
    (value) => { value.resources[0].type = "Microsoft.Resources/deployments"; },
    (value) => { value.resources[0].type = "Microsoft.Compute/virtualMachines/extensions"; },
    (value) => { value.resources[0].resources = []; },
    (value) => { value.resources[0].properties.adminPassword = "literal-secret"; },
    (value) => { value.parameters.adminPassword = { type: "secureString", defaultValue: "literal-secret" }; },
    (value) => { value.parameters.api_key = { type: "string", defaultValue: "literal-secret" }; },
    (value) => { value.parameters.adminPassword = { type: "secureString" }; value.resources[0].properties.adminPassword = "still-literal"; },
    (value) => { value.resources[0].type = "Microsoft.KeyVault/vaults/secrets"; value.resources[0].properties = { value: "literal-secret" }; },
    (value) => { value.outputs = { key: { type: "string", value: "[listKeys('x','2024-01-01')]" } }; },
    (value) => { value.resources.push(value.resources[0]); },
    (value) => { value.variables = { oversized: "x".repeat(200_001) }; },
  ]) {
    const value = arm(); mutate(value);
    assert.throws(() => deployment.parseArmTemplate(value));
  }
  const secure = arm();
  secure.parameters.adminPassword = { type: "secureString" };
  secure.resources[0].properties.adminPassword = "[parameters('adminPassword')]";
  assert.deepEqual(deployment.parseArmTemplate(secure), secure);
  const generated = codegen.generateArmTemplate(payload);
  assert.ok(deployment.parseArmTemplate(generated.template).resources.length);
});

function deployRoute({ configured = true, output = JSON.stringify(draft()), outputs, fail, rate = { ok: true }, parserFailure } = {}) {
  const calls = [];
  const agent = foundryHarness();
  const loaded = load("app/api/ai/deploy/route.ts", {
    "next/server": { NextResponse },
    "@/lib/ai-rate-limit": { aiRateLimit: () => rate },
    "@/lib/request-json": bounded, "@/lib/architecture-document": document,
    "@/lib/deployment-assistance": deployment,
    "@/lib/engineering-coverage": engineeringCoverage,
    "@/lib/engineering-validation": { preflightEngineeringParser: async () => { if (parserFailure) throw parserFailure; }, validateEngineeringArtifact: async () => validationFixture() },
    "@/lib/artifact-parser": { ArtifactParserError },
    "@/lib/foundry-agent": {
      ...agent, isFoundryAgentConfigured: () => configured,
      invokeFoundryAgent: async (...args) => {
        calls.push(args);
        if (fail) throw new agent.FoundryAgentError("Foundry request interrupted.", fail);
        return outputs?.[calls.length - 1] ?? output;
      },
    },
  });
  return { ...loaded, calls, agent };
}

test("deployment route validates requests, forwards evidence/cancellation and never executes code", async () => {
  const route = deployRoute();
  const controller = new AbortController();
  const response = await route.POST(request({ payload, format: "bicep", context: "EU only" }, controller.signal));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.source, "foundry-agent");
  assert.equal(route.calls[0][0], "deployment");
  assert.deepEqual(JSON.parse(route.calls[0][2]).diagram, document.parseArchitectureDocument(payload));
  assert.equal(JSON.parse(route.calls[0][2]).context, "EU only");
  controller.abort();
  assert.equal(route.calls[0][3].aborted, true);
  const invalid = deployRoute();
  for (const body of ["{", { payload: {} }, { payload, format: "shell" }, { payload, context: "x".repeat(2001) }, { payload: { nodes: [], edges: [] } }]) {
    assert.equal((await invalid.POST(request(body))).status, 400);
  }
  assert.equal((await invalid.POST(request("x".repeat(1_000_001)))).status, 413);
  assert.equal(invalid.calls.length, 0);
  assert.equal((await deployRoute({ configured: false }).POST(request({ payload }))).status, 503);
  const limited = await deployRoute({ rate: { ok: false, retryAfterSec: 30 } }).POST(request({ payload }));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "30");
});

test("deployment route rejects malformed/unmapped model output without publishing or leaking it", async () => {
  for (const output of ["private raw model text", JSON.stringify({ code: "malicious", armTemplate: {} })]) {
    const response = await deployRoute({ output }).POST(request({ payload }));
    assert.equal(response.status, 502);
    assert.doesNotMatch(JSON.stringify(await response.json()), /private raw|malicious/);
  }
  const failed = deployRoute({ fail: 499 });
  assert.equal((await failed.POST(request({ payload }))).status, 499);
  assert.equal(failed.calls.length, 1);
  const valid = draftWithSupportingPlan();
  const missing = structuredClone(valid);
  missing.resourceMappings.shift();
  const corrected = deployRoute({ outputs: [JSON.stringify(missing), JSON.stringify(valid)] });
  const response = await corrected.POST(request({ payload }));
  assert.equal(response.status, 200);
  assert.equal(corrected.calls.length, 2);
  assert.equal((await response.json()).resourceMappings.length, 2);
  const exhausted = await deployRoute({ output: JSON.stringify(missing) }).POST(request({ payload }));
  assert.equal(exhausted.status, 502);
  const failure = await exhausted.json();
  assert.deepEqual(failure.diagnostics.map(({ field, code }) => ({ field, code })), [{ field: "resourceMappings", code: "custom" }]);
  assert.match(failure.diagnostics[0].message, /Every ARM resource/);
  assert.doesNotMatch(JSON.stringify(failure), /Microsoft.Web|serverfarms|resourceName/);
});

test("parser unavailability and unsupported service-only inputs stop before a paid model call", async () => {
  const unavailable = deployRoute({ parserFailure: new ArtifactParserError("unavailable") });
  assert.equal((await unavailable.POST(request({ payload }))).status, 503);
  assert.equal(unavailable.calls.length, 0);
  const unsupported = deployRoute();
  assert.equal((await unsupported.POST(request({ payload: { nodes: [{ ...payload.nodes[0], iconId: "aws/compute/lambda" }], edges: [] } }))).status, 400);
  assert.equal(unsupported.calls.length, 0);
});

test("server-derived engineering failures trigger one correction and ignore model-authored passed flags", async () => {
  let calls = 0;
  let validations = 0;
  const result = await deployment.generateDeploymentDraft(payload, "bicep", "", async () => {
    calls++;
    return JSON.stringify({ ...draft(), validation: validationFixture() });
  }, undefined, async (candidate) => {
    validations++;
    assert.equal(candidate.validation, undefined);
    if (validations === 1) return {
      ...validationFixture(), status: "failed", canPublish: false,
      checks: validationFixture().checks.map((check) => check.id === "syntax" ? { ...check, status: "failed", summary: "Syntax error.", details: ["BCP007 at 1:1"] } : check),
    };
    return validationFixture();
  });
  assert.equal(calls, 2);
  assert.equal(validations, 2);
  assert.equal(result.validation.canPublish, true);
});

function brokerHarness(environment = env, validator = async () => validationFixture()) {
  let now = Date.now();
  class Clock extends Date { static now() { return now; } }
  const loaded = load("app/api/deploy/template/route.ts", {
    "node:crypto": { randomUUID }, "next/server": { NextResponse }, zod: { z },
    "@/lib/ai-rate-limit": { aiRateLimit: () => ({ ok: true }) },
    "@/lib/request-json": bounded, "@/lib/architecture-document": document,
    "@/lib/deployment-assistance": deployment,
    "@/components/diagrammatic/csa/architecture-codegen": codegen,
    "@/lib/engineering-validation": { validateEngineeringArtifact: validator },
    "@/lib/artifact-parser": { ArtifactParserError },
  }, { process: { env: environment }, Date: Clock });
  return { ...loaded, advance: (ms) => { now += ms; } };
}

test("broker requires explicit publication consent and returns anonymous CORS-enabled templates", async () => {
  const broker = brokerHarness();
  for (const body of [{ payload }, { source: "foundry-agent", armTemplate: arm() }, { source: "foundry-agent", consent: false, armTemplate: arm() }]) {
    assert.equal((await broker.POST(request(body))).status, 400);
  }
  const artifact = (({ format, code, armTemplate, resourceMappings }) => ({ format, code, armTemplate, resourceMappings }))(draft());
  assert.equal((await broker.POST(request({ source: "foundry-agent", consent: true, armTemplate: arm() }))).status, 400);
  const published = await broker.POST(request({ source: "foundry-agent", consent: true, payload, artifact }));
  assert.equal(published.status, 200);
  const { portalUrl } = await published.json();
  const url = decodeURIComponent(portalUrl.split("/uri/")[1]);
  assert.match(url, /^https:\/\/diagram\.example\/api\/deploy\/template\?token=[a-f0-9]{32}$/);
  const retrieved = await broker.GET(new Request(url));
  assert.equal(retrieved.status, 200);
  assert.equal(retrieved.headers.get("Access-Control-Allow-Origin"), "*");
  assert.match(retrieved.headers.get("Cache-Control"), /no-store/);
  assert.deepEqual(await retrieved.json(), arm());
  const preflight = await broker.OPTIONS();
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(preflight.headers.get("Access-Control-Allow-Methods"), "GET, OPTIONS");
  broker.advance(10 * 60_000 + 1);
  const expired = await broker.GET(new Request(url));
  assert.equal(expired.status, 404);
  assert.equal(expired.headers.get("Access-Control-Allow-Origin"), "*");
});

test("broker revalidates the complete AI artifact set and ignores client success claims", async () => {
  const calls = [];
  const broker = brokerHarness(env, async (...args) => { calls.push(args); return validationFixture(false); });
  const artifact = (({ format, code, armTemplate, resourceMappings }) => ({ format, code, armTemplate, resourceMappings }))(draft());
  const response = await broker.POST(request({ source: "foundry-agent", consent: true, payload, artifact }));
  assert.equal(response.status, 422);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0].code, artifact.code);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][1])), document.parseArchitectureDocument(payload));
  assert.equal((await response.json()).validation.canPublish, false);
  const forged = await broker.POST(request({ source: "foundry-agent", consent: true, payload, artifact: { ...artifact, validation: validationFixture() } }));
  assert.equal(forged.status, 400);
});

test("broker rejects private/invalid origins and malformed ARM; offline publishing is explicit", async () => {
  for (const origin of ["http://localhost:3210", "https://127.0.0.1", "https://10.1.2.3", "https://app.local", "invalid"]) {
    assert.equal((await brokerHarness({ ...env, NEXT_PUBLIC_SITE_URL: origin }).POST(request({ source: "foundry-agent", consent: true, armTemplate: arm() }))).status, 400);
  }
  const broker = brokerHarness();
  assert.equal((await broker.POST(request({ source: "foundry-agent", consent: true, armTemplate: {} }))).status, 400);
  assert.equal((await broker.GET(new Request("https://diagram.example/api/deploy/template?token=bad"))).status, 400);
  const offline = await broker.POST(request({ source: "offline", consent: true, payload }));
  assert.equal(offline.status, 200);
  const noMatch = { nodes: [{ ...payload.nodes[0], iconId: "aws/compute/lambda", label: "App Service" }], edges: [] };
  assert.equal((await broker.POST(request({ source: "offline", consent: true, payload: noMatch }))).status, 400);
});

test("APP_AUTH_ENABLED permits only anonymous broker GET/OPTIONS and protects POST and other APIs", async () => {
  const authEnv = { APP_AUTH_ENABLED: "true", APP_AUTH_USERNAME: "tester", APP_AUTH_PASSWORD: "test-only", APP_AUTH_SECRET: "test-secret-".repeat(5) };
  let now = Date.now();
  class Clock extends Date { static now() { return now; } }
  const auth = load("lib/auth.ts", {}, { process: { env: authEnv }, Date: Clock });
  const middleware = load("middleware.ts", {
    "next/server": { NextResponse }, "@/lib/auth": auth,
    "@/lib/auth-redirect": { safeReturnPath: () => "/" },
  }).middleware;
  for (const method of ["GET", "OPTIONS"]) {
    const response = await middleware(new NextRequest("https://diagram.example/api/deploy/template?token=abcdef", { method }));
    assert.equal(response.headers.get("x-middleware-next"), "1");
  }
  for (const [method, path] of [["POST", "/api/deploy/template"], ["POST", "/api/deploy/validate"], ["GET", "/api/ai/privacy"], ["GET", "/api/deploy/template/other"], ["OPTIONS", "/api/ai/deploy"], ["POST", "/api/ai/deploy"]]) {
    assert.equal((await middleware(new NextRequest(`https://diagram.example${path}`, { method }))).status, 401);
  }
  const token = await auth.createSessionToken("tester");
  const authenticated = await middleware(new NextRequest("https://diagram.example/api/deploy/template", {
    method: "POST", headers: { Cookie: `${auth.SESSION_COOKIE}=${token}` },
  }));
  assert.equal(authenticated.headers.get("x-middleware-next"), "1");
  const broker = brokerHarness();
  const published = await broker.POST(request({ source: "offline", consent: true, payload }));
  const { portalUrl } = await published.json();
  const publicRequest = new NextRequest(decodeURIComponent(portalUrl.split("/uri/")[1]));
  assert.equal((await middleware(publicRequest)).headers.get("x-middleware-next"), "1");
  assert.equal((await broker.GET(publicRequest)).status, 200);
  now += 9 * 60 * 60_000;
  const expiredSession = await middleware(new NextRequest("https://diagram.example/api/deploy/template", {
    method: "POST", headers: { Cookie: `${auth.SESSION_COOKIE}=${token}` },
  }));
  assert.equal(expiredSession.status, 401);
});

test("status advertises agent readiness independently without exposing endpoint or agent names", async () => {
  const status = load("app/api/ai/status/route.ts", {
    "next/server": { NextResponse }, "@/lib/ai": { aiConfigured: () => false },
    "@/lib/foundry-agent": { isFoundryAgentConfigured: (purpose) => purpose === "deployment" },
    "@/lib/ai-image-config": { getImageAiProxyBaseUrl: () => null, imageAiConfigured: () => false },
  });
  const result = await (await status.GET()).json();
  assert.equal(result.deploymentAgentConfigured, true);
  assert.equal(result.reviewAgentConfigured, false);
  assert.equal(result.configured, true);
  assert.doesNotMatch(JSON.stringify(result), /services\.ai|deployment-agent/);
});

function modalHarness({ generationStatus = 200 } = {}) {
  const state = [];
  let cursor = 0;
  const calls = [];
  const react = {
    useState: (initial) => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    },
    useRef: (initial) => {
      const index = cursor++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index];
    },
    useEffect: () => {},
  };
  const jsx = (type, props) => ({ type, props });
  const loaded = load("components/diagrammatic/csa/AzureDeployModal.tsx", {
    "../shared/AiPrivacyNotice": { AiPrivacyNotice: () => null },
    "../shared/useDialogFocus": { useDialogFocus: () => ({ current: null }) },
    "react-dom": { createPortal: (children) => children },
    "@/lib/ai-privacy-contract": aiPrivacyContract,
    react, "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "lucide-react": Object.fromEntries(["CloudUpload", "Copy", "Download", "ExternalLink", "Loader2", "X"].map((name) => [name, name])),
    "./architecture-codegen": codegen, "@/lib/deployment-assistance": deployment,
    "@/lib/foundry-contract": privacy,
    "@/lib/engineering-validation-contract": engineeringContract,
  }, {
    document: { body: {} },
    fetch: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return Response.json(url === "/api/ai/deploy" && generationStatus === 200 ? { ...draft(), validation: validationFixture() } : { error: "Generation unavailable or use manual upload" }, { status: url === "/api/ai/deploy" ? generationStatus : 400 });
    },
    window: { open: () => ({ opener: null, location: { href: "" }, close: () => {} }) },
  });
  function render() {
    cursor = 0;
    const session = loaded.AzureDeployModal({ open: true, payload, onClose: () => {} });
    return session.type(session.props);
  }
  function find(value, predicate) {
    if (!value || typeof value !== "object") return null;
    if (predicate(value)) return value;
    for (const child of [value.props?.children].flat(Infinity)) {
      const found = find(child, predicate);
      if (found) return found;
    }
    return null;
  }
  const text = (element) => [element?.props?.children].flat(Infinity).filter((value) => typeof value === "string").join("");
  return { render, calls, find, button: (tree, label) => find(tree, (item) => item.type === "button" && text(item).includes(label)) };
}

test("deployment UI requires generation/preview and separate consent before publishing any template", async () => {
  const modal = modalHarness();
  let tree = modal.render();
  assert.equal(modal.calls.length, 0);
  assert.equal(modal.button(tree, "Open Azure Review"), null);
  await modal.button(tree, "Generate with Foundry agent").props.onClick();
  tree = modal.render();
  assert.equal(modal.calls.length, 1);
  assert.equal(modal.calls[0].url, "/api/ai/deploy");
  assert.ok(modal.find(tree, (item) => item.props?.["data-testid"] === "generated-code"));
  assert.equal(modal.button(tree, "Open Azure Review").props.disabled, true);
  await modal.button(tree, "Open Azure Review").props.onClick();
  assert.equal(modal.calls.length, 1);
  modal.find(tree, (item) => item.type === "input" && item.props.type === "checkbox").props.onChange({ target: { checked: true } });
  tree = modal.render();
  assert.equal(modal.button(tree, "Open Azure Review").props.disabled, false);
  await modal.button(tree, "Open Azure Review").props.onClick();
  assert.equal(modal.calls[1].url, "/api/deploy/template");
  assert.equal(modal.calls[1].body.consent, true);
  assert.equal(modal.calls[1].body.source, "foundry-agent");
  assert.deepEqual(modal.calls[1].body.artifact.armTemplate, arm());
  assert.deepEqual(modal.calls[1].body.payload, payload);
  modal.button(modal.render(), "Terraform").props.onClick();
  assert.equal(modal.button(modal.render(), "Open Azure Review"), null);
});

test("unconfigured agent never silently falls back; offline code requires an explicit user selection", async () => {
  const modal = modalHarness({ generationStatus: 503 });
  await modal.button(modal.render(), "Generate with Foundry agent").props.onClick();
  let tree = modal.render();
  assert.equal(modal.find(tree, (item) => item.props?.["data-testid"] === "generated-code"), null);
  assert.equal(modal.button(tree, "Open Azure Review"), null);
  modal.button(tree, "Use offline starter export").props.onClick();
  tree = modal.render();
  assert.ok(modal.find(tree, (item) => item.props?.["data-testid"] === "generated-code"));
  assert.equal(modal.calls.length, 1);
  assert.equal(modal.button(tree, "Open Azure Review").props.disabled, true);
});
