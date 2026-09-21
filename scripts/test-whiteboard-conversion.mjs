import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import * as imageValidation from "../lib/review-image-server.ts";
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
const { parentFirst } = await import("../lib/architecture-hierarchy.ts");
const { parseArchitectureDocument } = await import("../lib/architecture-document.ts");
const architectureModel = await import("../lib/architecture-model.ts");
const manifest = JSON.parse(readFileSync(new URL("../content/cloud-icons.json", import.meta.url), "utf8"));
const icon = manifest.icons[0];
const appService = manifest.icons.find((icon) => icon.id === "azure/application/application-service");
const sqlDatabase = manifest.icons.find((icon) => icon.id === "azure/data/sql-database");
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgqLjyHwAEFAJMURtfXQAAAABJRU5ErkJggg==";
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
  assert.deepEqual(result.payload.edges[0], { id: "ab", source: "a", target: "b", label: "TLS", style: "dashed", step: 2, semantics: { evidenceIds: ["whiteboard-edge-0"] } });
  assert.equal(result.payload.metadata.evidence.find((entry) => entry.id === "whiteboard-edge-0").summary, diagram.edges[0].evidence);
  assert.ok(result.payload.metadata.evidence.every((entry) => entry.source === "whiteboard-model"));
  assert.equal(result.warnings.length, 1);
  assert.deepEqual(conversion.parseWhiteboardConversionResponse(result, manifest.icons), result);
});

const labeledServices = {
  nodes: [
    { kind: "shape", id: "app", label: "Azure App Service", shape: "rectangle", x: 10, y: 50, evidence: "Box labeled Azure App Service" },
    { kind: "shape", id: "sql", label: "Azure SQL Database", shape: "database", x: 300, y: 50, evidence: "Cylinder labeled Azure SQL Database" },
  ],
  edges: [{ id: "app-sql", source: "app", target: "sql", label: "SQL", evidence: "Arrow from App Service to SQL Database" }],
  warnings: [],
};

test("plain Azure product labels become official canonical icons, not primitives or feature icons", () => {
  const result = parse(labeledServices);
  for (const [index, canonical] of [appService, sqlDatabase].entries()) {
    assert.ok(canonical);
    const node = result.payload.nodes[index];
    assert.equal(node.kind, "icon");
    assert.equal(node.iconId, canonical.id);
    assert.equal(node.iconPath, canonical.path);
    assert.equal(node.label, labeledServices.nodes[index].label);
    assert.equal("shape" in node, false);
    assert.match(readFileSync(new URL(`../public${node.iconPath}`, import.meta.url), "utf8"), /<svg\b/);
  }
  assert.equal(appService.path, "/cloud-icons/azure/application/application-service.svg");
  assert.equal(sqlDatabase.path, "/cloud-icons/azure/data/sql-database.svg");
  assert.equal(result.payload.edges[0].source, "app");
  assert.deepEqual(conversion.parseWhiteboardConversionResponse(JSON.parse(JSON.stringify(result)), manifest.icons), result);
  const prompt = conversion.buildWhiteboardConversionPrompt(manifest.icons);
  assert.ok(prompt.includes(appService.id));
  assert.match(prompt, /NOT an app-service-\*/);
  assert.match(prompt, /Do not cross provider boundaries/);
});

test("resolver is provider-safe, order independent and explicitly unknown rather than fuzzy", () => {
  const fakeAws = { id: "aws/testing/sql-database", label: "SQL Database", cloud: "aws", path: "/cloud-icons/aws/testing/sql-database.svg" };
  const collisions = [fakeAws, sqlDatabase, appService];
  for (const icons of [collisions, [...collisions].reverse()]) {
    assert.equal(conversion.resolveConversionIcon({ label: "Azure SQL Database" }, icons)?.id, sqlDatabase.id);
    assert.equal(conversion.resolveConversionIcon({ label: "AWS SQL Database" }, icons)?.id, fakeAws.id);
    assert.equal(conversion.resolveConversionIcon({ label: "SQL Database" }, icons), undefined);
    assert.equal(conversion.resolveConversionIcon({ iconId: sqlDatabase.id, label: "Orders", cloud: "azure" }, icons)?.id, sqlDatabase.id);
    assert.equal(conversion.resolveConversionIcon({ iconId: sqlDatabase.id, cloud: "aws" }, icons), undefined);
  }
  for (const identity of [
    { label: "AWS App Service" },
    { label: "GCP App Service" },
    { iconId: "aws/application/app-service", label: "Azure App Service" },
    { iconId: "azure/data/unknown-sql-service" },
    { label: "Azure App Service Backup Deluxe" },
    { label: "generic database" },
    { label: "Storage" },
    { label: "Compute" },
    { iconId: "unknown/product" },
    {},
  ]) assert.equal(conversion.resolveConversionIcon(identity, manifest.icons), undefined, JSON.stringify(identity));
  assert.equal(conversion.resolveConversionIcon({ iconId: "azure/application/app-service" }, manifest.icons)?.id, appService.id);
  assert.equal(conversion.resolveConversionIcon({ label: "Azure App Services" }, manifest.icons)?.id, appService.id);
});

test("visible Azure evidence corrects a model's cross-cloud icon but never guesses unknown products", () => {
  const model = structuredClone(labeledServices);
  model.nodes[0] = { ...model.nodes[0], kind: "icon", iconId: "aws/compute/ec2" };
  delete model.nodes[0].shape;
  model.nodes[1].label = "Azure bespoke database";
  const result = parse(model);
  assert.equal(result.payload.nodes[0].iconId, appService.id);
  assert.equal(result.payload.nodes[1].kind, "shape");
  assert.equal(result.payload.nodes[1].shape, "database");
  assert.match(result.warnings[0], /generic shape/);
  model.nodes[0].label = "Azure bespoke compute";
  assert.equal(parse(model).payload.nodes[0].kind, "shape");
  model.nodes[0].iconId = appService.id;
  assert.equal(parse(model).payload.nodes[0].kind, "shape");
});

test("source identity survives relabeling, model mistakes and JSON save/load without leaking metadata", () => {
  const model = structuredClone(labeledServices);
  model.nodes[0].label = "Azure SQL Database"; // Renaming does not change explicit source identity.
  model.nodes[0].sourceElementId = "source-app";
  const source = [{ id: "source-app", iconId: appService.id, cloud: "azure", label: "Azure SQL Database", x: 10, y: 20, width: 100, height: 100 }];
  const result = conversion.parseWhiteboardConversion(JSON.stringify(model), manifest.icons, source);
  assert.equal(result.payload.nodes[0].iconId, appService.id);
  assert.equal(result.payload.nodes[0].label, "Azure SQL Database");
  assert.equal("sourceElementId" in result.payload.nodes[0], false);
  assert.deepEqual(conversion.parseWhiteboardConversionResponse(JSON.parse(JSON.stringify(result)), manifest.icons), result);
  const unknownSource = [{ ...source[0], iconId: "azure/custom/invented-service" }];
  const fallback = conversion.parseWhiteboardConversion(JSON.stringify(model), manifest.icons, unknownSource);
  assert.equal(fallback.payload.nodes[0].kind, "shape");
  assert.deepEqual(conversion.parseWhiteboardConversionResponse(fallback, manifest.icons), fallback);
  assert.throws(() => conversion.parseWhiteboardConversion(JSON.stringify(model), manifest.icons), /source element/);
  assert.throws(() => conversion.parseWhiteboardConversion(JSON.stringify(labeledServices), manifest.icons, source), /source service identities/);
  model.nodes[1].sourceElementId = "source-app";
  assert.throws(() => conversion.parseWhiteboardConversion(JSON.stringify(model), manifest.icons, source), /source element/);
});

test("source collector uses live explicit metadata and bound labels, excluding deleted items and image files", () => {
  const element = { id: "service", type: "image", x: 5, y: 10, width: 100, height: 120, customData: { iconId: appService.id, cloud: "azure", label: "Old label", arbitrary: "not sent" } };
  const source = conversion.collectWhiteboardConversionSource({
    elements: [element, { type: "text", containerId: "service", text: "Checkout API" }, { ...element, id: "deleted", isDeleted: true }],
    files: { secret: { dataURL: png } }, appState: { private: "not sent" },
  });
  assert.deepEqual(source, [{ id: "service", iconId: appService.id, cloud: "azure", label: "Checkout API", x: 5, y: 10, width: 100, height: 120 }]);
  assert.equal(JSON.stringify(source).includes("data:image"), false);
  assert.deepEqual(conversion.collectWhiteboardConversionSource({ elements: [null, { ...element, customData: {} }] }), []);
  assert.throws(() => conversion.conversionSourceSchema.parse([...source, ...source]), /unique/);
});

test("client canonicalizes icon paths and unknown identity without upgrading intentional generic fallbacks", () => {
  const result = parse(labeledServices);
  result.payload.nodes[0].iconPath = sqlDatabase.path;
  assert.equal(conversion.parseWhiteboardConversionResponse(result, manifest.icons).payload.nodes[0].iconPath, appService.path);
  result.payload.nodes[0].iconId = "azure/unknown/product";
  const fallback = conversion.parseWhiteboardConversionResponse(result, manifest.icons);
  assert.equal(fallback.payload.nodes[0].kind, "shape");
  assert.match(fallback.warnings[0], /generic shape/);
  result.payload.nodes[0].iconPath = "https://attacker.test/icon.svg";
  assert.throws(() => conversion.parseWhiteboardConversionResponse(result, manifest.icons));
});

function loadStudioAdapter() {
  const source = readFileSync(new URL("../components/diagrammatic/Workspace.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("Workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const parts = ast.statements.filter((statement) =>
    ts.isFunctionDeclaration(statement) && statement.name?.text === "playgroundGraphToArchPayload" ||
    ts.isVariableStatement(statement) && statement.declarationList.declarations.some((declaration) => declaration.name.getText(ast) === "VARIANT_TO_TIER"),
  );
  assert.equal(parts.length, 2);
  const compiled = ts.transpileModule(`${parts.map((part) => part.getText(ast)).join("\n")}\nexports.adapt = playgroundGraphToArchPayload;`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, resolveConversionIcon: conversion.resolveConversionIcon, parentFirst, parseArchitectureDocument, ...architectureModel };
  vm.runInNewContext(compiled, context);
  return context.exports.adapt;
}

test("real Studio graph adapter retains canonical identities after relabeling and uses generic unknowns", () => {
  const adapt = loadStudioAdapter();
  const graph = {
    nodes: [
      { id: "app", type: "service", position: { x: 20, y: 40 }, data: { iconId: appService.id, label: "Checkout API", cloud: "azure", description: "Custom label, stable identity" } },
      { id: "sql", type: "service", position: { x: 300, y: 40 }, data: { iconId: sqlDatabase.id, label: "Orders", cloud: "azure" } },
      { id: "unknown", type: "service", position: { x: 20, y: 200 }, data: { iconId: "aws/custom/app-service", label: "AWS App Service", cloud: "aws" } },
      { id: "alias", type: "service", position: { x: 300, y: 200 }, data: { iconId: "azure/application/app-service", label: "Azure App Service", cloud: "azure" } },
    ],
    edges: [{ id: "sql", source: "app", target: "sql", data: { protocol: "SQL" } }],
  };
  const result = parseArchitectureDocument(adapt(graph, manifest.icons));
  assert.equal(result.nodes[0].iconId, appService.id);
  assert.equal(result.nodes[0].iconPath, appService.path);
  assert.equal(result.nodes[0].label, "Checkout API");
  assert.equal(result.nodes[0].subtitle, "Custom label, stable identity");
  assert.equal(result.nodes[1].iconId, sqlDatabase.id);
  assert.equal(result.nodes[2].kind, "shape");
  assert.equal("iconId" in result.nodes[2], false);
  assert.equal(result.nodes[3].iconId, appService.id);
  assert.deepEqual(parseArchitectureDocument(JSON.parse(JSON.stringify(result))), JSON.parse(JSON.stringify(result)));
  assert.equal(result.edges[0].label, "SQL");
});

test("every real template service imports through the production Studio adapter with its audited canonical identity", () => {
  const expected = JSON.parse(readFileSync(new URL("./fixtures/template-icon-identities.json", import.meta.url), "utf8"));
  const directory = new URL("../content/playground-templates/", import.meta.url);
  const adapt = loadStudioAdapter();
  const seen = new Set();
  for (const file of readdirSync(directory).filter((file) => file.endsWith(".json"))) {
    const template = JSON.parse(readFileSync(new URL(file, directory), "utf8"));
    const input = JSON.stringify(template.graph);
    const payload = parseArchitectureDocument(adapt(template.graph, manifest.icons));
    assert.equal(payload.nodes.length, template.graph.nodes.length, template.id);
    assert.equal(payload.edges.length, template.graph.edges.length, template.id);
    assert.equal(JSON.stringify(template.graph), input, "adapter must not mutate source identity metadata");
    for (const original of template.graph.nodes.filter((node) => node.type === "service")) {
      const legacyId = original.data.iconId;
      seen.add(legacyId);
      assert.ok(Object.hasOwn(expected, legacyId), `Unaudited template identity: ${legacyId}`);
      const actual = payload.nodes.find((node) => node.id === original.id);
      assert.equal(actual.label, original.data.label);
      assert.equal(actual.parentId, original.parentId);
      if (expected[legacyId] === null) {
        assert.equal(actual.kind, "shape", `${template.id}: ${legacyId} must not use an unrelated product`);
        assert.equal("iconId" in actual, false);
      } else {
        assert.equal(actual.kind, "icon", `${template.id}: ${legacyId}`);
        assert.equal(actual.iconId, expected[legacyId], `${template.id}: ${legacyId}`);
        const canonical = manifest.icons.find((icon) => icon.id === expected[legacyId]);
        assert.equal(canonical.cloud, original.data.cloud);
        assert.equal(actual.iconPath, canonical.path);
        assert.match(readFileSync(new URL(`../public${canonical.path}`, import.meta.url), "utf8"), /<svg\b/);
        assert.equal(conversion.resolveConversionIcon({ ...original.data, label: "Relabeled workload" }, manifest.icons)?.id, canonical.id);
        assert.equal(conversion.resolveConversionIcon({ ...original.data, cloud: canonical.cloud === "azure" ? "aws" : "azure" }, manifest.icons), undefined);
      }
    }
  }
  assert.deepEqual([...seen].sort(), Object.keys(expected).sort());
});

test("absent legacy products never turn into Cloud Control API, generic Networking, integration or Service Bus icons", () => {
  for (const [iconId, label, absentName] of [
    ["aws/networking/api-gateway", "Cloud Control API", /api.?gateway/i],
    ["gcp/integration/pub-sub", "Integration Services", /pub.?sub/i],
    ["gcp/networking/cloud-load-balancing", "Networking", /load.?balanc/i],
    ["azure/integration/03637-icon-service-business-process-tracking", "Service Bus", /business.?process.?tracking/i],
  ]) {
    const cloud = iconId.split("/")[0];
    assert.equal(manifest.icons.some((icon) => icon.cloud === cloud && absentName.test(`${icon.id} ${icon.label}`)), false);
    assert.equal(conversion.resolveConversionIcon({ iconId, label, cloud }, manifest.icons), undefined);
  }
  const missingCanonical = manifest.icons.filter((icon) => icon.id !== "azure/management/application-insights");
  assert.equal(conversion.resolveConversionIcon({ iconId: "azure/monitor/app-insights", label: "Azure App Service" }, missingCanonical), undefined);
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
  assert.throws(() => conversion.parseWhiteboardConversionResponse({ payload: { nodes: [], edges: [] }, warnings: [] }, manifest.icons));
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

test("conversion fully decodes submitted PNG before invoking vision and rejects ignored request fields", async () => {
  limiter._resetAiRateLimit();
  const route = routeHarness();
  const bytes = Buffer.from(png.split(",")[1], "base64");
  const index = bytes.indexOf(Buffer.from("IDAT"));
  assert.ok(index > 0);
  bytes[index + 4] ^= 0xff;
  assert.equal((await route.post(request({ image: { name: "corrupt.png", mimeType: "image/png", dataUrl: `data:image/png;base64,${bytes.toString("base64")}` } }))).status, 400);
  assert.equal((await route.post(request({ image: { name: "valid.png", mimeType: "image/png", dataUrl: png }, ignoredContext: "do not drop me" }))).status, 400);
  assert.equal(route.calls.length, 0);
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
    "@/lib/review-image-server": imageValidation,
    zod: { z },
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

test("real route normalizes primitive Azure fixtures and carries bounded source identity to the model", async () => {
  limiter._resetAiRateLimit();
  const { post, calls } = routeHarness({ model: JSON.stringify(labeledServices) });
  const result = await (await post(request())).json();
  assert.equal(result.payload.nodes[0].iconId, appService.id);
  assert.equal(result.payload.nodes[1].iconId, sqlDatabase.id);
  assert.ok(calls[0][0][0].content.includes('Azure App Service (App Services)'));

  const model = structuredClone(labeledServices);
  model.nodes[0].label = "Checkout";
  model.nodes[0].sourceElementId = "original-app";
  const withSource = routeHarness({ model: JSON.stringify(model) });
  const sourceNodes = [{ id: "original-app", iconId: appService.id, x: 10, y: 50, width: 120, height: 100 }];
  const response = await withSource.post(request({ image: { name: "whiteboard.png", mimeType: "image/png", dataUrl: png }, sourceNodes }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).payload.nodes[0].iconId, appService.id);
  assert.ok(withSource.calls[0][0][1].content.some((part) => part.type === "text" && part.text.includes("SOURCE_IDENTITIES") && part.text.includes("original-app")));
  const invalid = await withSource.post(request({ image: { name: "whiteboard.png", mimeType: "image/png", dataUrl: png }, sourceNodes: [{ ...sourceNodes[0], iconPath: "https://invalid.test" }] }));
  assert.equal(invalid.status, 400);
  assert.equal(withSource.calls.length, 1);
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

test("modal explains separate-document creation and does not export on open", () => {
  const source = readFileSync(new URL("../components/diagrammatic/shared/WhiteboardConvertModal.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const dependencies = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": { Loader2: () => null, ScanLine: () => null, X: () => null },
    "./AiPrivacyNotice": { AiPrivacyNotice: () => null },
    "./useDialogFocus": { useDialogFocus: () => ({ current: null }) },
    "react-dom": { createPortal: (children) => children },
    "@/lib/architecture-review": review,
    "@/lib/whiteboard-conversion": conversion,
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    document: { body: {} },
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
    icons: manifest.icons,
    getImage: async () => { exported = true; return new Blob(); },
  };
  const render = (extra) => renderToStaticMarkup(React.createElement(exports.default, { ...props, ...extra }));
  assert.match(render({}), /Conversion document behavior/);
  assert.match(render({}), /separate architecture document, not a replacement or merge/);
  assert.match(render({}), /saving must finish before closing/);
  assert.equal(render({ open: false }), "");
  assert.equal(exported, false);
});
