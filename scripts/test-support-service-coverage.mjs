import assert from "node:assert/strict";
import test from "node:test";
import { azureResourceKind, resolveServiceIcon, SERVICE_CATALOG } from "../lib/service-identity.ts";
import { inspectDeploymentEligibility } from "../lib/deployment-eligibility.ts";
import { generateArchitectureCode, generateArmTemplate } from "../components/diagrammatic/csa/architecture-codegen.ts";
import { assessDiagramWellArchitected } from "../components/diagrammatic/csa/well-architected.ts";
import { inspectEngineeringCoverage, inspectEngineeringPrerequisites } from "../lib/engineering-coverage.ts";
import { inspectArtifactConsistency } from "../lib/artifact-consistency.ts";
import { parseArtifactSyntax } from "../lib/artifact-parser.ts";
import { parseArmTemplate } from "../lib/deployment-assistance.ts";
import { compilerFixtures, graph, service } from "./iac-fixtures.mjs";

const kinds = [
  ["container-apps", "azure/application/container-app", "Microsoft.App/containerApps"],
  ["search", "azure/ai/search-service", "Microsoft.Search/searchServices"],
  ["search", "azure/ai/cognitive-services-search", "Microsoft.Search/searchServices"],
];
const customerSupport = {
  nodes: [
    { id: "n1", kind: "shape", label: "Employees" },
    service("n2", kinds[0][1], "Support orchestrator"),
    service("n3", "azure/ai/azure-openai", "Knowledge agent"),
    service("n4", kinds[1][1], "Approved knowledge"),
    service("n5", "azure/ai/azure-openai", "Resolution agent"),
    { id: "n6", kind: "shape", label: "Human approval" },
    service("n7", "azure/application/function-app", "Action worker"),
    { id: "n8", kind: "shape", label: "Ticket system" },
  ],
  edges: Array.from({ length: 7 }, (_, i) => ({ id: `e${i + 1}`, source: `n${i + 1}`, target: `n${i + 2}` })),
};
const sample = (iconId) => {
  const evidence = graph([service("workload", iconId, "Renamed business component")]);
  const template = parseArmTemplate(generateArmTemplate(evidence).template);
  const mappings = template.resources.map((resource) => ({ nodeId: "workload", resourceType: resource.type, resourceName: resource.name }));
  return { evidence, template, mappings };
};

test("support diagram keeps exact artwork identity, recognizes n4 offline and exposes both deployment kinds", () => {
  const before = structuredClone(customerSupport);
  const scorecard = assessDiagramWellArchitected(customerSupport);
  assert.doesNotMatch(scorecard.warnings.join(" "), /Unrecognized service|No supported Azure workload/);
  assert.equal(scorecard.serviceCount, 5);
  assert.deepEqual(inspectDeploymentEligibility(customerSupport).map((row) => [row.nodeId, row.kind]), [
    ["n2", "container-apps"], ["n3", "openai"], ["n4", "search"], ["n5", "openai"], ["n7", "functions"],
  ]);
  for (const format of ["bicep", "terraform", "azure-cli", "powershell"]) {
    const result = generateArchitectureCode(customerSupport, format);
    assert.equal(result.supportedNodes, 5);
    assert.doesNotMatch(result.warnings.join(" "), /No deployable mapping/);
    assert.match(result.warnings.join(" "), /existing same-region/);
    assert.match(result.warnings.join(" "), /indexes, approved documents and ingestion/);
  }
  assert.deepEqual(customerSupport, before, "Labels and icon paths are never rewritten to gain support");
});

test("finite provider-safe product identities include both official Search assets but not environments or similar products", () => {
  for (const [kind, iconId] of kinds) {
    assert.equal(azureResourceKind(iconId, "azure"), kind);
    for (const cloud of ["aws", "gcp"]) {
      assert.equal(azureResourceKind(iconId, cloud), undefined);
      const evidence = graph([{ ...service("wrong", iconId, "Azure AI Search"), cloud }]);
      assert.equal(generateArmTemplate(evidence).supportedNodes, 0);
      assert.match(assessDiagramWellArchitected(evidence).warnings.join(" "), /Unrecognized service IDs.*wrong/);
    }
    const conflict = graph([{ ...service("wrong", iconId), cloud: "aws", semantics: { provider: "azure" } }]);
    assert.throws(() => generateArmTemplate(conflict), /conflicting providers/);
    assert.match(assessDiagramWellArchitected(conflict).warnings.join(" "), /Unrecognized service IDs.*wrong/);
  }
  for (const iconId of [
    "azure/application/container-app-environment", "azure/compute/container-instance", "aws/analytics/opensearch-service",
    "azure/not-a-catalog-product/container-app", "azure/not-a-catalog-product/search-service",
  ]) {
    assert.equal(azureResourceKind(iconId), undefined);
  }
  assert.equal(azureResourceKind("azure/ai/10044-icon-service-cognitive-search"), "search", "Audited legacy identity remains supported");
  assert.equal(resolveServiceIcon({ label: "Azure AI Search" }, SERVICE_CATALOG)?.id, "azure/ai/cognitive-services-search");
  assert.equal(resolveServiceIcon({ label: "Search Service", cloud: "azure" }, SERVICE_CATALOG)?.id, "azure/ai/search-service");
  assert.equal(resolveServiceIcon({ label: "Azure Container Apps" }, SERVICE_CATALOG)?.id, "azure/application/container-app");
});

test("each new identity has compiler fixtures, exact primary coverage, and unresolved real-world prerequisites", () => {
  for (const [, iconId, type] of kinds) {
    assert.ok(compilerFixtures.some(([, payload]) => payload.nodes.length === 1 && payload.nodes[0].iconId === iconId));
    const { evidence, template, mappings } = sample(iconId);
    assert.deepEqual(template.resources.map((resource) => resource.type), [type]);
    const coverage = inspectEngineeringCoverage(template, mappings, evidence);
    assert.equal(coverage.mapping.status, "passed");
    assert.equal(coverage.coverage[0].status, "mapped");
    assert.equal(inspectEngineeringPrerequisites(template).status, "not-verified");
    mappings[0].resourceType = "Microsoft.CognitiveServices/accounts";
    assert.equal(inspectEngineeringCoverage(template, mappings, evidence).mapping.status, "failed");
  }
});

test("Container App starter requires an existing environment and explicit image in every declarative and script format", () => {
  const { evidence, template } = sample(kinds[0][1]);
  for (const name of ["containerAppEnvironmentId", "containerAppImage"]) {
    assert.equal(template.parameters[name].type, "string");
    assert.equal("defaultValue" in template.parameters[name], false);
    assert.match(generateArchitectureCode(evidence, "bicep").output, new RegExp(`param ${name} string`));
  }
  const resource = template.resources[0];
  assert.equal(resource.identity.type, "SystemAssigned");
  assert.equal(resource.properties.environmentId, "[parameters('containerAppEnvironmentId')]");
  assert.deepEqual(resource.properties.configuration.ingress, { external: false, targetPort: 8080, allowInsecure: false, transport: "auto" });
  assert.deepEqual(resource.properties.template.containers[0].resources, { cpu: 1, memory: "2Gi" });
  assert.equal(resource.properties.template.containers[0].image, "[parameters('containerAppImage')]");
  const tf = generateArchitectureCode(evidence, "terraform").output;
  assert.match(tf, /container_app_environment_id\s+= var.container_app_environment_id/);
  assert.match(tf, /image\s+= var.container_app_image/);
  assert.doesNotMatch(tf, /resource "azurerm_container_app_environment"/);
  for (const format of ["azure-cli", "powershell"]) {
    const code = generateArchitectureCode(evidence, format).output;
    assert.match(code, /CONTAINER_APP_ENVIRONMENT_ID/);
    assert.match(code, /CONTAINER_APP_IMAGE/);
    assert.match(code, /containerAppEnvironmentId/);
    assert.match(code, /containerAppImage/);
  }
});

test("independent prerequisites reject missing, spoofed or unsafe Container Apps and Search configuration", () => {
  const containerMutations = [
    (resource) => { delete resource.properties.environmentId; },
    (resource) => { resource.properties.environmentId = "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/rg/providers/Microsoft.Web/sites/not-an-environment"; },
    (resource) => { resource.properties.environmentId = "[parameters('undeclared')]"; },
    (resource) => { resource.properties.environmentId = "[concat('guess', 'environment')]"; },
    (resource) => { resource.properties.template.containers = []; },
    (resource) => { resource.properties.template.containers[0].image = " "; },
    (resource) => { resource.properties.template.containers[0].image = "[parameters('missingImage')]"; },
    (resource) => { delete resource.properties.template.containers[0].resources; },
    (resource) => { resource.properties.configuration.ingress.allowInsecure = true; },
    (resource) => { delete resource.identity; },
  ];
  const searchMutations = [
    (resource) => { delete resource.sku; },
    (resource) => { resource.properties.replicaCount = 0; },
    (resource) => { resource.properties.partitionCount = 2; },
    (resource) => { resource.properties.disableLocalAuth = false; },
    (resource) => { resource.properties.authOptions = { apiKeyOnly: {} }; },
    (resource) => { delete resource.properties.publicNetworkAccess; },
    (resource) => { delete resource.identity; },
  ];
  for (const [iconId, mutations] of [[kinds[0][1], containerMutations], [kinds[1][1], searchMutations]]) {
    for (const mutation of mutations) {
      const { template } = sample(iconId);
      mutation(template.resources[0]);
      assert.equal(inspectEngineeringPrerequisites(template).status, "failed", mutation.toString());
    }
  }
});

test("real parsers and selected semantic checks recognize both families and detect changed critical properties", async () => {
  for (const [, iconId] of kinds) {
    const { evidence, template } = sample(iconId);
    for (const format of ["bicep", "terraform"]) {
      let code = generateArchitectureCode(evidence, format).output;
      const comparedTemplate = structuredClone(template);
      if (format === "terraform") {
        const emitted = await parseArtifactSyntax(code, format);
        assert.equal(emitted.valid, true, JSON.stringify(emitted.diagnostics));
        const original = inspectArtifactConsistency(emitted, format, template);
        assert.doesNotMatch(original.details.join(" "), /resource type is computed or outside/);
        // Offline Terraform has its existing snake_case input contract. Do not pretend
        // those inputs/defaults are proven equivalent to independently supplied ARM.
        assert.notEqual(original.status, "passed");
        const environmentId = "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/rg/providers/Microsoft.App/managedEnvironments/env";
        const resource = comparedTemplate.resources[0];
        resource.name = "workload";
        resource.location = "eastus";
        if (iconId === kinds[0][1]) {
          resource.properties.environmentId = environmentId;
          resource.properties.template.containers[0].image = "example.invalid/reviewed-image:v1";
        }
        comparedTemplate.parameters = {};
        comparedTemplate.variables = {};
        // A separate literal fixture exercises exact selected-field correspondence,
        // independent of deployment parameter binding and real environment state.
        code = code.slice(code.indexOf('resource "azurerm_'))
          .replace(/name\s+= "[^"]+-\$\{var.environment_name\}"/, 'name = "workload"')
          .replaceAll("data.azurerm_resource_group.target.name", '"rg"')
          .replaceAll("local.location", '"eastus"')
          .replaceAll("var.container_app_environment_id", JSON.stringify(environmentId))
          .replaceAll("var.container_app_image", '"example.invalid/reviewed-image:v1"');
      }
      const syntax = await parseArtifactSyntax(code, format);
      assert.equal(syntax.valid, true, JSON.stringify(syntax.diagnostics));
      const checked = inspectArtifactConsistency(syntax, format, comparedTemplate);
      assert.notEqual(checked.status, "failed", JSON.stringify(checked.details));
      assert.doesNotMatch(checked.details.join(" "), /resource type is computed or outside/);
      if (format === "bicep") assert.equal(checked.status, "passed", JSON.stringify(checked.details));
      const changed = structuredClone(comparedTemplate);
      if (iconId === kinds[0][1]) changed.resources[0].properties.configuration.ingress.allowInsecure = true;
      else changed.resources[0].properties.replicaCount = 2;
      assert.equal(inspectArtifactConsistency(syntax, format, changed).status, "failed", format);
    }
  }
});
