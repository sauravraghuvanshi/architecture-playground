export type ArchitectureCodeFormat = "bicep" | "terraform" | "azure-cli" | "powershell";

interface ArchitectureNode {
  id: string;
  kind?: "icon" | "group" | "shape";
  label: string;
  iconId?: string;
}

interface ArchitecturePayload {
  nodes: ArchitectureNode[];
  edges: Array<{ id: string; source: string; target: string; label?: string }>;
}

type ResourceKind =
  | "app-service"
  | "sql"
  | "storage"
  | "apim"
  | "openai"
  | "key-vault"
  | "front-door"
  | "service-bus"
  | "cosmos"
  | "functions"
  | "aks"
  | "vnet"
  | "log-analytics"
  | "app-insights";

interface DetectedResource {
  id: string;
  name: string;
  variable: string;
  kind: ResourceKind;
}

export interface GeneratedArchitectureCode {
  format: ArchitectureCodeFormat;
  filename: string;
  language: string;
  output: string;
  warnings: string[];
  supportedNodes: number;
  totalServiceNodes: number;
}

const FORMAT_META: Record<
  ArchitectureCodeFormat,
  { filename: string; language: string }
> = {
  bicep: { filename: "main.bicep", language: "bicep" },
  terraform: { filename: "main.tf", language: "hcl" },
  "azure-cli": { filename: "deploy.sh", language: "bash" },
  powershell: { filename: "deploy.ps1", language: "powershell" },
};

const RESOURCE_MATCHERS: Array<[ResourceKind, RegExp]> = [
  ["front-door", /(front.?door|cdn)/i],
  ["apim", /(api.?management|apim)/i],
  ["functions", /(function.?app|azure.?functions|functions)/i],
  ["app-service", /(app.?service|web.?app|webapp)/i],
  ["sql", /(sql.?database|sql.?server|azure.?sql)/i],
  ["storage", /(storage.?account|blob.?storage|data.?lake)/i],
  ["service-bus", /(service.?bus)/i],
  ["cosmos", /(cosmos)/i],
  ["key-vault", /(key.?vault)/i],
  ["openai", /(openai|ai.?foundry|cognitive.?services)/i],
  ["aks", /(kubernetes|aks)/i],
  ["vnet", /(virtual.?network|vnet)/i],
  ["log-analytics", /(log.?analytics)/i],
  ["app-insights", /(application.?insights|app.?insights)/i],
];

function safeIdentifier(value: string, index: number): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20);
  return `${normalized || "resource"}${index + 1}`;
}

function safeResourceName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "resource";
}

function detectKind(node: ArchitectureNode): ResourceKind | null {
  const searchable = `${node.iconId ?? ""} ${node.label}`;
  return RESOURCE_MATCHERS.find(([, pattern]) => pattern.test(searchable))?.[0] ?? null;
}

function detectResources(payload: ArchitecturePayload): {
  resources: DetectedResource[];
  warnings: string[];
  totalServiceNodes: number;
} {
  const serviceNodes = payload.nodes.filter(
    (node) => node.kind !== "group" && node.kind !== "shape" && node.iconId
  );
  const resources: DetectedResource[] = [];
  const warnings: string[] = [];
  for (const [index, node] of serviceNodes.entries()) {
    const kind = detectKind(node);
    if (!kind) {
      warnings.push(`No deployable mapping for "${node.label}" (${node.iconId}).`);
      continue;
    }
    resources.push({
      id: node.id,
      name: safeResourceName(node.label),
      variable: safeIdentifier(node.label, index),
      kind,
    });
  }
  if (
    resources.some((resource) =>
      ["app-service", "functions", "apim", "openai", "aks"].includes(resource.kind)
    )
  ) {
    warnings.push(
      "Managed identities are created without data-plane role assignments because diagram edges do not encode operation or permission semantics. Add least-privilege roles before workload deployment."
    );
  }
  return { resources, warnings, totalServiceNodes: serviceNodes.length };
}

export interface GeneratedArmTemplate {
      template: Record<string, unknown>;
      warnings: string[];
      supportedNodes: number;
      totalServiceNodes: number;
    }

    export function generateArmTemplate(payload: ArchitecturePayload): GeneratedArmTemplate {
      const { resources, warnings, totalServiceNodes } = detectResources(payload);
      const kinds = uniqueKinds(resources);
      const parameters: Record<string, unknown> = {
        location: {
          type: "string",
          defaultValue: "[resourceGroup().location]",
          metadata: { description: "Azure region for regional resources." },
        },
      };
      if (kinds.has("sql")) {
        parameters.sqlAdminObjectId = {
          type: "string",
          metadata: { description: "Microsoft Entra group object ID for Azure SQL administration." },
        };
        parameters.sqlAdminLogin = {
          type: "string",
          defaultValue: "Azure SQL Administrators",
          metadata: { description: "Display name of the Microsoft Entra SQL administrator group." },
        };
      }
      if (kinds.has("apim")) {
        parameters.publisherEmail = {
          type: "string",
          metadata: { description: "API Management publisher email." },
        };
      }

      const armResources: Array<Record<string, unknown>> = [];
      if (kinds.has("app-service") || kinds.has("functions")) {
        armResources.push({
          type: "Microsoft.Web/serverfarms",
          apiVersion: "2024-04-01",
          name: "csa-plan",
          location: "[parameters('location')]",
          sku: { name: "P0v3", tier: "PremiumV3", capacity: 1 },
          kind: "linux",
          properties: { reserved: true },
        });
      }
      for (const resource of resources) {
        armResources.push(...armResourcesFor(resource));
      }
      if (resources.length === 0) {
        warnings.unshift("No supported Azure service nodes were found. Add Azure services before deployment.");
      }
      return {
        template: {
          $schema:
            "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
          contentVersion: "1.0.0.0",
          metadata: {
            _generator: {
              name: "Diagrammatic CSA Workspace",
              version: "1.0",
            },
          },
          parameters,
          variables: {
            uniqueSuffix: "[uniqueString(subscription().subscriptionId, resourceGroup().id)]",
          },
          resources: armResources,
          outputs: {
            mappedServiceCount: { type: "int", value: resources.length },
          },
        },
        warnings,
        supportedNodes: resources.length,
        totalServiceNodes,
      };
    }

    function armName(name: string, suffix = true): string {
      return suffix
        ? `[concat('${name}-', variables('uniqueSuffix'))]`
        : name;
    }

    function armResourcesFor(resource: DetectedResource): Array<Record<string, unknown>> {
      const { kind, name } = resource;
      const location = "[parameters('location')]";
      switch (kind) {
        case "app-service":
        case "functions":
          return [{
            type: "Microsoft.Web/sites",
            apiVersion: "2024-04-01",
            name: armName(name),
            location,
            kind: kind === "functions" ? "functionapp,linux" : "app,linux",
            identity: { type: "SystemAssigned" },
            dependsOn: ["[resourceId('Microsoft.Web/serverfarms', 'csa-plan')]"],
            properties: {
              serverFarmId: "[resourceId('Microsoft.Web/serverfarms', 'csa-plan')]",
              httpsOnly: true,
              siteConfig: {
                minTlsVersion: "1.2",
                ftpsState: "Disabled",
                alwaysOn: true,
              },
            },
          }];
        case "sql": {
          const serverName = `${name}-sql`;
          const serverExpression = `concat('${serverName}-', variables('uniqueSuffix'))`;
          return [
            {
              type: "Microsoft.Sql/servers",
              apiVersion: "2023-08-01-preview",
              name: `[${serverExpression}]`,
              location,
              identity: { type: "SystemAssigned" },
              properties: {
                minimalTlsVersion: "1.2",
                publicNetworkAccess: "Disabled",
                administrators: {
                  administratorType: "ActiveDirectory",
                  principalType: "Group",
                  login: "[parameters('sqlAdminLogin')]",
                  sid: "[parameters('sqlAdminObjectId')]",
                  tenantId: "[subscription().tenantId]",
                  azureADOnlyAuthentication: true,
                },
              },
            },
            {
              type: "Microsoft.Sql/servers/databases",
              apiVersion: "2023-08-01-preview",
              name: `[concat(${serverExpression}, '/${name}')]`,
              location,
              dependsOn: [`[resourceId('Microsoft.Sql/servers', ${serverExpression})]`],
              sku: { name: "S0", tier: "Standard" },
              properties: {},
            },
          ];
        }
        case "storage":
          return [{
            type: "Microsoft.Storage/storageAccounts",
            apiVersion: "2023-05-01",
            name: `[take(replace(concat('${name}', variables('uniqueSuffix')), '-', ''), 24)]`,
            location,
            sku: { name: "Standard_ZRS" },
            kind: "StorageV2",
            properties: {
              allowBlobPublicAccess: false,
              allowSharedKeyAccess: false,
              minimumTlsVersion: "TLS1_2",
              publicNetworkAccess: "Disabled",
            },
          }];
        case "apim":
          return [{
            type: "Microsoft.ApiManagement/service",
            apiVersion: "2024-05-01",
            name: armName(name),
            location,
            identity: { type: "SystemAssigned" },
            sku: { name: "Developer", capacity: 1 },
            properties: {
              publisherEmail: "[parameters('publisherEmail')]",
              publisherName: "CSA Architecture",
            },
          }];
        case "openai":
          return [{
            type: "Microsoft.CognitiveServices/accounts",
            apiVersion: "2024-10-01",
            name: armName(name),
            location,
            kind: "OpenAI",
            identity: { type: "SystemAssigned" },
            sku: { name: "S0" },
            properties: {
              customSubDomainName: armName(name),
              publicNetworkAccess: "Disabled",
              disableLocalAuth: true,
            },
          }];
        case "key-vault":
          return [{
            type: "Microsoft.KeyVault/vaults",
            apiVersion: "2024-11-01",
            name: armName(name),
            location,
            properties: {
              tenantId: "[subscription().tenantId]",
              enableRbacAuthorization: true,
              enablePurgeProtection: true,
              publicNetworkAccess: "Disabled",
              sku: { family: "A", name: "standard" },
            },
          }];
        case "front-door":
          return [{
            type: "Microsoft.Cdn/profiles",
            apiVersion: "2024-09-01",
            name: armName(name),
            location: "Global",
            sku: { name: "Standard_AzureFrontDoor" },
            properties: {},
          }];
        case "service-bus":
          return [{
            type: "Microsoft.ServiceBus/namespaces",
            apiVersion: "2024-01-01",
            name: armName(name),
            location,
            sku: { name: "Standard", tier: "Standard" },
            properties: {
              disableLocalAuth: true,
              minimumTlsVersion: "1.2",
              publicNetworkAccess: "Disabled",
            },
          }];
        case "cosmos":
          return [{
            type: "Microsoft.DocumentDB/databaseAccounts",
            apiVersion: "2024-11-15",
            name: armName(name),
            location,
            kind: "GlobalDocumentDB",
            properties: {
              databaseAccountOfferType: "Standard",
              disableLocalAuth: true,
              publicNetworkAccess: "Disabled",
              consistencyPolicy: { defaultConsistencyLevel: "Session" },
              locations: [{ locationName: location, failoverPriority: 0 }],
            },
          }];
        case "aks":
          return [{
            type: "Microsoft.ContainerService/managedClusters",
            apiVersion: "2024-10-01",
            name: armName(name),
            location,
            identity: { type: "SystemAssigned" },
            sku: { name: "Base", tier: "Standard" },
            properties: {
              dnsPrefix: name,
              enableRBAC: true,
              agentPoolProfiles: [{
                name: "system",
                count: 3,
                vmSize: "Standard_D4ds_v5",
                mode: "System",
                osType: "Linux",
                type: "VirtualMachineScaleSets",
              }],
            },
          }];
        case "vnet":
          return [{
            type: "Microsoft.Network/virtualNetworks",
            apiVersion: "2024-05-01",
            name: armName(name),
            location,
            properties: {
              addressSpace: { addressPrefixes: ["10.0.0.0/16"] },
              subnets: [{ name: "workload", properties: { addressPrefix: "10.0.1.0/24" } }],
            },
          }];
        case "log-analytics":
          return [{
            type: "Microsoft.OperationalInsights/workspaces",
            apiVersion: "2023-09-01",
            name: armName(name),
            location,
            properties: {
              sku: { name: "PerGB2018" },
              retentionInDays: 30,
              features: { enableLogAccessUsingOnlyResourcePermissions: true },
            },
          }];
        case "app-insights":
          return [{
            type: "Microsoft.Insights/components",
            apiVersion: "2020-02-02",
            name: armName(name),
            location,
            kind: "web",
            properties: { Application_Type: "web", DisableLocalAuth: true },
          }];
      }
    }
function uniqueKinds(resources: DetectedResource[]): Set<ResourceKind> {
  return new Set(resources.map((resource) => resource.kind));
}

function emitBicep(resources: DetectedResource[]): string {
  const kinds = uniqueKinds(resources);
  const lines = [
    "targetScope = 'resourceGroup'",
    "",
    "@description('Azure region for regional resources')",
    "param location string = resourceGroup().location",
    "",
    "@description('Short environment suffix used for globally unique names')",
    "param environmentName string = 'csa'",
    "",
    "var uniqueSuffix = uniqueString(subscription().subscriptionId, resourceGroup().id, environmentName)",
    "",
  ];

  if (kinds.has("sql")) {
    lines.push(
      "@description('Microsoft Entra group object ID for Azure SQL administration')",
      "param sqlAdminObjectId string",
      "@description('Display name of the Microsoft Entra SQL administrator group')",
      "param sqlAdminLogin string = 'Azure SQL Administrators'",
      ""
    );
  }
  if (kinds.has("apim")) {
    lines.push(
      "@description('API Management publisher email')",
      "param publisherEmail string",
      ""
    );
  }
  if (kinds.has("app-service") || kinds.has("functions")) {
    lines.push(
      "resource appServicePlan 'Microsoft.Web/serverfarms@2024-04-01' = {",
      "  name: '${environmentName}-plan-${uniqueSuffix}'",
      "  location: location",
      "  sku: { name: 'P0v3', tier: 'PremiumV3', capacity: 1 }",
      "  kind: 'linux'",
      "  properties: { reserved: true }",
      "}",
      ""
    );
  }

  for (const resource of resources) {
    lines.push(bicepResource(resource), "");
  }
  return lines.join("\n").trimEnd() + "\n";
}

function bicepResource(resource: DetectedResource): string {
  const { kind, name, variable } = resource;
  const globalName = `${name}-\${uniqueSuffix}`;
  switch (kind) {
    case "app-service":
    case "functions":
      return `resource ${variable} 'Microsoft.Web/sites@2024-04-01' = {
  name: '${globalName}'
  location: location
  kind: '${kind === "functions" ? "functionapp,linux" : "app,linux"}'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      alwaysOn: true
    }
  }
}`;
    case "sql":
      return `resource ${variable}Server 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: '${name}-sql-\${uniqueSuffix}'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Disabled'
    administrators: {
      administratorType: 'ActiveDirectory'
      principalType: 'Group'
      login: sqlAdminLogin
      sid: sqlAdminObjectId
      tenantId: subscription().tenantId
      azureADOnlyAuthentication: true
    }
  }
}

resource ${variable} 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: ${variable}Server
  name: '${name}'
  location: location
  sku: { name: 'S0', tier: 'Standard' }
}`;
    case "storage":
      return `resource ${variable} 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: take(replace('${name}\${uniqueSuffix}', '-', ''), 24)
  location: location
  sku: { name: 'Standard_ZRS' }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Disabled'
  }
}`;
    case "apim":
      return `resource ${variable} 'Microsoft.ApiManagement/service@2024-05-01' = {
  name: '${globalName}'
  location: location
  identity: { type: 'SystemAssigned' }
  sku: { name: 'Developer', capacity: 1 }
  properties: {
    publisherEmail: publisherEmail
    publisherName: 'CSA Architecture'
  }
}`;
    case "openai":
      return `resource ${variable} 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: '${globalName}'
  location: location
  kind: 'OpenAI'
  identity: { type: 'SystemAssigned' }
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: '${globalName}'
    publicNetworkAccess: 'Disabled'
    disableLocalAuth: true
  }
}`;
    case "key-vault":
      return `resource ${variable} 'Microsoft.KeyVault/vaults@2024-11-01' = {
  name: '${globalName}'
  location: location
  properties: {
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enablePurgeProtection: true
    publicNetworkAccess: 'Disabled'
    sku: { family: 'A', name: 'standard' }
  }
}`;
    case "front-door":
      return `resource ${variable} 'Microsoft.Cdn/profiles@2024-09-01' = {
  name: '${globalName}'
  location: 'Global'
  sku: { name: 'Standard_AzureFrontDoor' }
}`;
    case "service-bus":
      return `resource ${variable} 'Microsoft.ServiceBus/namespaces@2024-01-01' = {
  name: '${globalName}'
  location: location
  sku: { name: 'Standard', tier: 'Standard' }
  properties: {
    disableLocalAuth: true
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Disabled'
  }
}`;
    case "cosmos":
      return `resource ${variable} 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' = {
  name: '${globalName}'
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    disableLocalAuth: true
    publicNetworkAccess: 'Disabled'
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
    locations: [{ locationName: location, failoverPriority: 0 }]
  }
}`;
    case "aks":
      return `resource ${variable} 'Microsoft.ContainerService/managedClusters@2024-10-01' = {
  name: '${globalName}'
  location: location
  identity: { type: 'SystemAssigned' }
  sku: { name: 'Base', tier: 'Standard' }
  properties: {
    dnsPrefix: '${name}'
    enableRBAC: true
    agentPoolProfiles: [{
      name: 'system'
      count: 3
      vmSize: 'Standard_D4ds_v5'
      mode: 'System'
      osType: 'Linux'
      type: 'VirtualMachineScaleSets'
    }]
  }
}`;
    case "vnet":
      return `resource ${variable} 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: '${globalName}'
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.0.0.0/16'] }
    subnets: [{ name: 'workload', properties: { addressPrefix: '10.0.1.0/24' } }]
  }
}`;
    case "log-analytics":
      return `resource ${variable} 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${globalName}'
  location: location
        properties: {
          sku: { name: 'PerGB2018' }
          retentionInDays: 30
          features: { enableLogAccessUsingOnlyResourcePermissions: true }
        }
      }`;
    case "app-insights":
      return `resource ${variable} 'Microsoft.Insights/components@2020-02-02' = {
  name: '${globalName}'
  location: location
  kind: 'web'
  properties: { Application_Type: 'web', DisableLocalAuth: true }
}`;
  }
}

function emitTerraform(resources: DetectedResource[]): string {
  const kinds = uniqueKinds(resources);
  const lines = [
    'terraform {',
    '  required_version = ">= 1.7.0"',
    "  required_providers {",
    '    azurerm = { source = "hashicorp/azurerm", version = "~> 4.0" }',
    '    random  = { source = "hashicorp/random", version = "~> 3.6" }',
    "  }",
    "}",
    "",
    'provider "azurerm" {',
    "  features {}",
    "}",
    "",
    'variable "location" { type = string, default = "centralindia" }',
    'variable "resource_group_name" { type = string, default = "rg-csa-architecture" }',
  ];
  if (kinds.has("sql")) {
    lines.push(
      'variable "sql_admin_object_id" { type = string }',
      'variable "sql_admin_login" { type = string, default = "Azure SQL Administrators" }'
    );
  }
  if (kinds.has("apim")) {
    lines.push('variable "publisher_email" { type = string }');
  }
  lines.push(
    "",
    'resource "random_string" "suffix" { length = 6, special = false, upper = false }',
    "",
    'resource "azurerm_resource_group" "main" {',
    "  name     = var.resource_group_name",
    "  location = var.location",
    "}",
    ""
  );
  if (kinds.has("app-service") || kinds.has("functions")) {
    lines.push(
      'resource "azurerm_service_plan" "main" {',
      '  name                = "plan-csa-${random_string.suffix.result}"',
      "  resource_group_name = azurerm_resource_group.main.name",
      "  location            = azurerm_resource_group.main.location",
      '  os_type             = "Linux"',
      '  sku_name            = "P0v3"',
      "}",
      ""
    );
  }
  for (const resource of resources) {
    lines.push(terraformResource(resource), "");
  }
  return lines.join("\n").trimEnd() + "\n";
}

function terraformResource(resource: DetectedResource): string {
  const { kind, name, variable } = resource;
  const common = `  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location`;
  switch (kind) {
    case "app-service":
    case "functions":
      return `resource "azurerm_linux_${kind === "functions" ? "function_app" : "web_app"}" "${variable}" {
  name                = "${name}-\${random_string.suffix.result}"
${common}
  service_plan_id     = azurerm_service_plan.main.id
  https_only          = true
  identity { type = "SystemAssigned" }
  site_config {
    minimum_tls_version = "1.2"
    ftps_state          = "Disabled"
  }
}`;
    case "sql":
      return `resource "azurerm_mssql_server" "${variable}_server" {
  name                         = "${name}-sql-\${random_string.suffix.result}"
${common}
  version                      = "12.0"
  minimum_tls_version          = "1.2"
  public_network_access_enabled = false
  azuread_administrator {
    login_username              = var.sql_admin_login
    object_id                   = var.sql_admin_object_id
    azuread_authentication_only = true
  }
}

resource "azurerm_mssql_database" "${variable}" {
  name      = "${name}"
  server_id = azurerm_mssql_server.${variable}_server.id
  sku_name  = "S0"
}`;
    case "storage":
      return `resource "azurerm_storage_account" "${variable}" {
  name                          = substr(replace("${name}\${random_string.suffix.result}", "-", ""), 0, 24)
${common}
  account_tier                  = "Standard"
  account_replication_type      = "ZRS"
  min_tls_version               = "TLS1_2"
  shared_access_key_enabled     = false
  public_network_access_enabled = false
  allow_nested_items_to_be_public = false
}`;
    case "apim":
      return `resource "azurerm_api_management" "${variable}" {
  name                = "${name}-\${random_string.suffix.result}"
${common}
  publisher_name      = "CSA Architecture"
  publisher_email     = var.publisher_email
  sku_name            = "Developer_1"
  identity { type = "SystemAssigned" }
}`;
    case "openai":
      return `resource "azurerm_cognitive_account" "${variable}" {
  name                  = "${name}-\${random_string.suffix.result}"
${common}
  kind                  = "OpenAI"
  sku_name              = "S0"
  custom_subdomain_name = "${name}-\${random_string.suffix.result}"
  local_auth_enabled    = false
  public_network_access_enabled = false
  identity { type = "SystemAssigned" }
}`;
    case "key-vault":
      return `data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "${variable}" {
  name                       = "${name}-\${random_string.suffix.result}"
${common}
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  enable_rbac_authorization  = true
  purge_protection_enabled   = true
  public_network_access_enabled = false
}`;
    case "front-door":
      return `resource "azurerm_cdn_frontdoor_profile" "${variable}" {
  name                = "${name}-\${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.main.name
  sku_name            = "Standard_AzureFrontDoor"
}`;
    case "service-bus":
      return `resource "azurerm_servicebus_namespace" "${variable}" {
  name                          = "${name}-\${random_string.suffix.result}"
${common}
  sku                           = "Standard"
  local_auth_enabled            = false
  public_network_access_enabled = false
  minimum_tls_version           = "1.2"
}`;
    case "cosmos":
      return `resource "azurerm_cosmosdb_account" "${variable}" {
  name                          = "${name}-\${random_string.suffix.result}"
${common}
  offer_type                    = "Standard"
  kind                          = "GlobalDocumentDB"
  local_authentication_disabled = true
  public_network_access_enabled = false
  consistency_policy { consistency_level = "Session" }
  geo_location { location = var.location, failover_priority = 0 }
}`;
    case "aks":
      return `resource "azurerm_kubernetes_cluster" "${variable}" {
  name                = "${name}-\${random_string.suffix.result}"
${common}
  dns_prefix          = "${name}"
  sku_tier            = "Standard"
  default_node_pool { name = "system", node_count = 3, vm_size = "Standard_D4ds_v5" }
  identity { type = "SystemAssigned" }
  role_based_access_control_enabled = true
}`;
    case "vnet":
      return `resource "azurerm_virtual_network" "${variable}" {
  name                = "${name}-\${random_string.suffix.result}"
${common}
  address_space       = ["10.0.0.0/16"]
}`;
    case "log-analytics":
      return `resource "azurerm_log_analytics_workspace" "${variable}" {
  name                = "${name}-\${random_string.suffix.result}"
${common}
  sku                 = "PerGB2018"
  retention_in_days   = 30
}`;
    case "app-insights":
      return `resource "azurerm_application_insights" "${variable}" {
  name                = "${name}-\${random_string.suffix.result}"
${common}
  application_type    = "web"
  local_authentication_disabled = true
}`;
  }
}

function emitAzureCli(resources: DetectedResource[]): string {
  const kinds = uniqueKinds(resources);
  const lines = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    'LOCATION="${AZURE_LOCATION:-centralindia}"',
    'RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-csa-architecture}"',
    'SUFFIX="${AZURE_SUFFIX:-$RANDOM}"',
    "",
    "az account show --output none",
    'az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none',
    "",
  ];
  if (kinds.has("sql")) {
    lines.push(
      ': "${SQL_ADMIN_OBJECT_ID:?Set SQL_ADMIN_OBJECT_ID to a Microsoft Entra group object ID}"',
      'SQL_ADMIN_LOGIN="${SQL_ADMIN_LOGIN:-Azure SQL Administrators}"',
      ""
    );
  }
  if (kinds.has("apim")) {
    lines.push(': "${APIM_PUBLISHER_EMAIL:?Set APIM_PUBLISHER_EMAIL}"', "");
  }
  if (kinds.has("app-service") || kinds.has("functions")) {
    lines.push(
      'az appservice plan create --name "plan-csa-$SUFFIX" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --is-linux --sku P0V3 --output none',
      ""
    );
  }
  for (const resource of resources) {
    lines.push(cliResource(resource), "");
  }
  return lines.join("\n").trimEnd() + "\n";
}

function cliResource({ kind, name }: DetectedResource): string {
  const globalName = `${name}-$SUFFIX`;
  switch (kind) {
    case "app-service":
      return `az webapp create --name "${globalName}" --resource-group "$RESOURCE_GROUP" --plan "plan-csa-$SUFFIX" --runtime "NODE:20-lts" --output none
az webapp identity assign --name "${globalName}" --resource-group "$RESOURCE_GROUP" --output none
az webapp config set --name "${globalName}" --resource-group "$RESOURCE_GROUP" --min-tls-version 1.2 --ftps-state Disabled --output none`;
    case "functions":
      return `# Function Apps also require a secure storage account; review before deployment.
az functionapp create --name "${globalName}" --resource-group "$RESOURCE_GROUP" --plan "plan-csa-$SUFFIX" --runtime node --runtime-version 20 --functions-version 4 --assign-identity --output none`;
    case "sql":
      return `az sql server create --name "${name}-sql-$SUFFIX" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --enable-ad-only-auth --external-admin-name "$SQL_ADMIN_LOGIN" --external-admin-sid "$SQL_ADMIN_OBJECT_ID" --external-admin-principal-type Group --output none
az sql db create --name "${name}" --server "${name}-sql-$SUFFIX" --resource-group "$RESOURCE_GROUP" --service-objective S0 --output none`;
    case "storage":
      return `az storage account create --name "\${SUFFIX//-/}${name.replace(/-/g, "")}" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --sku Standard_ZRS --kind StorageV2 --min-tls-version TLS1_2 --allow-blob-public-access false --allow-shared-key-access false --public-network-access Disabled --output none`;
    case "apim":
      return `az apim create --name "${globalName}" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --publisher-name "CSA Architecture" --publisher-email "$APIM_PUBLISHER_EMAIL" --sku-name Developer --enable-managed-identity true --output none`;
    case "openai":
      return `az cognitiveservices account create --name "${globalName}" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --kind OpenAI --sku S0 --custom-domain "${globalName}" --assign-identity --yes --output none`;
    case "key-vault":
      return `az keyvault create --name "${globalName}" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --enable-rbac-authorization true --enable-purge-protection true --public-network-access Disabled --output none`;
    case "front-door":
      return `az afd profile create --profile-name "${globalName}" --resource-group "$RESOURCE_GROUP" --sku Standard_AzureFrontDoor --output none`;
    case "service-bus":
      return `az servicebus namespace create --name "${globalName}" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --sku Standard --disable-local-auth true --minimum-tls-version 1.2 --public-network-access Disabled --output none`;
    case "cosmos":
      return `az cosmosdb create --name "${globalName}" --resource-group "$RESOURCE_GROUP" --locations regionName="$LOCATION" failoverPriority=0 --default-consistency-level Session --disable-key-based-metadata-write-access true --enable-public-network false --output none`;
    case "aks":
      return `az aks create --name "${globalName}" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --node-count 3 --node-vm-size Standard_D4ds_v5 --enable-managed-identity --enable-aad --enable-azure-rbac --generate-ssh-keys --output none`;
    case "vnet":
      return `az network vnet create --name "${globalName}" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --address-prefixes 10.0.0.0/16 --subnet-name workload --subnet-prefixes 10.0.1.0/24 --output none`;
    case "log-analytics":
      return `az monitor log-analytics workspace create --workspace-name "${globalName}" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --retention-time 30 --output none`;
    case "app-insights":
      return `az monitor app-insights component create --app "${globalName}" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --kind web --application-type web --output none`;
  }
}

function emitPowerShell(resources: DetectedResource[]): string {
  const lines = [
    "Set-StrictMode -Version Latest",
    "$ErrorActionPreference = 'Stop'",
    "",
    "$Location = if ($env:AZURE_LOCATION) { $env:AZURE_LOCATION } else { 'centralindia' }",
    "$ResourceGroup = if ($env:AZURE_RESOURCE_GROUP) { $env:AZURE_RESOURCE_GROUP } else { 'rg-csa-architecture' }",
    "$Suffix = if ($env:AZURE_SUFFIX) { $env:AZURE_SUFFIX } else { (Get-Random -Minimum 1000 -Maximum 9999).ToString() }",
    "",
    "if (-not (Get-AzContext)) { Connect-AzAccount | Out-Null }",
    "New-AzResourceGroup -Name $ResourceGroup -Location $Location -Force | Out-Null",
    "",
    "# Deploy the canonical, reviewed Bicep generated for this architecture.",
    "# This preserves identical resource settings across PowerShell and Azure CLI workflows.",
    "$TemplateFile = Join-Path $PSScriptRoot 'main.bicep'",
    "if (-not (Test-Path $TemplateFile)) {",
    "  throw 'main.bicep was not found. Download the Bicep output beside this script.'",
    "}",
    "",
    "$Parameters = @{",
    "  location = $Location",
    "  environmentName = \"csa-$Suffix\"",
    "}",
  ];
  if (resources.some((resource) => resource.kind === "sql")) {
    lines.push(
      "if (-not $env:SQL_ADMIN_OBJECT_ID) { throw 'Set SQL_ADMIN_OBJECT_ID to a Microsoft Entra group object ID.' }",
      "$Parameters.sqlAdminObjectId = $env:SQL_ADMIN_OBJECT_ID",
      "$Parameters.sqlAdminLogin = if ($env:SQL_ADMIN_LOGIN) { $env:SQL_ADMIN_LOGIN } else { 'Azure SQL Administrators' }"
    );
  }
  if (resources.some((resource) => resource.kind === "apim")) {
    lines.push(
      "if (-not $env:APIM_PUBLISHER_EMAIL) { throw 'Set APIM_PUBLISHER_EMAIL.' }",
      "$Parameters.publisherEmail = $env:APIM_PUBLISHER_EMAIL"
    );
  }
  lines.push(
    "",
    "New-AzResourceGroupDeployment `",
    "  -Name \"csa-architecture-$Suffix\" `",
    "  -ResourceGroupName $ResourceGroup `",
    "  -TemplateFile $TemplateFile `",
    "  -TemplateParameterObject $Parameters `",
    "  -WhatIf",
    "",
    "Write-Host 'Review the What-If result, then rerun with -Confirm before deployment.'"
  );
  return lines.join("\n") + "\n";
}

export function generateArchitectureCode(
  payload: ArchitecturePayload,
  format: ArchitectureCodeFormat
): GeneratedArchitectureCode {
  const { resources, warnings, totalServiceNodes } = detectResources(payload);
  const meta = FORMAT_META[format];
  let output: string;
  switch (format) {
    case "bicep":
      output = emitBicep(resources);
      break;
    case "terraform":
      output = emitTerraform(resources);
      break;
    case "azure-cli":
      output = emitAzureCli(resources);
      break;
    case "powershell":
      output = emitPowerShell(resources);
      if (resources.length > 0) {
        warnings.push("PowerShell performs a safe What-If deployment of the generated main.bicep file.");
      }
      break;
  }
  if (resources.length === 0) {
    warnings.unshift("No supported Azure service nodes were found. Add Azure services before deployment.");
  }
  return {
    format,
    filename: meta.filename,
    language: meta.language,
    output,
    warnings,
    supportedNodes: resources.length,
    totalServiceNodes,
  };
}
