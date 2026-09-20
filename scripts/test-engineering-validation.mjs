import assert from "node:assert/strict";
import test from "node:test";
import { generateArmTemplate, generateArchitectureCode } from "../components/diagrammatic/csa/architecture-codegen.ts";
import { parseArmTemplate } from "../lib/deployment-assistance.ts";
import { inspectEngineeringCoverage, inspectEngineeringPrerequisites } from "../lib/engineering-coverage.ts";
import { engineeringValidationSchema, ENGINEERING_VALIDATION_DISCLAIMER } from "../lib/engineering-validation-contract.ts";
import { supportedIcons, graph, service } from "./iac-fixtures.mjs";
import { validateEngineeringArtifact } from "../lib/engineering-validation.ts";

const sample = (iconId = "azure/application/application-service") => {
  const evidence = graph([service("app", iconId, "Customer service")]);
  const template = parseArmTemplate(generateArmTemplate(evidence).template);
  const mappings = template.resources.map((resource) => ({ nodeId: "app", resourceType: resource.type, resourceName: resource.name }));
  return { evidence, template, mappings };
};

test("all 14 trusted emitter resource families retain explicit primary/support identity coverage", () => {
  for (const [kind, iconId] of supportedIcons) {
    const { template, mappings, evidence } = sample(iconId);
    const checked = inspectEngineeringCoverage(template, mappings, evidence);
    assert.equal(checked.mapping.status, "passed", `${kind}: ${checked.mapping.details.join("; ")}`);
    assert.equal(checked.coverage[0].status, "mapped", kind);
    assert.equal(checked.coverageCheck.status, "passed", kind);
    assert.notEqual(inspectEngineeringPrerequisites(template).status, "failed", kind);
  }
});

test("an App Service cannot be represented by a VM, Function App, or supporting plan alone", () => {
  for (const change of ["vm", "function", "support-only"]) {
    const { template, mappings, evidence } = sample();
    const site = template.resources.find((resource) => resource.type === "Microsoft.Web/sites");
    const mapping = mappings.find((resource) => resource.resourceType === site.type);
    if (change === "vm") {
      site.type = "Microsoft.Compute/virtualMachines";
      mapping.resourceType = site.type;
    } else if (change === "function") {
      site.kind = "functionapp,linux";
    } else {
      template.resources = template.resources.filter((resource) => resource !== site);
      mappings.splice(mappings.indexOf(mapping), 1);
    }
    assert.equal(inspectEngineeringCoverage(template, mappings, evidence).mapping.status, "failed", change);
  }
});

test("annotations and unsupported provider/product icons cannot be used as deployment evidence mappings", () => {
  for (const node of [
    { id: "app", kind: "shape", label: "App Service" },
    service("app", "aws/compute/lambda", "Azure App Service"),
    service("app", "azure/application/app-service-api", "Azure App Service"),
  ]) {
    const { template, mappings } = sample();
    const result = inspectEngineeringCoverage(template, mappings, graph([node]));
    assert.equal(result.mapping.status, "failed");
    assert.notEqual(result.coverage[0].status, "mapped");
  }
});

test("missing supported services and unsupported services remain explicit coverage gaps", () => {
  const { template, mappings, evidence } = sample();
  evidence.nodes.push(service("db", "azure/data/sql-database"), service("aws", "aws/compute/lambda"));
  const result = inspectEngineeringCoverage(template, mappings, evidence);
  assert.equal(result.mapping.status, "passed");
  assert.equal(result.coverageCheck.status, "not-verified");
  assert.deepEqual(result.coverage.map((row) => [row.nodeId, row.status]), [["app", "mapped"], ["db", "excluded"], ["aws", "unsupported"]]);
});

test("missing plan/workspace and malformed documented Web root fields do not pass prerequisite checks", () => {
  const { template } = sample();
  const site = template.resources.find((resource) => resource.type === "Microsoft.Web/sites");
  delete site.properties.serverFarmId;
  site.properties.identity = { type: "SystemAssigned" };
  const checked = inspectEngineeringPrerequisites(template);
  assert.equal(checked.status, "failed");
  assert.match(checked.details.join(" "), /plan reference/);
  assert.match(checked.details.join(" "), /resource root/);
  const insights = sample("azure/management/application-insights").template;
  delete insights.resources.find((resource) => resource.type === "Microsoft.Insights/components").properties.WorkspaceResourceId;
  assert.equal(inspectEngineeringPrerequisites(insights).status, "failed");
});

test("Function host configuration and Entra-only SQL requirements cannot be omitted", () => {
  const functions = sample("azure/application/function-app").template;
  const site = functions.resources.find((resource) => resource.type === "Microsoft.Web/sites");
  site.properties.siteConfig.appSettings = [];
  assert.equal(inspectEngineeringPrerequisites(functions).status, "failed");
  const sql = sample("azure/data/sql-database").template;
  const server = sql.resources.find((resource) => resource.type === "Microsoft.Sql/servers");
  server.properties.administrators.azureADOnlyAuthentication = false;
  assert.equal(inspectEngineeringPrerequisites(sql).status, "failed");
});

test("validation report schema rejects invented success or publication eligibility", () => {
  const checks = ["syntax", "resource-mappings", "coverage", "prerequisites", "artifact-consistency", "azure-environment"]
    .map((id) => ({ id, status: id === "azure-environment" ? "not-verified" : "passed", summary: "Synthetic check", details: [] }));
  const report = {
    version: 1, profile: "azure-static-v1", artifactHash: "a".repeat(64), checkedAt: "2026-09-20T00:00:00.000Z",
    status: "passed-static-checks", canPublish: true, checks, coverage: [],
    parser: { name: "synthetic", version: "1" }, disclaimer: ENGINEERING_VALIDATION_DISCLAIMER,
  };
  assert.equal(engineeringValidationSchema.safeParse(report).success, true);
  assert.equal(engineeringValidationSchema.safeParse({ ...report, checks: [...checks.slice(1), checks[1]] }).success, false);
  assert.equal(engineeringValidationSchema.safeParse({ ...report, checks: checks.map((check) => check.id === "syntax" ? { ...check, status: "failed" } : check) }).success, false);
  assert.equal(engineeringValidationSchema.safeParse({ ...report, checks: checks.map((check) => check.id === "azure-environment" ? { ...check, status: "passed" } : check) }).success, false);
});

test("actual Bicep parser plus static checks accept a self-contained matching App Service pair", async () => {
  const { evidence, template, mappings } = sample();
  const artifact = { format: "bicep", code: generateArchitectureCode(evidence, "bicep").output, armTemplate: template, resourceMappings: mappings };
  const report = await validateEngineeringArtifact(artifact, evidence);
  assert.equal(report.status, "passed-static-checks", JSON.stringify(report.checks));
  assert.equal(report.canPublish, true);
  assert.equal(report.checks.find((check) => check.id === "azure-environment").status, "not-verified");
  assert.equal((await validateEngineeringArtifact({ ...artifact, warnings: ["different non-executable notes"] }, evidence)).artifactHash, report.artifactHash);
});

test("invalid syntax, parameter-only code and a changed critical setting fail real acceptance", async () => {
  const { evidence, template, mappings } = sample();
  const good = generateArchitectureCode(evidence, "bicep").output;
  for (const code of ["THIS IS NOT BICEP {{{", "param location string = 'westeurope'\n", good.replace("httpsOnly: true", "httpsOnly: false")]) {
    const report = await validateEngineeringArtifact({ format: "bicep", code, armTemplate: template, resourceMappings: mappings }, evidence);
    assert.equal(report.status, "failed", code);
    assert.equal(report.canPublish, false);
  }
});

test("unused file-loading code is not certified and unsupported PowerShell never invokes its resolving parser", async () => {
  const { evidence, template, mappings } = sample();
  const artifact = { format: "bicep", code: generateArchitectureCode(evidence, "bicep").output + "\nvar hidden = loadTextContent('/never-open-this-file')\n", armTemplate: template, resourceMappings: mappings };
  const report = await validateEngineeringArtifact(artifact, evidence);
  assert.equal(report.status, "needs-review", JSON.stringify(report.checks));
  assert.equal(report.canPublish, false);
  const powershell = await validateEngineeringArtifact({ ...artifact, format: "powershell", code: "using module '/must-not-be-loaded'\n" }, evidence);
  assert.equal(powershell.checks[0].status, "not-verified");
  assert.equal(powershell.parser.name, "not-run");
  assert.equal(powershell.canPublish, false);
});

test("literal Terraform resource identities and explicit critical settings can match ARM without provider execution", async () => {
  const { evidence } = sample();
  const template = parseArmTemplate({
    $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    contentVersion: "1.0.0.0",
    resources: [
      { type: "Microsoft.Web/serverfarms", apiVersion: "2024-04-01", name: "shared-plan", location: "westeurope", kind: "linux", sku: { name: "P0v3" }, properties: { reserved: true } },
      { type: "Microsoft.Web/sites", apiVersion: "2024-04-01", name: "app-demo", location: "westeurope", kind: "app,linux", identity: { type: "SystemAssigned" }, properties: { serverFarmId: "[resourceId('Microsoft.Web/serverfarms', 'shared-plan')]", httpsOnly: true } },
    ],
  });
  const code = `terraform {
  required_providers {
    azurerm = {
      source = "hashicorp/azurerm"
      version = "~> 5.6"
    }
  }
}
resource "azurerm_service_plan" "main" {
  name = "shared-plan"
  resource_group_name = "rg-example"
  location = "westeurope"
  os_type = "Linux"
  sku_name = "P0v3"
}
resource "azurerm_linux_web_app" "app" {
  name = "app-demo"
  resource_group_name = "rg-example"
  location = "westeurope"
  service_plan_id = azurerm_service_plan.main.id
  https_only = true
  identity { type = "SystemAssigned" }
  site_config {}
}
`;
  const resourceMappings = template.resources.map((resource) => ({ nodeId: "app", resourceType: resource.type, resourceName: resource.name }));
  const report = await validateEngineeringArtifact({ format: "terraform", code, armTemplate: template, resourceMappings }, evidence);
  assert.equal(report.status, "passed-static-checks", JSON.stringify(report.checks));
  assert.equal(report.checks.at(-1).status, "not-verified");
  const changed = await validateEngineeringArtifact({ format: "terraform", code: code.replace("https_only = true", "https_only = false"), armTemplate: template, resourceMappings }, evidence);
  assert.equal(changed.status, "failed");
});
