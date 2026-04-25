/**
 * Infrastructure-as-Code emitters.
 *
 * Strategy: a small registry maps `iconId` (or icon-id prefix) to a set of
 * resource templates per IaC framework (`bicep`, `terraform`). The emitter
 * walks the graph, looks up each service node, and renders the corresponding
 * snippet. Unknown icons emit a `// TODO` comment so the output is always
 * valid-ish boilerplate the user can adapt.
 *
 * This is a starter — covers the most common Azure resources used by our
 * built-in templates. Easy to extend by adding entries to `IAC_REGISTRY`.
 */
import type { PlaygroundGraph, ServiceNodeData } from "./types";

export type IacFramework = "bicep" | "terraform";

interface IacResource {
  bicep?: (name: string, props: Record<string, string | number | boolean>) => string;
  terraform?: (name: string, props: Record<string, string | number | boolean>) => string;
}

function safeName(s: string): string {
  return (s || "resource")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24) || "resource";
}

function tfName(s: string): string {
  return (s || "resource")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "") || "resource";
}

const IAC_REGISTRY: Array<{ matches: RegExp; resource: IacResource }> = [
  // App Service / Web App
  {
    matches: /azure\/.*(app-service|webapp|app-services)/,
    resource: {
      bicep: (n) => `resource ${safeName(n)} 'Microsoft.Web/sites@2023-12-01' = {
  name: '${safeName(n)}'
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
  }
}`,
      terraform: (n) => `resource "azurerm_linux_web_app" "${tfName(n)}" {
  name                = "${tfName(n)}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  service_plan_id     = azurerm_service_plan.main.id
  site_config {}
}`,
    },
  },
  // SQL Database
  {
    matches: /azure\/.*(sql-database|sql-server)/,
    resource: {
      bicep: (n) => `resource ${safeName(n)} 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: '${safeName(n)}'
  location: location
  sku: { name: 'S0' }
}`,
      terraform: (n) => `resource "azurerm_mssql_database" "${tfName(n)}" {
  name      = "${tfName(n)}"
  server_id = azurerm_mssql_server.main.id
  sku_name  = "S0"
}`,
    },
  },
  // Storage
  {
    matches: /azure\/storage\//,
    resource: {
      bicep: (n) => `resource ${safeName(n)} 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: '${safeName(n)}sa'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
}`,
      terraform: (n) => `resource "azurerm_storage_account" "${tfName(n)}" {
  name                     = "${tfName(n)}sa"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}`,
    },
  },
  // API Management
  {
    matches: /azure\/.*api-management/,
    resource: {
      bicep: (n) => `resource ${safeName(n)} 'Microsoft.ApiManagement/service@2023-09-01-preview' = {
  name: '${safeName(n)}'
  location: location
  sku: { name: 'Developer', capacity: 1 }
  properties: {
    publisherEmail: 'admin@example.com'
    publisherName: 'Architecture Playground'
  }
}`,
      terraform: (n) => `resource "azurerm_api_management" "${tfName(n)}" {
  name                = "${tfName(n)}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  publisher_name      = "Architecture Playground"
  publisher_email     = "admin@example.com"
  sku_name            = "Developer_1"
}`,
    },
  },
  // Azure OpenAI / Cognitive Services
  {
    matches: /azure\/.*(openai|cognitive)/,
    resource: {
      bicep: (n) => `resource ${safeName(n)} 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: '${safeName(n)}'
  location: location
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: { customSubDomainName: '${safeName(n)}' }
}`,
      terraform: (n) => `resource "azurerm_cognitive_account" "${tfName(n)}" {
  name                = "${tfName(n)}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  kind                = "OpenAI"
  sku_name            = "S0"
}`,
    },
  },
  // Key Vault
  {
    matches: /azure\/.*key-vault/,
    resource: {
      bicep: (n) => `resource ${safeName(n)} 'Microsoft.KeyVault/vaults@2024-04-01-preview' = {
  name: '${safeName(n)}'
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
  }
}`,
      terraform: (n) => `resource "azurerm_key_vault" "${tfName(n)}" {
  name                       = "${tfName(n)}"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  enable_rbac_authorization  = true
}`,
    },
  },
  // Front Door / CDN
  {
    matches: /azure\/.*(front-door|cdn)/,
    resource: {
      bicep: (n) => `resource ${safeName(n)} 'Microsoft.Cdn/profiles@2024-02-01' = {
  name: '${safeName(n)}'
  location: 'Global'
  sku: { name: 'Standard_AzureFrontDoor' }
}`,
      terraform: (n) => `resource "azurerm_cdn_frontdoor_profile" "${tfName(n)}" {
  name                = "${tfName(n)}"
  resource_group_name = azurerm_resource_group.main.name
  sku_name            = "Standard_AzureFrontDoor"
}`,
    },
  },
];

function findResource(iconId: string): IacResource | undefined {
  for (const entry of IAC_REGISTRY) if (entry.matches.test(iconId)) return entry.resource;
  return undefined;
}

interface EmitResult {
  output: string;
  warnings: string[];
}

export function emitBicep(graph: PlaygroundGraph): EmitResult {
  const warnings: string[] = [];
  const lines: string[] = [
    "// Generated by Architecture Playground",
    `// ${graph.metadata?.name ?? "Architecture"} — ${new Date().toISOString()}`,
    "",
    "@description('Azure region')",
    "param location string = resourceGroup().location",
    "",
    "// NOTE: Some resources reference shared parents (appServicePlan, sqlServer)",
    "// that you'll need to define above based on your environment.",
    "",
  ];
  for (const n of graph.nodes) {
    if (n.type !== "service") continue;
    const d = n.data as ServiceNodeData;
    const res = findResource(d.iconId);
    if (res?.bicep) {
      lines.push(res.bicep(d.label || n.id, d.properties ?? {}));
      lines.push("");
    } else {
      warnings.push(`No Bicep template for "${d.iconId}" (${d.label || n.id})`);
      lines.push(`// TODO: implement ${d.iconId} (${d.label || n.id})`);
      lines.push("");
    }
  }
  return { output: lines.join("\n"), warnings };
}

export function emitTerraform(graph: PlaygroundGraph): EmitResult {
  const warnings: string[] = [];
  const lines: string[] = [
    "# Generated by Architecture Playground",
    `# ${graph.metadata?.name ?? "Architecture"} — ${new Date().toISOString()}`,
    "",
    'terraform {',
    '  required_providers {',
    '    azurerm = { source = "hashicorp/azurerm", version = "~> 4.0" }',
    '  }',
    '}',
    "",
    'provider "azurerm" { features {} }',
    "",
    'data "azurerm_client_config" "current" {}',
    "",
    'resource "azurerm_resource_group" "main" {',
    '  name     = "rg-architecture-playground"',
    '  location = "East US"',
    '}',
    "",
    "# NOTE: parent resources like azurerm_service_plan / azurerm_mssql_server",
    "# are referenced but not declared — add them to match your topology.",
    "",
  ];
  for (const n of graph.nodes) {
    if (n.type !== "service") continue;
    const d = n.data as ServiceNodeData;
    const res = findResource(d.iconId);
    if (res?.terraform) {
      lines.push(res.terraform(d.label || n.id, d.properties ?? {}));
      lines.push("");
    } else {
      warnings.push(`No Terraform template for "${d.iconId}" (${d.label || n.id})`);
      lines.push(`# TODO: implement ${d.iconId} (${d.label || n.id})`);
      lines.push("");
    }
  }
  return { output: lines.join("\n"), warnings };
}

export function emitIac(graph: PlaygroundGraph, framework: IacFramework): EmitResult {
  return framework === "bicep" ? emitBicep(graph) : emitTerraform(graph);
}
