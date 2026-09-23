import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { evaluateAiCandidate } from "../lib/ai-evaluation.ts";
import { reviewHash, createReviewProvenance } from "../lib/review-provenance-server.ts";
import { referenceCandidate, enforceSubjectPromotion } from "./evaluate-ai.mjs";
import { normalizeAiSubject, aiSubjectFingerprint, AI_EVALUATION_BOOTSTRAP_REVISION } from "./ai-evaluation-subjects.mjs";

const subject = "a".repeat(64);
const app = "azure/application/application-service";
const sql = "azure/data/sql-database";
const png = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="440" height="140"><rect width="440" height="140" fill="white"/><g fill="none" stroke="black" stroke-width="2"><rect x="20" y="40" width="150" height="60"/><rect x="270" y="40" width="150" height="60"/><path d="M170 70H265L253 64M265 70L253 76"/></g><g font-family="sans-serif" font-size="18" text-anchor="middle"><text x="95" y="76">API</text><text x="345" y="76">DB</text></g></svg>')).png().toBuffer();
const native = {
  nodes: [
    { id: "a", kind: "icon", iconId: app, iconPath: "", label: "API", x: 20, y: 40 },
    { id: "b", kind: "icon", iconId: sql, iconPath: "", label: "DB", x: 270, y: 40 },
  ],
  edges: [{ id: "a-b", source: "a", target: "b", label: "HTTPS" }],
};
const graph = {
  metadata: { name: "Unit fixture", description: "Synthetic evaluator input, not a provider result." },
  nodes: native.nodes.map((node) => ({
    id: node.id, type: "service", position: { x: node.x, y: node.y },
    data: { iconId: node.iconId, label: node.label, cloud: "azure" },
  })),
  edges: [{ id: "a-b", source: "a", target: "b", data: { label: "HTTPS", connectionType: "data-flow", lineStyle: "solid", arrowStyle: "forward" } }],
};
const expected = {
  nodes: [{ key: "api", identities: [app], label: "API" }, { key: "db", identities: [sql], label: "DB" }],
  connections: [{ source: "api", target: "db", label: "HTTPS" }], providers: ["azure"],
};
const reviewInput = { source: "description", description: "Recovery settings were not supplied for this synthetic Azure workload." };
const review = {
  summary: "Confirm recovery evidence.", posture: "mixed", score: 50, strengths: [], assumptions: ["Deployment is unverified."],
  findings: [{
    id: "recovery", title: "Confirm recovery objectives", severity: "medium", framework: "Well-Architected Framework",
    evidence: "Recovery configuration was not supplied.", recommendation: "Agree objectives before selecting redundancy.",
    sourceUrl: "https://learn.microsoft.com/azure/well-architected/reliability/redundancy",
    guidanceIds: ["waf-redundancy"], guidanceRationale: "Missing recovery targets prevent choosing adequate redundancy.",
    evidenceStatus: "unknown", nodeIds: [], edgeIds: [],
    remediation: { steps: ["Agree recovery targets."], validation: "Measure recovery results.", tradeoff: "Additional capacity has cost." },
  }],
};
const artifact = {
  format: "bicep",
  code: `param location string = 'westeurope'
resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: 'evaluation-plan'
  location: location
  kind: 'app'
  sku: { name: 'B1' }
}
resource site 'Microsoft.Web/sites@2024-04-01' = {
  name: 'evaluation-site'
  location: location
  kind: 'app'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
  }
}`,
  armTemplate: {
    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    contentVersion: "1.0.0.0",
    parameters: { location: { type: "string", defaultValue: "westeurope" } },
    resources: [
      { type: "Microsoft.Web/serverfarms", apiVersion: "2024-04-01", name: "evaluation-plan", location: "[parameters('location')]", kind: "app", sku: { name: "B1" } },
      { type: "Microsoft.Web/sites", apiVersion: "2024-04-01", name: "evaluation-site", location: "[parameters('location')]", kind: "app", properties: { serverFarmId: "[resourceId('Microsoft.Web/serverfarms', 'evaluation-plan')]", httpsOnly: true } },
    ],
  },
  resourceMappings: [
    { nodeId: "a", resourceType: "Microsoft.Web/serverfarms", resourceName: "evaluation-plan" },
    { nodeId: "a", resourceType: "Microsoft.Web/sites", resourceName: "evaluation-site" },
  ],
};
const dataset = {
  schemaVersion: 1, id: "unit-evaluation", version: "2026-09-22.1",
  description: "Unit fixtures for grader behavior; not a model benchmark result.",
  tasks: [
    { id: "generate", kind: "generation", title: "Retain named API and DB with HTTPS", input: { mode: "architecture", prompt: "Use Azure App Service API then Azure SQL DB; connect API to DB with HTTPS." }, expected },
    { id: "convert", kind: "conversion", title: "Retain the visible flow and explicit source identities", input: {
      image: { name: "unit-board.png", mimeType: "image/png", dataUrl: `data:image/png;base64,${png.toString("base64")}` },
      sourceNodes: native.nodes.map((node) => ({ id: node.id, iconId: node.iconId, label: node.label, cloud: "azure", x: node.x, y: node.y, width: 150, height: 60 })),
    }, expected },
    { id: "review", kind: "review", title: "Keep missing recovery evidence unknown", input: reviewInput,
      expected: { requiredGuidanceIds: ["waf-redundancy"], unknownGuidanceIds: ["waf-redundancy"] } },
    { id: "iac", kind: "iac", title: "Valid keyless App Service artifact", input: { payload: { nodes: [native.nodes[0]], edges: [] }, format: "bicep" },
      expected: { format: "bicep", resourceTypes: ["Microsoft.Web/serverfarms", "Microsoft.Web/sites"] } },
  ],
};
const outputs = {
  generate: { graph, designAssistance: { assumptions: ["Runtime unverified."], recommendations: ["Review access."], tradeoffs: ["Redundancy costs more."], nextSteps: ["Validate design."] } },
  convert: { payload: native, warnings: [] }, review: { review }, iac: artifact,
};
const candidate = () => referenceCandidate(dataset, outputs, subject);

test("reference evaluation uses real validators and cannot claim model qualification", async () => {
  const input = candidate();
  const before = structuredClone(input);
  const report = await evaluateAiCandidate(dataset, input, subject);
  assert.equal(report.status, "passed-declared-task-checks", JSON.stringify(report.results));
  assert.equal(report.passedTasks, 4);
  assert.equal(report.eligibleForSubjectPromotion, false);
  assert.equal(report.liveModelInvoked, false);
  assert.equal(report.customerInfrastructureExecuted, false);
  assert.deepEqual(input, before);
});

for (const [name, mutate, failedId] of [
  ["omitted required service", (value) => { value.cases[0].output.graph.nodes.pop(); value.cases[0].output.graph.edges = []; }, "generate"],
  ["renamed role despite correct service", (value) => { value.cases[0].output.graph.nodes[0].data.label = "Wrong role"; }, "generate"],
  ["wrong provider identity under an Azure label", (value) => { value.cases[0].output.graph.nodes[0].data = { iconId: "aws/compute/lambda", label: "API", cloud: "aws" }; }, "generate"],
  ["management-operation icon substituted for App Service", (value) => { value.cases[0].output.graph.nodes[0].data.iconId = "azure/application/app-service-management"; }, "generate"],
  ["unrequested service", (value) => { value.cases[0].output.graph.nodes.push({ id: "extra", type: "service", position: { x: 500, y: 40 }, data: { iconId: app, label: "Unrequested", cloud: "azure" } }); }, "generate"],
  ["reversed directed flow", (value) => { const edge = value.cases[1].output.payload.edges[0]; [edge.source, edge.target] = [edge.target, edge.source]; }, "convert"],
  ["wrong connection protocol", (value) => { value.cases[0].output.graph.edges[0].data.label = "FTP"; }, "generate"],
  ["duplicate unexpected edge", (value) => { value.cases[0].output.graph.edges.push({ ...value.cases[0].output.graph.edges[0], id: "duplicate" }); }, "generate"],
  ["missing evidence presented as observed", (value) => { value.cases[2].output.review.findings[0].evidenceStatus = "observed"; }, "review"],
  ["invented guidance citation", (value) => { value.cases[2].output.review.findings[0].guidanceIds = ["invented"]; }, "review"],
  ["invalid IaC with a forged validation flag", (value) => { value.cases[3].output.code = "INVALID {{{"; value.cases[3].output.validation = { canPublish: true }; }, "iac"],
  ["removed critical HTTPS control", (value) => { value.cases[3].output.armTemplate.resources[1].properties.httpsOnly = false; }, "iac"],
]) {
  test(`semantic mutation fails: ${name}`, async () => {
    const input = candidate();
    mutate(input);
    const report = await evaluateAiCandidate(dataset, input, subject);
    assert.equal(report.status, "failed-declared-task-checks");
    assert.equal(report.results.find((entry) => entry.taskId === failedId).passed, false);
    assert.equal(report.eligibleForSubjectPromotion, false);
  });
}

test("missing tasks and wrong input/dataset/subject fingerprints cannot produce partial success", async () => {
  for (const mutate of [
    (value) => value.cases.pop(),
    (value) => { value.cases[0].inputSha256 = "b".repeat(64); },
    (value) => { value.datasetVersion = "old"; },
    (value) => { value.subjectSha256 = "b".repeat(64); },
  ]) {
    const input = candidate(); mutate(input);
    assert.equal((await evaluateAiCandidate(dataset, input, subject)).status, "failed-declared-task-checks");
  }
});

test("supplied recorded captures require matching provenance and declared model versions", async () => {
  const input = candidate();
  input.origin = "recorded-candidate";
  for (const kind of Object.keys(input.models)) input.models[kind] = { id: `unit-${kind}-model`, version: "2026-09-22" };
  input.cases[2].output.provenance = createReviewProvenance({
    source: "description", evidence: reviewInput, review,
    attempts: [{ requestSha256: reviewHash(reviewInput), invocation: {
      agentName: "unit-agent", agentVersion: null, modelReportedId: "unit-review-model",
      responseId: "unit-response", maxOutputTokens: 6000, toolChoice: "none", store: false,
    } }],
  });
  input.cases[2].output.provenance.generatedAt = input.capturedAt;
  assert.equal((await evaluateAiCandidate(dataset, input, subject)).eligibleForSubjectPromotion, false);
  input.cases[2].groundingReview = {
    reviewer: "unit-test-simulation", reviewedAt: input.capturedAt,
    outputSha256: reviewHash(input.cases[2].output), grounded: true,
    notes: "Simulated adjudication for evaluator tests, not live-model evidence.",
  };
  assert.equal((await evaluateAiCandidate(dataset, input, subject)).eligibleForSubjectPromotion, true);
  const revised = structuredClone(input);
  revised.cases[2].output.review.summary = "Changed after the simulated human review.";
  revised.cases[2].output.provenance.reviewSha256 = reviewHash(revised.cases[2].output.review);
  const stale = await evaluateAiCandidate(dataset, revised, subject);
  assert.equal(stale.status, "passed-declared-task-checks");
  assert.equal(stale.eligibleForSubjectPromotion, false);
  assert.ok(stale.promotionBlockers.some((reason) => reason.includes("stale")));
  const nominated = structuredClone(input.models);
  nominated.generation.id = "different-nominated-model";
  const mismatch = await evaluateAiCandidate(dataset, input, subject, nominated);
  assert.equal(mismatch.eligibleForSubjectPromotion, false);
  assert.ok(mismatch.issues.some((issue) => issue.includes("nominated model")));
  input.models.generation.version = null;
  assert.equal((await evaluateAiCandidate(dataset, input, subject)).eligibleForSubjectPromotion, false);
  input.cases[2].output.provenance.evidenceSha256 = "b".repeat(64);
  assert.equal((await evaluateAiCandidate(dataset, input, subject)).status, "failed-declared-task-checks");
});

test("evaluator infrastructure failure is not reported as a model quality verdict", async () => {
  const before = process.env.DIAGRAMMATIC_VALIDATOR_ROOT;
  try {
    process.env.DIAGRAMMATIC_VALIDATOR_ROOT = join(process.cwd(), "node_modules", ".cache", `missing-evaluation-parser-${randomUUID()}`);
    await assert.rejects(evaluateAiCandidate(dataset, candidate(), subject), /Evaluation infrastructure failed \(unavailable\).*no quality verdict/);
  } finally {
    if (before === undefined) delete process.env.DIAGRAMMATIC_VALIDATOR_ROOT;
    else process.env.DIAGRAMMATIC_VALIDATOR_ROOT = before;
  }
});
test("accessors, cycles, oversized values and sparse arrays fail explicitly", async () => {
  const accessor = candidate();
  let invoked = false;
  Object.defineProperty(accessor, "extra", { get() { invoked = true; return {}; } });
  await assert.rejects(evaluateAiCandidate(dataset, accessor, subject), /accessors/);
  assert.equal(invoked, false);
  const cyclic = candidate(); cyclic.cases[0].output.self = cyclic;
  await assert.rejects(evaluateAiCandidate(dataset, cyclic, subject), /cycles/);
  const huge = candidate(); huge.cases[0].output.extra = "x".repeat(16 * 1024 * 1024);
  await assert.rejects(evaluateAiCandidate(dataset, huge, subject), /budget/);
  const sparse = candidate(); sparse.cases = new Array(2);
  await assert.rejects(evaluateAiCandidate(dataset, sparse, subject), /sparse/);
});

test("subject fingerprint ignores comments, type syntax, CRLF and explicit TypeScript import suffixes, not prompts", () => {
  const plain = 'import {x} from "./types"; export const prompt = x + `A\nB`;';
  const typed = `// comment\r\n${plain.replace("./types", "./types.ts").replace("prompt =", "prompt: string =").replace(/\n/g, "\r\n")}`;
  assert.equal(normalizeAiSubject(plain, "subject.ts"), normalizeAiSubject(typed, "subject.ts"));
  assert.notEqual(normalizeAiSubject(plain, "subject.ts"), normalizeAiSubject(plain.replace("A\nB", "Different prompt"), "subject.ts"));
  assert.match(aiSubjectFingerprint().fingerprint, /^[a-f0-9]{64}$/);
  assert.match(aiSubjectFingerprint({ revision: AI_EVALUATION_BOOTSTRAP_REVISION }).fingerprint, /^[a-f0-9]{64}$/);
});

test("changed subject promotion never accepts a reference, missing or mismatched report", () => {
  assert.equal(enforceSubjectPromotion({ current: subject, baseline: subject }).liveModelQualification, "not-asserted");
  for (const report of [
    undefined,
    { origin: "reference-fixture", subjectSha256: subject, eligibleForSubjectPromotion: true },
    { origin: "recorded-candidate", subjectSha256: "b".repeat(64), eligibleForSubjectPromotion: true },
    { origin: "recorded-candidate", subjectSha256: subject, eligibleForSubjectPromotion: false },
  ]) assert.throws(() => enforceSubjectPromotion({ current: subject, baseline: "c".repeat(64), report }), /changed without/);
});
