import assert from "node:assert/strict";
import test from "node:test";
import { buildDeploymentReference } from "../lib/deployment-grounding.ts";
import { generateDeploymentDraft, parseDeploymentDraft } from "../lib/deployment-assistance.ts";
import { validateEngineeringArtifact } from "../lib/engineering-validation.ts";
import { supportDemo } from "./fixtures/support-demo.mjs";

const artifact = () => {
  const reference = buildDeploymentReference(supportDemo);
  assert.equal(reference.status, "reference-only");
  const { format, code, armTemplate, resourceMappings, warnings, assumptions } = reference;
  return { format, code, armTemplate, resourceMappings, warnings, assumptions };
};

test("exact support starter passes real Bicep syntax, coverage and selected correspondence without certifying prerequisites", async () => {
  const report = await validateEngineeringArtifact(parseDeploymentDraft(artifact(), supportDemo, "bicep"), supportDemo);
  const checks = Object.fromEntries(report.checks.map((check) => [check.id, check]));
  for (const id of ["syntax", "resource-mappings", "coverage", "artifact-consistency"]) {
    assert.equal(checks[id].status, "passed", JSON.stringify(checks[id]));
  }
  assert.equal(checks.prerequisites.status, "not-verified");
  assert.equal(checks["azure-environment"].status, "not-verified");
  assert.equal(report.status, "needs-review");
  assert.equal(report.canPublish, false);
});

test("real validation repairs the observed malformed syntax and missing Function/Container prerequisites using the unchanged reference", async () => {
  const good = artifact();
  const bad = structuredClone(good);
  bad.code = "param environmentName string\nresource broken 'Microsoft.App/containerApps@2025-01-01' = { identity { type: 'SystemAssigned' } }\n";
  const container = bad.armTemplate.resources.find((item) => item.type === "Microsoft.App/containerApps");
  delete container.identity;
  delete container.properties.environmentId;
  container.properties.template.containers = [];
  bad.armTemplate.resources.find((item) => item.type === "Microsoft.Web/sites").kind = "app,linux";
  const before = structuredClone(supportDemo);
  const calls = [];
  const result = await generateDeploymentDraft(supportDemo, "bicep", "", async (_instructions, input) => {
    calls.push(input);
    return JSON.stringify(calls.length === 1 ? bad : good);
  }, undefined, validateEngineeringArtifact);
  assert.equal(calls.length, 2);
  assert.equal(calls[1][0].content, calls[0]);
  assert.match(calls[1][2].content, /syntax|parser/i);
  assert.match(calls[1][2].content, /workload kind/);
  assert.match(calls[1][2].content, /managed environment|managed identity/);
  assert.equal(result.code, good.code.trim());
  assert.equal(result.validation.status, "needs-review");
  assert.equal(result.validation.canPublish, false);
  assert.deepEqual(supportDemo, before);
});
