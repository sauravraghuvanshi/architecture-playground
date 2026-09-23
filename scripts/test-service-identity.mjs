import assert from "node:assert/strict";
import test from "node:test";
import { SERVICE_CATALOG, azureResourceKind, resolveServiceIcon, searchServiceIcons } from "../lib/service-identity.ts";
import { buildPromptArchitecture, promptToArchitecture } from "../lib/prompt-to-arch.ts";
import { resolveIconId, resolveGraphIcons } from "../components/playground/lib/resolve-icons.ts";
import { generateArchitectureCode, generateArmTemplate } from "../components/diagrammatic/csa/architecture-codegen.ts";
import { emitIac } from "../components/playground/lib/export-iac.ts";
import { correctDeploymentService, inspectDeploymentEligibility, deploymentEligibilityMessage } from "../lib/deployment-eligibility.ts";

const icons = [...SERVICE_CATALOG];
const byId = new Map(icons.map((icon) => [icon.id, icon]));
const appId = "azure/application/application-service";
const services = (payload) => payload.nodes.filter((node) => node.kind === "icon");
const payload = (iconId, label, cloud) => ({ nodes: [{ id: "service", kind: "icon", iconId, label, ...(cloud ? { cloud } : {}) }], edges: [] });

test("web app/App Service aliases produce exactly one actual service, never operation or file icons", () => {
  for (const catalog of [icons, [...icons].reverse()]) {
    const graph = promptToArchitecture("Azure web app with App Service and SQL Database", catalog, { guidedDesign: false });
    assert.ok(graph);
    assert.deepEqual(services(graph).map((node) => node.iconId).sort(), [appId, "azure/data/sql-database"].sort());
    assert.equal(services(graph).filter((node) => node.iconId === appId).length, 1);
    assert.equal(services(graph).find((node) => node.iconId === appId).label, "Azure App Service");
  }
});

test("scaffolding respects branded providers and reports absent or conflicting requirements", () => {
  const aws = buildPromptArchitecture("AWS S3, Lambda, DynamoDB and API Gateway", icons);
  assert.deepEqual(services(aws.payload).map((node) => node.iconId).sort(), [
    "aws/storage/simple-storage-service", "aws/compute/lambda", "aws/database/dynamodb",
  ].sort());
  assert.match(aws.diagnostics.unmatched.join(" "), /api gateway/i);
  const gcp = buildPromptArchitecture("GCP Cloud Run, BigQuery and Pub/Sub", icons);
  assert.deepEqual(services(gcp.payload).map((node) => node.iconId).sort(), ["gcp/compute/cloud-run", "gcp/analytics/big-query"].sort());
  assert.match(gcp.diagnostics.unmatched.join(" "), /pub\/sub/i);
  const conflict = buildPromptArchitecture("Azure serverless Lambda", icons);
  assert.equal(conflict.payload, null);
  assert.match(conflict.diagnostics.unmatched.join(" "), /belongs to AWS/);
  const partial = buildPromptArchitecture("Azure web app with App Service and Lambda", icons);
  assert.deepEqual(services(partial.payload).map((node) => node.iconId), [appId]);
  assert.equal(partial.diagnostics.unmatched.length, 1);
  assert.match(partial.diagnostics.unmatched[0], /Lambda/i);
});

test("separate named services remain distinct and provider-unspecified capabilities are explicit", () => {
  const both = buildPromptArchitecture("Azure SQL and PostgreSQL", icons);
  assert.deepEqual(services(both.payload).map((node) => node.iconId).sort(), ["azure/data/sql-database", "azure/data/azure-database-for-postgresql"].sort());
  const generic = buildPromptArchitecture("web app and serverless", icons);
  assert.equal(generic.payload, null);
  assert.equal(generic.diagnostics.unmatched.length, 2);
  const mixed = buildPromptArchitecture("AWS Lambda calls Azure App Service", icons);
  assert.deepEqual(services(mixed.payload).map((node) => node.iconId).sort(), [appId, "aws/compute/lambda"].sort());
  const plan = buildPromptArchitecture("Azure App Service Plan", icons);
  assert.equal(plan.payload, null);
  assert.match(plan.diagnostics.unmatched.join(" "), /app service plan/);
  const planAndApp = buildPromptArchitecture("Azure App Service Plan and App Service", icons);
  assert.deepEqual(services(planAndApp.payload).map((node) => node.iconId), [appId]);
  assert.match(planAndApp.diagnostics.unmatched.join(" "), /app service plan/);
  const vendorName = buildPromptArchitecture("Microsoft Windows on AWS EC2", icons);
  assert.deepEqual(services(vendorName.payload).map((node) => node.iconId), ["aws/compute/ec2"]);
  const variants = buildPromptArchitecture("Azure Container Apps Environment, Service Bus Queue, Azure SQL Server and Key Vault Managed HSM", icons);
  assert.deepEqual(services(variants.payload).map((node) => node.iconId).sort(), [
    "azure/application/container-app-environment", "azure/data/service-bus-queue",
    "azure/data/sql-server", "azure/security/azure-key-vault-managed-hsm",
  ].sort());
});

test("unknown identities do not become another cloud or an arbitrary first catalog icon", () => {
  for (const asked of ["aws/compute/key-vault", "aws/no-such-product", "", "gcp/ai/azure-openai"]) {
    assert.equal(resolveIconId(asked, icons, byId), undefined, asked);
  }
  assert.equal(resolveIconId(appId, icons, byId, "aws"), undefined);
  assert.equal(resolveIconId("azure/compute/app-service", icons, byId, "azure"), appId);
});

test("legacy graph identity normalization is atomic and surfaces unresolved metadata", () => {
  const graph = { nodes: [
    { id: "a", type: "service", data: { iconId: "azure/compute/app-service", cloud: "azure", label: "Custom label" } },
    { id: "b", type: "service", data: { iconId: "aws/compute/key-vault", cloud: "aws", label: "Secrets" } },
  ] };
  const before = structuredClone(graph);
  assert.equal(resolveGraphIcons(graph, icons, byId).length, 1);
  assert.deepEqual(graph, before);
  const valid = { nodes: [structuredClone(graph.nodes[0])] };
  assert.deepEqual(resolveGraphIcons(valid, icons, byId), []);
  assert.equal(valid.nodes[0].data.iconId, appId);
  assert.equal(valid.nodes[0].data.label, "Custom label");
});

test("renaming an App Service never changes resource kinds, providers or required parameters", () => {
  const expected = generateArmTemplate(payload(appId, "Payments")).template.resources.map(({ type, kind }) => ({ type, kind }));
  for (const label of ["Functions", "SQL Database", "Azure OpenAI", "Front Door", "Key Vault", "Application Insights"]) {
    const graph = payload(appId, label);
    const arm = generateArmTemplate(graph);
    assert.deepEqual(arm.template.resources.map(({ type, kind }) => ({ type, kind })), expected);
    assert.equal(arm.supportedNodes, 1);
    assert.equal("sqlAdminObjectId" in arm.template.parameters, false);
    assert.match(generateArchitectureCode(graph, "bicep").output, /kind: 'app,linux'/);
    assert.doesNotMatch(generateArchitectureCode(graph, "bicep").output, /functionapp,linux/);
    assert.match(generateArchitectureCode(graph, "terraform").output, /azurerm_linux_web_app/);
    assert.doesNotMatch(generateArchitectureCode(graph, "terraform").output, /azurerm_linux_function_app/);
    assert.match(generateArchitectureCode(graph, "azure-cli").output, /TEMPLATE_FILE="\$SCRIPT_DIR\/main.bicep"/);
    assert.doesNotMatch(generateArchitectureCode(graph, "azure-cli").output, /az (webapp|functionapp) create|SQL_ADMIN_OBJECT_ID/);
    assert.doesNotMatch(generateArchitectureCode(graph, "powershell").output, /SQL_ADMIN_OBJECT_ID/);
  }
});

test("every non-Azure catalog service stays non-Azure despite a misleading display label", () => {
  for (const icon of icons.filter((item) => item.cloud !== "azure")) {
    assert.equal(azureResourceKind(icon.id), undefined, icon.id);
    const result = generateArmTemplate(payload(icon.id, "Azure App Service Functions SQL Database"));
    assert.equal(result.supportedNodes, 0, icon.id);
    assert.deepEqual(result.template.resources, [], icon.id);
  }
  for (const format of ["bicep", "terraform", "azure-cli", "powershell"]) {
    const result = generateArchitectureCode(payload("aws/compute/lambda", "Azure Functions"), format);
    assert.equal(result.supportedNodes, 0);
    assert.match(result.warnings.join(" "), /No supported Azure/);
    if (format === "powershell") assert.match(result.output, /throw 'No supported Azure/);
    else assert.equal(result.output, "");
  }
});

test("feature and similar product icons never masquerade as deployable App Service, SQL, OpenAI or Vault", () => {
  for (const id of [
    "azure/application/web-app-file", "azure/application/app-service-api",
    "azure/security/azure-key-vault-managed-hsm", "azure/data/azure-database-for-mysql",
    "azure/data/azure-database-for-postgresql",
    "azure/storage/storage-account-queue",
  ]) {
    assert.ok(byId.has(id), `Fixture must be a real catalog asset: ${id}`);
    assert.equal(azureResourceKind(id), undefined, id);
    assert.equal(generateArmTemplate(payload(id, "SQL Database Azure OpenAI Key Vault App Service")).supportedNodes, 0, id);
  }
  assert.equal(azureResourceKind("azure/ai/cognitive-services-search"), "search", "Search is not an OpenAI alias");
});

test("legacy IaC uses the same canonical identity and blocks zero-mapping artifacts", () => {
  const graph = (id, label, cloud = "azure") => ({
    nodes: [{ id: "n", type: "service", position: { x: 0, y: 0 }, data: { iconId: id, label, cloud } }], edges: [],
  });
  for (const framework of ["bicep", "terraform"]) {
    const app = emitIac(graph(appId, "SQL Database"), framework);
    assert.deepEqual(app.warnings, generateArchitectureCode({
      nodes: [{ id: "n", kind: "icon", iconId: appId, label: "SQL Database", cloud: "azure" }], edges: [],
    }, framework).warnings);
    assert.match(app.warnings.join(" "), /Naming version 2/);
    assert.match(app.output, framework === "bicep" ? /Microsoft.Web\/sites/ : /azurerm_linux_web_app/);
    for (const [id, cloud] of [["aws/compute/lambda", "aws"], ["azure/application/app-service-api", "azure"], [appId, "aws"]]) {
      const unsupported = emitIac(graph(id, "Azure App Service", cloud), framework);
      assert.equal(unsupported.output, "");
      assert.match(unsupported.warnings.join(" "), /No supported Azure/);
    }
  }
});

test("identity resolution never uses renamed labels for a known ID or invents unknowns", () => {
  assert.equal(resolveServiceIcon({ iconId: appId, label: "AWS Lambda" }, icons)?.id, appId);
  assert.equal(resolveServiceIcon({ iconId: "aws/compute/key-vault", label: "Azure Key Vault" }, icons), undefined);
  assert.equal(resolveServiceIcon({ label: "Azure Unicorn Database" }, icons), undefined);
  assert.equal(resolveServiceIcon({ label: "SQL Database" }, icons), undefined);
  assert.equal(searchServiceIcons(icons, "App Service")[0].id, appId);
  assert.equal(searchServiceIcons(icons, "Azure App Service")[0].id, appId);
  assert.deepEqual(searchServiceIcons(icons, "Azure App Service", "aws"), []);
});

test("the palette's App Service API Management service illustration retains APIM deployment identity", () => {
  const id = "azure/application/app-service-api-management";
  assert.ok(byId.has(id));
  assert.equal(azureResourceKind(id), "apim");
  assert.equal(azureResourceKind(id, "aws"), undefined);
  const generated = generateArmTemplate(payload(id, "APP Service API Management"));
  assert.equal(generated.supportedNodes, 1);
  assert.ok(generated.template.resources.some((resource) => resource.type === "Microsoft.ApiManagement/service"));
  assert.equal(azureResourceKind("azure/application/app-service-management"), undefined, "A management operation must require explicit service correction, not infer identity from its label");
});

test("management symbols require explicit service correction which preserves the user's diagram", () => {
  const graph = { nodes: [
    { id: "client", kind: "shape", shape: "person", label: "Client", x: 0, y: 0 },
    { id: "apim", kind: "icon", iconId: "azure/application/app-service-api-management", iconPath: "", label: "APP Service API Management", x: 200, y: 0 },
    { id: "app", kind: "icon", iconId: "azure/application/app-service-management", iconPath: "", label: "APP Service", x: 400, y: 0 },
  ], edges: [{ id: "edge", source: "apim", target: "app", label: "HTTPS" }] };
  const before = structuredClone(graph);
  const readiness = inspectDeploymentEligibility(graph);
  assert.equal(readiness.find((row) => row.nodeId === "apim").kind, "apim");
  assert.equal(readiness.find((row) => row.nodeId === "app").suggested.iconId, appId);
  const fixed = correctDeploymentService(graph, "app", appId);
  assert.deepEqual(graph, before);
  assert.equal(fixed.nodes[2].iconId, appId);
  assert.equal(fixed.nodes[2].label, "APP Service");
  assert.equal(fixed.nodes[2].x, 400);
  assert.equal(fixed.edges[0].source, "apim");
  assert.equal(fixed.edges[0].target, "app");
  assert.equal(generateArmTemplate(fixed).supportedNodes, 2);
  assert.throws(() => correctDeploymentService(graph, "client", appId), /not available/);
  assert.throws(() => correctDeploymentService(graph, "app", "aws/compute/ec2"), /not available/);
  assert.match(deploymentEligibilityMessage({ nodes: [graph.nodes[2]], edges: [] }), /APP Service Management.*Confirm Azure App Service/);
});
