import assert from "node:assert/strict";
import test from "node:test";
import { generateArchitectureCode, generateArmTemplate } from "../components/diagrammatic/csa/architecture-codegen.ts";
import { emitIac } from "../components/playground/lib/export-iac.ts";
import { parseArmTemplate } from "../lib/deployment-assistance.ts";
import { allKinds, compilerFixtures, edgeNames, graph, repeatedKinds, service } from "./iac-fixtures.mjs";

const formats = ["bicep", "terraform", "azure-cli", "powershell"];
const resources = (payload, type) => generateArmTemplate(payload).template.resources.filter((item) => item.type === type);
const output = (payload, format) => generateArchitectureCode(payload, format).output;

test("every supported single and repeated graph passes the unchanged safe ARM handoff validator", () => {
  for (const [name, payload] of compilerFixtures) {
    const arm = generateArmTemplate(payload);
    assert.equal(arm.supportedNodes, payload.nodes.length, name);
    assert.doesNotThrow(() => parseArmTemplate(arm.template), name);
    assert.equal(arm.template.metadata._generator.version, "2.0");
  }
});

test("names and symbols are bounded, unique and deterministic with duplicates, leading digits and Unicode", () => {
  for (const payload of [repeatedKinds, edgeNames]) {
    const template = generateArmTemplate(payload).template;
    const keys = template.resources.map(({ type, name }) => `${type}/${name}`);
    assert.equal(new Set(keys).size, keys.length);
    for (const resource of template.resources.filter((item) => item.type === "Microsoft.Storage/storageAccounts")) {
      const match = /^\[concat\('([a-z][a-z0-9]*)', variables\('uniqueSuffix'\)\)\]$/.exec(resource.name);
      assert.ok(match, resource.name);
      assert.ok(match[1].length + 10 <= 24, "maximum namespace must fit storage names");
    }
    for (const format of formats) {
      const code = output(payload, format);
      assert.equal(code, output({ ...payload, nodes: [...payload.nodes].reverse() }, format), format);
      assert.equal(code, output(structuredClone(payload), format), format);
    }
    const symbols = [...output(payload, "bicep").matchAll(/^resource (\w+) /gm)].map((match) => match[1]);
    assert.ok(symbols.every((symbol) => /^[A-Za-z][A-Za-z0-9]*$/.test(symbol)));
    assert.equal(new Set(symbols).size, symbols.length);
  }
});

test("invalid service IDs fail explicitly in every emitter and legacy export contains no usable artifact", () => {
  for (const ids of [["duplicate", "duplicate"], ["", "valid"], ["   ", "valid"]]) {
    const payload = graph(ids.map((id) => service(id, "azure/application/application-service")));
    for (const format of formats) assert.throws(() => output(payload, format), /unique, nonempty diagram ID/);
    assert.throws(() => generateArmTemplate(payload), /unique, nonempty diagram ID/);
    const legacy = emitIac({ nodes: payload.nodes.map(({ id, ...data }) => ({ id, type: "service", data })), edges: [] }, "bicep");
    assert.equal(legacy.output, "");
    assert.match(legacy.warnings.join(" "), /unique, nonempty diagram ID/);
  }
});

test("both editors emit identical drafts and warnings for every supported kind", () => {
  for (const [, payload] of compilerFixtures) {
    const legacy = { nodes: payload.nodes.map(({ id, ...data }) => ({ id, type: "service", position: { x: 0, y: 0 }, data })), edges: [] };
    for (const format of ["bicep", "terraform"]) {
      // Legacy labels deliberately fall back to ID only when no label was supplied.
      const normalized = { ...payload, nodes: payload.nodes.map((node) => ({ ...node, label: node.label || node.id })) };
      const native = generateArchitectureCode(normalized, format);
      assert.deepEqual(emitIac(legacy, format), { output: native.output, warnings: native.warnings });
    }
  }
});

test("common configuration targets an existing RG and uses one explicit namespace without a random default", () => {
  const arm = generateArmTemplate(allKinds).template;
  assert.equal(arm.parameters.environmentName.minLength, 3);
  assert.equal(arm.parameters.environmentName.maxLength, 10);
  assert.equal("defaultValue" in arm.parameters.environmentName, false);
  assert.equal(arm.variables.uniqueSuffix, "[parameters('environmentName')]");
  assert.match(output(allKinds, "bicep"), /@minLength\(3\)\s+@maxLength\(10\)\s+param environmentName string/);
  const tf = output(allKinds, "terraform");
  assert.match(tf, /data "azurerm_resource_group" "target"/);
  assert.doesNotMatch(tf, /resource "azurerm_resource_group"/);
  assert.match(tf, /subscription_id\s+= var.subscription_id/);
  assert.match(tf, /regex\("\^\[a-z\]\[a-z0-9\]\{2,9\}\$"/);
  assert.doesNotMatch(formats.map((format) => output(allKinds, format)).join("\n"), /uniqueString|random_string|csa-\$env:AZURE_SUFFIX/);
});

test("repeated prerequisites never duplicate shared plans or client configuration", () => {
  assert.equal(resources(repeatedKinds, "Microsoft.Web/serverfarms").length, 1);
  const tf = output(repeatedKinds, "terraform");
  assert.equal([...tf.matchAll(/data "azurerm_client_config" "current"/g)].length, 1);
  assert.equal([...tf.matchAll(/resource "azurerm_service_plan" "main"/g)].length, 1);
  assert.equal([...output(repeatedKinds, "bicep").matchAll(/resource appServicePlan /g)].length, 1);
});

test("Function apps include isolated keyless host storage, scoped identity/role and explicit runtime dependencies", () => {
  const payload = graph(["first", "second"].map((id) => service(id, "azure/application/function-app", "Duplicate")));
  const arm = generateArmTemplate(payload).template;
  const storage = arm.resources.filter(({ type }) => type === "Microsoft.Storage/storageAccounts");
  const identities = arm.resources.filter(({ type }) => type === "Microsoft.ManagedIdentity/userAssignedIdentities");
  const roles = arm.resources.filter(({ type }) => type === "Microsoft.Authorization/roleAssignments");
  const sites = arm.resources.filter(({ type }) => type === "Microsoft.Web/sites");
  for (const collection of [storage, identities, roles, sites]) assert.equal(collection.length, 2);
  for (const account of storage) {
    assert.equal(account.properties.allowSharedKeyAccess, false);
    assert.equal(account.properties.allowBlobPublicAccess, false);
    assert.equal(account.properties.supportsHttpsTrafficOnly, true);
    assert.equal(account.properties.publicNetworkAccess, "Enabled");
    assert.equal(account.sku.name, "Standard_LRS");
  }
  for (const role of roles) {
    assert.match(role.scope, /resourceId\('Microsoft.Storage\/storageAccounts'/);
    assert.match(role.properties.roleDefinitionId, /b7e6dc6d-f1e8-4753-8033-0f276bb0955b/);
    assert.match(role.properties.principalId, /Microsoft.ManagedIdentity\/userAssignedIdentities/);
    assert.equal(role.dependsOn.length, 2);
  }
  for (const site of sites) {
    assert.equal(site.identity.type, "SystemAssigned, UserAssigned");
    assert.ok(site.dependsOn.some((id) => id.includes("Microsoft.Authorization/roleAssignments")));
    assert.equal(site.properties.siteConfig.linuxFxVersion, "NODE|22");
    const settings = Object.fromEntries(site.properties.siteConfig.appSettings.map(({ name, value }) => [name, value]));
    assert.equal(settings.FUNCTIONS_EXTENSION_VERSION, "~4");
    assert.equal(settings.FUNCTIONS_WORKER_RUNTIME, "node");
    assert.equal(settings.AzureWebJobsStorage__credential, "managedidentity");
    assert.match(settings.AzureWebJobsStorage__clientId, /\.clientId\]/);
    for (const endpoint of ["blob", "queue", "table"]) assert.match(settings[`AzureWebJobsStorage__${endpoint}ServiceUri`], new RegExp(`primaryEndpoints\\.${endpoint}`));
  }
  const bicep = output(payload, "bicep");
  assert.equal([...bicep.matchAll(/scope: \w+HostStorage/g)].length, 2);
  assert.equal([...bicep.matchAll(/dependsOn: \[\w+HostRole\]/g)].length, 2);
  const tf = output(payload, "terraform");
  assert.equal([...tf.matchAll(/storage_uses_managed_identity\s+= true/g)].length, 2);
  assert.equal([...tf.matchAll(/depends_on = \[azurerm_role_assignment\.\w+_host_blob\]/g)].length, 2);
  assert.doesNotMatch(bicep + tf + JSON.stringify(arm), /listKeys|storage_account_access_key|AccountKey=|WEBSITE_CONTENTAZUREFILECONNECTIONSTRING/);
  assert.match(generateArmTemplate(payload).warnings.join(" "), /Additional trigger\/binding permissions are not inferred/);
});

test("App Insights workspace and workload subnet prerequisites are present in every declarative format", () => {
  const insights = resources(allKinds, "Microsoft.Insights/components")[0];
  assert.match(insights.properties.WorkspaceResourceId, /logs-/);
  assert.equal(insights.dependsOn[0], insights.properties.WorkspaceResourceId);
  assert.equal(resources(allKinds, "Microsoft.Network/virtualNetworks")[0].properties.subnets[0].name, "workload");
  for (const [format, patterns] of [
    ["bicep", [/WorkspaceResourceId: \w+Workspace.id/, /subnets: \[\{ name: 'workload'/]],
    ["terraform", [/workspace_id\s+= azurerm_log_analytics_workspace\.\w+_workspace.id/, /resource "azurerm_subnet"/, /address_prefixes\s+= \["10.0.1.0\/24"\]/]],
  ]) for (const pattern of patterns) assert.match(output(allKinds, format), pattern);
});

test("all generated formats preserve Entra-only SQL and contain no credential defaults", () => {
  const arm = generateArmTemplate(allKinds).template;
  assert.equal(resources(allKinds, "Microsoft.Sql/servers")[0].properties.administrators.azureADOnlyAuthentication, true);
  assert.equal("defaultValue" in arm.parameters.sqlAdminObjectId, false);
  assert.match(output(allKinds, "bicep"), /azureADOnlyAuthentication: true/);
  assert.match(output(allKinds, "terraform"), /azuread_authentication_only\s+= true/);
  assert.doesNotMatch(JSON.stringify(arm) + formats.map((format) => output(allKinds, format)).join("\n"), /administratorLoginPassword|administrator_login_password|AccountKey=/i);
});
