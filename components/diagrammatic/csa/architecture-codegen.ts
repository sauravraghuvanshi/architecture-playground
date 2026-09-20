import { azureResourceKind, type AzureResourceKind } from "../../../lib/service-identity.ts";
import { emitTerraformDraft } from "./terraform-emitter.ts";
import { emitAzureCliDraft } from "./azure-cli-emitter.ts";

export type ArchitectureCodeFormat = "bicep" | "terraform" | "azure-cli" | "powershell";

interface ArchitectureNode {
  id: string;
  kind?: "icon" | "group" | "shape";
  label: string;
  iconId?: string;
  cloud?: string;
}

interface ArchitecturePayload {
  nodes: ArchitectureNode[];
  edges: Array<{ id: string; source: string; target: string; label?: string }>;
}

type ResourceKind = AzureResourceKind;

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
  powershell: { filename: "preview.ps1", language: "powershell" },
};

const HOST_BLOB_OWNER_ROLE = "b7e6dc6d-f1e8-4753-8033-0f276bb0955b";
const NODE_RUNTIME = "22";
const AZURERM_VERSION = "~> 5.6";

function nameHash(value: string): string {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619) >>> 0;
  return hash.toString(36).padStart(7, "0");
}

function allocateName(node: ArchitectureNode, used: Set<string>): string {
  const normalized = node.label.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");
  const prefix = (/^[a-z]/.test(normalized) ? normalized : `r${normalized}`).slice(0, 3).padEnd(3, "r");
  let salt = 0;
  let name = `${prefix}${nameHash(node.id)}`;
  while (used.has(name)) name = `${prefix}${nameHash(`${node.id}:${++salt}`)}`;
  used.add(name);
  return name;
}

function detectKind(node: ArchitectureNode): ResourceKind | null {
  return node.iconId ? azureResourceKind(node.iconId, node.cloud) ?? null : null;
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
  if (serviceNodes.some((node) => typeof node.id !== "string" || !node.id.trim()) ||
      new Set(serviceNodes.map((node) => node.id)).size !== serviceNodes.length) {
    throw new Error("Every service needs a unique, nonempty diagram ID before code generation.");
  }
  const usedNames = new Set<string>();
  for (const node of [...serviceNodes].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)) {
    const kind = detectKind(node);
    if (!kind) {
      warnings.push(`No deployable mapping for "${node.label}" (${node.iconId}).`);
      continue;
    }
    const name = allocateName(node, usedNames);
    resources.push({
      id: node.id,
      name,
      variable: `r${name}`,
      kind,
    });
  }
  if (
    resources.some((resource) =>
      ["app-service", "functions", "apim", "openai", "aks"].includes(resource.kind)
    )
  ) {
    warnings.push(
      "Workload data-plane permissions are not inferred from diagram edges. Add least-privilege roles before workload deployment; required Function host-storage permissions are generated separately."
    );
  }
  if (resources.length) {
    warnings.push("Naming version 2 derives bounded names from labels and stable node IDs. Use the same globally unique 3-10 character lowercase alphanumeric environmentName/AZURE_SUFFIX in every format. Review name changes before targeting existing resources.");
  }
  if (resources.some((resource) => resource.kind === "functions")) {
    warnings.push("Function drafts use Node 22 on a Dedicated plan with separate keyless host storage and a scoped managed identity. Host storage has authenticated public endpoints; configure private connectivity explicitly if required. Additional trigger/binding permissions are not inferred, and function code is not deployed.");
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
        environmentName: {
          type: "string", minLength: 3, maxLength: 10,
          metadata: { description: "Globally unique namespace: 3-10 lowercase letters/digits, beginning with a letter. Use the same value in every export format." },
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
          name: armName("csa-plan"),
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
              version: "2.0",
            },
          },
          parameters,
          variables: {
            uniqueSuffix: "[parameters('environmentName')]",
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
          return [...(kind === "functions" ? functionArmSupport(resource) : []), {
            type: "Microsoft.Web/sites",
            apiVersion: "2024-04-01",
            name: armName(name),
            location,
            kind: kind === "functions" ? "functionapp,linux" : "app,linux",
            identity: kind === "functions" ? {
              type: "SystemAssigned, UserAssigned",
              userAssignedIdentities: { [`[${functionIdentityId(name)}]`]: {} },
            } : { type: "SystemAssigned" },
            dependsOn: [
              "[resourceId('Microsoft.Web/serverfarms', concat('csa-plan-', variables('uniqueSuffix')))]",
              ...(kind === "functions" ? [`[${functionRoleId(name)}]`] : []),
            ],
            properties: {
              serverFarmId: "[resourceId('Microsoft.Web/serverfarms', concat('csa-plan-', variables('uniqueSuffix')))]",
              httpsOnly: true,
              siteConfig: {
                minTlsVersion: "1.2",
                ftpsState: "Disabled",
                alwaysOn: true,
                linuxFxVersion: `NODE|${NODE_RUNTIME}`,
                ...(kind === "functions" ? { appSettings: [
                  { name: "FUNCTIONS_EXTENSION_VERSION", value: "~4" },
                  { name: "FUNCTIONS_WORKER_RUNTIME", value: "node" },
                  { name: "AzureWebJobsStorage__credential", value: "managedidentity" },
                  { name: "AzureWebJobsStorage__clientId", value: `[reference(${functionIdentityId(name)}, '2023-01-31').clientId]` },
                  ...["blob", "queue", "table"].map((service) => ({
                    name: `AzureWebJobsStorage__${service}ServiceUri`,
                    value: `[reference(${functionStorageId(name)}, '2023-05-01').primaryEndpoints.${service}]`,
                  })),
                ] } : {}),
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
            name: `[concat('${name}', variables('uniqueSuffix'))]`,
            location,
            sku: { name: "Standard_ZRS" },
            kind: "StorageV2",
            properties: {
              supportsHttpsTrafficOnly: true,
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
            apiVersion: "2025-05-01",
            name: armName(name),
            location,
            identity: { type: "SystemAssigned" },
            sku: { name: "Base", tier: "Standard" },
            properties: {
              dnsPrefix: name,
              enableRBAC: true,
              nodeProvisioningProfile: { mode: "Manual" },
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
            type: "Microsoft.OperationalInsights/workspaces",
            apiVersion: "2023-09-01",
            name: armName(`${name}logs`), location,
            properties: { sku: { name: "PerGB2018" }, retentionInDays: 30, features: { enableLogAccessUsingOnlyResourcePermissions: true } },
          }, {
            type: "Microsoft.Insights/components",
            apiVersion: "2020-02-02",
            name: armName(name),
            location,
            kind: "web",
            dependsOn: [`[resourceId('Microsoft.OperationalInsights/workspaces', concat('${name}logs-', variables('uniqueSuffix')))]`],
            properties: {
              Application_Type: "web", DisableLocalAuth: true,
              WorkspaceResourceId: `[resourceId('Microsoft.OperationalInsights/workspaces', concat('${name}logs-', variables('uniqueSuffix')))]`,
            },
          }];
      }
    }

function functionStorageId(name: string): string {
  return `resourceId('Microsoft.Storage/storageAccounts', concat('${name}host', variables('uniqueSuffix')))`;
}

function functionIdentityId(name: string): string {
  return `resourceId('Microsoft.ManagedIdentity/userAssignedIdentities', concat('${name}hostid-', variables('uniqueSuffix')))`;
}

function functionRoleName(name: string): string {
  return `guid(${functionStorageId(name)}, ${functionIdentityId(name)}, '${HOST_BLOB_OWNER_ROLE}')`;
}

function functionRoleId(name: string): string {
  return `extensionResourceId(${functionStorageId(name)}, 'Microsoft.Authorization/roleAssignments', ${functionRoleName(name)})`;
}

function functionArmSupport({ name }: DetectedResource): Array<Record<string, unknown>> {
  return [{
    type: "Microsoft.Storage/storageAccounts", apiVersion: "2023-05-01",
    name: `[concat('${name}host', variables('uniqueSuffix'))]`,
    location: "[parameters('location')]", kind: "StorageV2", sku: { name: "Standard_LRS" },
    properties: { supportsHttpsTrafficOnly: true, minimumTlsVersion: "TLS1_2", allowBlobPublicAccess: false, allowSharedKeyAccess: false, publicNetworkAccess: "Enabled" },
  }, {
    type: "Microsoft.ManagedIdentity/userAssignedIdentities", apiVersion: "2023-01-31",
    name: armName(`${name}hostid`), location: "[parameters('location')]",
  }, {
    type: "Microsoft.Authorization/roleAssignments", apiVersion: "2022-04-01",
    name: `[${functionRoleName(name)}]`, scope: `[${functionStorageId(name)}]`,
    dependsOn: [`[${functionStorageId(name)}]`, `[${functionIdentityId(name)}]`],
    properties: {
      roleDefinitionId: `[subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '${HOST_BLOB_OWNER_ROLE}')]`,
      principalId: `[reference(${functionIdentityId(name)}, '2023-01-31').principalId]`,
      principalType: "ServicePrincipal",
    },
  }];
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
    "@description('Globally unique namespace: 3-10 lowercase letters/digits, beginning with a letter; use the same value in every format')",
    "@minLength(3)",
    "@maxLength(10)",
    "param environmentName string",
    "",
    "var uniqueSuffix = environmentName",
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
      "  name: 'csa-plan-${uniqueSuffix}'",
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

function functionBicepSupport({ name, variable }: DetectedResource): string {
  return `resource ${variable}HostStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: '${name}host\${uniqueSuffix}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    publicNetworkAccess: 'Enabled'
  }
}

resource ${variable}HostIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${name}hostid-\${uniqueSuffix}'
  location: location
}

resource ${variable}HostRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(${variable}HostStorage.id, ${variable}HostIdentity.id, '${HOST_BLOB_OWNER_ROLE}')
  scope: ${variable}HostStorage
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '${HOST_BLOB_OWNER_ROLE}')
    principalId: ${variable}HostIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

`;
}

function bicepResource(resource: DetectedResource): string {
  const { kind, name, variable } = resource;
  const globalName = `${name}-\${uniqueSuffix}`;
  switch (kind) {
    case "app-service":
    case "functions":
      return `${kind === "functions" ? functionBicepSupport(resource) : ""}resource ${variable} 'Microsoft.Web/sites@2024-04-01' = {
  name: '${globalName}'
  location: location
  kind: '${kind === "functions" ? "functionapp,linux" : "app,linux"}'
  identity: ${kind === "functions" ? `{
    type: 'SystemAssigned, UserAssigned'
    userAssignedIdentities: {
      '\${${variable}HostIdentity.id}': {}
    }
  }` : "{ type: 'SystemAssigned' }"}
${kind === "functions" ? `  dependsOn: [${variable}HostRole]\n` : ""}  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      alwaysOn: true
      linuxFxVersion: 'NODE|${NODE_RUNTIME}'
${kind === "functions" ? `      appSettings: [
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'AzureWebJobsStorage__credential', value: 'managedidentity' }
        { name: 'AzureWebJobsStorage__clientId', value: ${variable}HostIdentity.properties.clientId }
        { name: 'AzureWebJobsStorage__blobServiceUri', value: ${variable}HostStorage.properties.primaryEndpoints.blob }
        { name: 'AzureWebJobsStorage__queueServiceUri', value: ${variable}HostStorage.properties.primaryEndpoints.queue }
        { name: 'AzureWebJobsStorage__tableServiceUri', value: ${variable}HostStorage.properties.primaryEndpoints.table }
      ]\n` : ""}    }
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
  name: '${name}\${uniqueSuffix}'
  location: location
  sku: { name: 'Standard_ZRS' }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
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
      return `resource ${variable} 'Microsoft.ContainerService/managedClusters@2025-05-01' = {
  name: '${globalName}'
  location: location
  identity: { type: 'SystemAssigned' }
  sku: { name: 'Base', tier: 'Standard' }
  properties: {
    dnsPrefix: '${name}'
    enableRBAC: true
    nodeProvisioningProfile: { mode: 'Manual' }
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
      return `resource ${variable}Workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${name}logs-\${uniqueSuffix}'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
    features: { enableLogAccessUsingOnlyResourcePermissions: true }
  }
}

resource ${variable} 'Microsoft.Insights/components@2020-02-02' = {
  name: '${globalName}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    DisableLocalAuth: true
    WorkspaceResourceId: ${variable}Workspace.id
  }
}`;
  }
}
function emitPowerShell(resources: DetectedResource[]): string {
  const lines = [
    "# Preview only: no resource creation, update, deletion, sign-in or context switching.",
    "# Review main.bicep from this same offline export before running this script.",
    "# Requires Az.Accounts, Az.Resources and Bicep CLI installed separately.",
    "# -WhatIf skips the Azure request; -Confirm asks only about running the preview.",
    "[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]",
    "param()",
    "",
    "Set-StrictMode -Version Latest",
    "$ErrorActionPreference = 'Stop'",
    "",
  ];
  if (resources.length === 0) {
    return [...lines, "throw 'No supported Azure services were found. Nothing was previewed or deployed.'", ""].join("\n");
  }
  lines.push(
    "$TemplateFile = Join-Path $PSScriptRoot 'main.bicep'",
    "if (-not (Test-Path -LiteralPath $TemplateFile -PathType Leaf) -or (Get-Item -LiteralPath $TemplateFile).Length -eq 0) {",
    "  throw 'A nonempty main.bicep is required. Download and review the companion Bicep beside this script.'",
    "}",
    "$SubscriptionId = [guid]::Empty",
    "if (-not [guid]::TryParse($env:AZURE_SUBSCRIPTION_ID, [ref]$SubscriptionId) -or $SubscriptionId -eq [guid]::Empty) {",
    "  throw 'Set AZURE_SUBSCRIPTION_ID to the intended subscription GUID.'",
    "}",
    "if ([string]::IsNullOrWhiteSpace($env:AZURE_RESOURCE_GROUP)) {",
    "  throw 'Set AZURE_RESOURCE_GROUP to an existing resource group. This script will not create it.'",
    "}",
    "$ResourceGroupName = $env:AZURE_RESOURCE_GROUP.Trim()",
    "if ($env:AZURE_SUFFIX -cnotmatch '\\A[a-z][a-z0-9]{2,9}\\z') {",
    "  throw 'Set AZURE_SUFFIX to a globally unique 3-10 character lowercase letter/digit namespace starting with a letter.'",
    "}",
    "$Parameters = @{ environmentName = $env:AZURE_SUFFIX }",
  );
  if (resources.some((resource) => resource.kind === "sql")) {
    lines.push(
      "$SqlAdminId = [guid]::Empty",
      "if (-not [guid]::TryParse($env:SQL_ADMIN_OBJECT_ID, [ref]$SqlAdminId) -or $SqlAdminId -eq [guid]::Empty) {",
      "  throw 'Set SQL_ADMIN_OBJECT_ID to a Microsoft Entra group object ID.'",
      "}",
      "$Parameters.sqlAdminObjectId = $SqlAdminId.ToString()",
      "$Parameters.sqlAdminLogin = if ([string]::IsNullOrWhiteSpace($env:SQL_ADMIN_LOGIN)) { 'Azure SQL Administrators' } else { $env:SQL_ADMIN_LOGIN.Trim() }",
    );
  }
  if (resources.some((resource) => resource.kind === "apim")) {
    lines.push(
      "if ([string]::IsNullOrWhiteSpace($env:APIM_PUBLISHER_EMAIL)) { throw 'Set APIM_PUBLISHER_EMAIL to a valid email address.' }",
      "try { $Publisher = [System.Net.Mail.MailAddress]::new($env:APIM_PUBLISHER_EMAIL) }",
      "catch { throw 'Set APIM_PUBLISHER_EMAIL to a valid email address.' }",
      "if ($Publisher.Address -ne $env:APIM_PUBLISHER_EMAIL -or $Publisher.Host -notlike '*.*') { throw 'Set APIM_PUBLISHER_EMAIL to a valid email address.' }",
      "$Parameters.publisherEmail = $Publisher.Address",
    );
  }
  lines.push(
    "",
    "# Preflight dependencies and local sign-in context; never install or sign in automatically.",
    "Get-Command -Name Get-AzContext, Get-AzResourceGroup, Get-AzResourceGroupDeploymentWhatIfResult -ErrorAction Stop | Out-Null",
    "Get-Command -Name bicep -CommandType Application -ErrorAction Stop | Out-Null",
    "$Context = Get-AzContext -ErrorAction Stop",
    "if ($null -eq $Context -or $null -eq $Context.Subscription) {",
    "  throw 'Sign in and select the intended subscription separately before previewing.'",
    "}",
    "if ([guid]$Context.Subscription.Id -ne $SubscriptionId) {",
    "  throw 'The current Azure context does not match AZURE_SUBSCRIPTION_ID. Select the intended subscription separately.'",
    "}",
    "if (-not $PSCmdlet.ShouldProcess(\"$SubscriptionId/$ResourceGroupName\", 'Request What-If preview only (no resource changes)')) {",
    "  Write-Host 'Preview cancelled. No Azure resource lookup or What-If request was sent.'",
    "  return",
    "}",
    "",
    "$ResourceGroup = Get-AzResourceGroup -Name $ResourceGroupName -DefaultProfile $Context -ErrorAction Stop",
    "if ($null -eq $ResourceGroup) { throw 'The resource group does not exist. This preview will not create it.' }",
    "$Parameters.location = if ([string]::IsNullOrWhiteSpace($env:AZURE_LOCATION)) { $ResourceGroup.Location } else { $env:AZURE_LOCATION.Trim() }",
    "",
    "$Result = Get-AzResourceGroupDeploymentWhatIfResult `",
    "  -ResourceGroupName $ResourceGroupName `",
    "  -TemplateFile $TemplateFile `",
    "  -TemplateParameterObject $Parameters `",
    "  -Mode Incremental `",
    "  -SkipTemplateParameterPrompt `",
    "  -DefaultProfile $Context `",
    "  -ErrorAction Stop",
    "$Result",
    "if ($null -eq $Result -or $Result.Status -ne 'Succeeded') { throw 'Azure What-If did not succeed. Review diagnostics; no deployment was attempted.' }",
    "",
    "Write-Host 'Preview complete. No resources were deployed. Review limitations, policy and cost; actual deployment requires a separate approved workflow or Azure Portal action.'"
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
      output = emitTerraformDraft(resources, { nodeRuntime: NODE_RUNTIME, providerVersion: AZURERM_VERSION });
      break;
    case "azure-cli":
      output = emitAzureCliDraft({ sql: resources.some((resource) => resource.kind === "sql"), apim: resources.some((resource) => resource.kind === "apim") });
      if (resources.length) warnings.push("Download the matching main.bicep beside deploy.sh. The CLI wrapper validates the existing subscription/group and previews by default. --deploy is an explicit write action after What-If; review the template and permissions first.");
      break;
    case "powershell":
      output = emitPowerShell(resources);
      if (resources.length > 0) {
        warnings.push("Offline PowerShell is preview-only: download the companion main.bicep, review both files, and set AZURE_SUBSCRIPTION_ID, AZURE_RESOURCE_GROUP (existing), and a stable AZURE_SUFFIX. Install Az.Accounts, Az.Resources and Bicep CLI separately. No resources are created; the script will not sign in or switch subscriptions.");
        warnings.push("What-If contacts Azure and checks permissions; it is not a deployment or a guarantee of completeness. -WhatIf skips the remote request; -Confirm confirms only preview. Actual deployment remains a separate approved workflow or Azure Portal action. Other formats and Foundry drafts are not covered by this preview-only guarantee.");
      }
      break;
  }
  if (resources.length === 0) {
    warnings.unshift("No supported Azure service nodes were found. Add Azure services before deployment.");
    if (format !== "powershell") output = "";
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
