import assert from "node:assert/strict";
import test from "node:test";
import { parseArchitectureDocument } from "../lib/architecture-document.ts";
import { ARCHITECTURE_MODEL_VERSION, legacyNodeSemantics } from "../lib/architecture-model.ts";
import { architectureReviewRequestSchema, buildArchitectureReviewPrompt } from "../lib/architecture-review.ts";
import { azureOnlyDeploymentPayload } from "../lib/deployment-assistance.ts";
import { generateArchitectureCode } from "../components/diagrammatic/csa/architecture-codegen.ts";
import { recordGenerationIntent } from "../lib/ai-mode-prompts.ts";

export const semanticFixture = {
  metadata: {
    name: "Payments", designIntent: "Keep regulated data in the EU.",
    environments: [{ id: "prod", name: "Production" }],
    evidence: [{ id: "decision", source: "user", summary: "Workload owner requests West Europe." }],
    requirements: [{ id: "residency", category: "compliance", statement: "EU residency", evidenceIds: ["decision"] }],
  },
  nodes: [
    { kind: "group", id: "zone", label: "Landing Zone", tier: "Landing Zone", x: 0, y: 0, width: 600, height: 300, semantics: { environmentId: "prod" } },
    { kind: "icon", id: "app", label: "Payments", iconId: "azure/application/application-service", iconPath: "/cloud-icons/azure/application/application-service.svg", x: 30, y: 60, parentId: "zone", semantics: { region: "westeurope", sku: "P1v3", environmentId: "prod", properties: { replicas: 3, privateAccess: true }, requirementIds: ["residency"], evidenceIds: ["decision"] } },
    { kind: "shape", id: "client", label: "Client", shape: "person", x: 700, y: 100 },
  ],
  edges: [{ id: "request", source: "client", target: "app", semantics: { connectionType: "data-flow", protocol: "HTTPS", evidenceIds: ["decision"] } }],
};

test("unversioned native documents migrate without mutation and become idempotently versioned", () => {
  const before = structuredClone(semanticFixture);
  const migrated = parseArchitectureDocument(semanticFixture);
  assert.deepEqual(semanticFixture, before);
  assert.equal(migrated.schemaVersion, ARCHITECTURE_MODEL_VERSION);
  assert.deepEqual(migrated.metadata, semanticFixture.metadata);
  assert.equal(migrated.nodes[1].semantics.provider, "azure");
  assert.deepEqual(parseArchitectureDocument(JSON.parse(JSON.stringify(migrated))), migrated);
  assert.equal(parseArchitectureDocument({ nodes: [], edges: [] }).schemaVersion, 1);
});

test("native migration resolves only audited service aliases and never derives identity from a display label", () => {
  const input = structuredClone(semanticFixture);
  input.nodes[1].iconId = "azure/compute/app-service";
  input.nodes[1].label = "AWS Lambda";
  const migrated = parseArchitectureDocument(input);
  assert.equal(migrated.nodes[1].iconId, "azure/application/application-service");
  assert.equal(migrated.nodes[1].label, "AWS Lambda");
  input.nodes[1].iconId = "azure/custom/no-such-service";
  assert.equal(parseArchitectureDocument(input).nodes[1].iconId, "azure/custom/no-such-service");
});

test("unsupported versions and malformed semantic metadata fail rather than downgrade or disappear", () => {
  for (const schemaVersion of [0, 2, 1.5, "1", null]) {
    assert.throws(() => parseArchitectureDocument({ ...semanticFixture, schemaVersion }));
    assert.throws(() => generateArchitectureCode({ ...semanticFixture, schemaVersion }, "bicep"), /Unsupported architecture model/);
  }
  assert.throws(() => parseArchitectureDocument({ ...semanticFixture, futureMetadata: {} }));
  for (const semantics of [{ provider: "aws" }, { inventedPolicy: true }, { properties: { secret: { nested: true } } }, { properties: { region: "eastus" } }, { region: "x".repeat(101) }]) {
    const fixture = structuredClone(semanticFixture);
    fixture.nodes[1].semantics = semantics;
    assert.throws(() => parseArchitectureDocument(fixture));
  }
});

test("all environment, requirement and evidence references are checked before accepting a document", () => {
  for (const patch of [
    { environmentId: "missing" }, { requirementIds: ["missing"] }, { evidenceIds: ["missing"] }, { evidenceIds: ["decision", "decision"] },
  ]) {
    const fixture = structuredClone(semanticFixture);
    Object.assign(fixture.nodes[1].semantics, patch);
    assert.throws(() => parseArchitectureDocument(fixture));
  }
  for (const field of ["environments", "requirements", "evidence"]) {
    const fixture = structuredClone(semanticFixture);
    fixture.metadata[field].push(structuredClone(fixture.metadata[field][0]));
    assert.throws(() => parseArchitectureDocument(fixture), /must be unique/);
  }
  const badRequirement = structuredClone(semanticFixture);
  badRequirement.metadata.requirements[0].evidenceIds = ["missing"];
  assert.throws(() => parseArchitectureDocument(badRequirement), /missing evidence/);
  const badConnection = structuredClone(semanticFixture);
  badConnection.edges[0].semantics.evidenceIds = ["missing"];
  assert.throws(() => parseArchitectureDocument(badConnection), /missing evidence/);
});

test("legacy provider and properties project into shared semantics without mutating the source", () => {
  const data = { cloud: "azure", properties: { region: "westeurope", sku: "P1v3", replicas: 3, private: true }, semantics: { requirementIds: ["residency"] } };
  const before = structuredClone(data);
  assert.deepEqual(legacyNodeSemantics(data), { provider: "azure", region: "westeurope", sku: "P1v3", properties: { replicas: 3, private: true }, requirementIds: ["residency"] });
  assert.deepEqual(data, before);
  assert.throws(() => legacyNodeSemantics({ ...data, semantics: { provider: "aws" } }), /Conflicting/);
  assert.throws(() => legacyNodeSemantics({ ...data, semantics: { region: "eastus" } }), /Conflicting/);
  assert.throws(() => legacyNodeSemantics({ ...data, semantics: { properties: { replicas: 2 } } }), /Conflicting/);
});

test("review and Azure-only code inputs retain the same root context and traceability", () => {
  const payload = parseArchitectureDocument(semanticFixture);
  const request = architectureReviewRequestSchema.parse({ source: "canvas", payload });
  assert.deepEqual(request.payload, payload);
  const invalid = structuredClone(payload);
  invalid.nodes[1].semantics.evidenceIds = ["missing"];
  assert.equal(architectureReviewRequestSchema.safeParse({ source: "canvas", payload: invalid }).success, false);
  const prompt = buildArchitectureReviewPrompt(request);
  for (const text of ["EU residency", "westeurope", "P1v3", "Production", "decision"]) assert.ok(prompt.includes(text), text);
  const aws = { ...payload.nodes[1], id: "aws", iconId: "aws/compute/lambda", iconPath: "/cloud-icons/aws/compute/lambda.svg", semantics: { provider: "aws" } };
  const selected = azureOnlyDeploymentPayload({ ...payload, nodes: [...payload.nodes, aws] });
  assert.deepEqual(selected.payload.metadata, payload.metadata);
  assert.equal(selected.payload.schemaVersion, 1);
  assert.equal(selected.payload.nodes.length, payload.nodes.length);
  for (const format of ["bicep", "terraform", "azure-cli", "powershell"]) {
    const draft = generateArchitectureCode(selected.payload, format);
    assert.match(draft.warnings.join(" "), /does not implement those per-service settings/);
    assert.match(draft.warnings.join(" "), /does not evaluate or satisfy/);
  }
});

test("original generation intent and supplied business constraints survive independently of model prose", () => {
  const graph = {
    metadata: { name: "Generated", description: "Model summary", evidence: [{ id: "user-budget", source: "ai-assumption", summary: "Needs confirmation" }] },
    nodes: [{ id: "app", type: "service", position: { x: 0, y: 0 }, data: { iconId: "azure/application/application-service", label: "App", cloud: "azure" } }], edges: [],
  };
  const input = { mode: "architecture", prompt: "Original exact design intent", businessConstraints: { budget: "Under $100", compliance: "User policy" } };
  const recorded = recordGenerationIntent(graph, input);
  assert.equal(recorded.metadata.designIntent, input.prompt);
  assert.deepEqual(recorded.metadata.requirements.map((item) => item.statement), ["Under $100", "User policy"]);
  assert.equal(recorded.metadata.evidence[0].source, "ai-assumption");
  assert.equal(recorded.metadata.evidence[1].id, "user-budget-1");
  assert.equal(recorded.metadata.requirements[0].evidenceIds[0], "user-budget-1");
  assert.equal("designIntent" in graph.metadata, false);
});
