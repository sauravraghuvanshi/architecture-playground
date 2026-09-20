import type { AzureResourceKind } from "../../../lib/service-identity.ts";

interface Resource {
  id: string;
  name: string;
  variable: string;
  kind: AzureResourceKind;
}

interface Options {
  nodeRuntime: string;
  providerVersion: string;
}

export function emitTerraformDraft(resources: readonly Resource[], options: Options): string {
  const kinds = new Set(resources.map((resource) => resource.kind));
  const lines = [
    "terraform {",
    '  required_version = ">= 1.7.0"',
    "  required_providers {",
    "    azurerm = {",
    '      source  = "hashicorp/azurerm"',
    `      version = "${options.providerVersion}"`,
    "    }",
    "  }",
    "}",
    "",
    'provider "azurerm" {',
    "  subscription_id = var.subscription_id",
    "  features {}",
    "}",
    "",
    'variable "subscription_id" {',
    "  type        = string",
    '  description = "Target Azure subscription ID; no subscription is inferred from the diagram."',
    "}",
    "",
    'variable "resource_group_name" {',
    "  type        = string",
    '  description = "Existing target resource group; this draft does not create it."',
    "}",
    "",
    'variable "environment_name" {',
    "  type        = string",
    '  description = "Use the same globally unique namespace as Bicep/ARM environmentName and AZURE_SUFFIX."',
    "  validation {",
    '    condition     = can(regex("^[a-z][a-z0-9]{2,9}$", var.environment_name))',
    '    error_message = "Use 3-10 lowercase letters/digits beginning with a letter."',
    "  }",
    "}",
    "",
    'variable "location" {',
    "  type        = string",
    "  default     = null",
    '  description = "Regional resource location; defaults to the existing resource group location."',
    "}",
    "",
    'data "azurerm_resource_group" "target" {',
    "  name = var.resource_group_name",
    "}",
    "",
    "locals {",
    "  location = coalesce(var.location, data.azurerm_resource_group.target.location)",
    "}",
  ];
  if (kinds.has("sql") || kinds.has("key-vault")) {
    lines.push("", 'data "azurerm_client_config" "current" {}');
  }
  if (kinds.has("sql")) {
    lines.push("", 'variable "sql_admin_object_id" {', "  type = string", "}", "",
      'variable "sql_admin_login" {', "  type    = string", '  default = "Azure SQL Administrators"', "}");
  }
  if (kinds.has("apim")) lines.push("", 'variable "publisher_email" {', "  type = string", "}");
  if (kinds.has("app-service") || kinds.has("functions")) {
    lines.push("", `resource "azurerm_service_plan" "main" {
  name                = "csa-plan-\${var.environment_name}"
  resource_group_name = data.azurerm_resource_group.target.name
  location            = local.location
  os_type             = "Linux"
  sku_name            = "P0v3"
}`);
  }
  for (const resource of resources) lines.push("", terraformResource(resource, options));
  return alignAssignments(lines.join("\n").trimEnd() + "\n");
}

function alignAssignments(source: string): string {
  const lines = source.split("\n");
  for (let start = 0; start < lines.length; start++) {
    const first = /^(\s*)([a-zA-Z][a-zA-Z0-9_]*)\s*=\s*(.*)$/.exec(lines[start]);
    if (!first) continue;
    const group = [first];
    let end = start + 1;
    for (; end < lines.length; end++) {
      const match = /^(\s*)([a-zA-Z][a-zA-Z0-9_]*)\s*=\s*(.*)$/.exec(lines[end]);
      if (!match || match[1] !== first[1]) break;
      group.push(match);
    }
    const width = Math.max(...group.map((match) => match[2].length));
    group.forEach((match, index) => { lines[start + index] = `${match[1]}${match[2].padEnd(width)} = ${match[3]}`; });
    start = end - 1;
  }
  return lines.join("\n");
}

function functionSupport({ name, variable }: Resource): string {
  return `resource "azurerm_storage_account" "${variable}_host" {
  name                            = "${name}host\${var.environment_name}"
  resource_group_name             = data.azurerm_resource_group.target.name
  location                        = local.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled       = true
  shared_access_key_enabled       = false
  allow_nested_items_to_be_public = false
  public_network_access          = "Enabled"
}

resource "azurerm_user_assigned_identity" "${variable}_host" {
  name                = "${name}hostid-\${var.environment_name}"
  resource_group_name = data.azurerm_resource_group.target.name
  location            = local.location
}

resource "azurerm_role_assignment" "${variable}_host_blob" {
  scope                = azurerm_storage_account.${variable}_host.id
  role_definition_name = "Storage Blob Data Owner"
  principal_id         = azurerm_user_assigned_identity.${variable}_host.principal_id
  principal_type       = "ServicePrincipal"
}

`;
}

function workspace(name: string, variable: string): string {
  return `resource "azurerm_log_analytics_workspace" "${variable}" {
  name                                    = "${name}-\${var.environment_name}"
  resource_group_name                     = data.azurerm_resource_group.target.name
  location                                = local.location
  sku                                     = "PerGB2018"
  retention_in_days                       = 30
  allow_resource_only_permissions         = true
}`;
}

function terraformResource(resource: Resource, options: Options): string {
  const { kind, name, variable } = resource;
  const common = `  resource_group_name = data.azurerm_resource_group.target.name
  location            = local.location`;
  switch (kind) {
    case "app-service":
      return `resource "azurerm_linux_web_app" "${variable}" {
  name                = "${name}-\${var.environment_name}"
${common}
  service_plan_id     = azurerm_service_plan.main.id
  https_only          = true
  identity { type = "SystemAssigned" }
  site_config {
    always_on           = true
    minimum_tls_version = "1.2"
    ftps_state          = "Disabled"
    application_stack { node_version = "${options.nodeRuntime}-lts" }
  }
}`;
    case "functions":
      return `${functionSupport(resource)}resource "azurerm_linux_function_app" "${variable}" {
  name                        = "${name}-\${var.environment_name}"
${common}
  service_plan_id             = azurerm_service_plan.main.id
  https_only                  = true
  functions_extension_version = "~4"
  builtin_logging_enabled     = false
  storage_account_name        = azurerm_storage_account.${variable}_host.name
  storage_uses_managed_identity = true
  identity {
    type         = "SystemAssigned, UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.${variable}_host.id]
  }
  app_settings = {
    AzureWebJobsStorage__credential      = "managedidentity"
    AzureWebJobsStorage__clientId        = azurerm_user_assigned_identity.${variable}_host.client_id
    AzureWebJobsStorage__blobServiceUri  = azurerm_storage_account.${variable}_host.primary_blob_endpoint
    AzureWebJobsStorage__queueServiceUri = azurerm_storage_account.${variable}_host.primary_queue_endpoint
    AzureWebJobsStorage__tableServiceUri = azurerm_storage_account.${variable}_host.primary_table_endpoint
  }
  site_config {
    always_on           = true
    minimum_tls_version = "1.2"
    ftps_state          = "Disabled"
    application_stack { node_version = "${options.nodeRuntime}" }
  }
  depends_on = [azurerm_role_assignment.${variable}_host_blob]
}`;
    case "sql":
      return `resource "azurerm_mssql_server" "${variable}_server" {
  name                          = "${name}-sql-\${var.environment_name}"
${common}
  version                       = "12.0"
  minimum_tls_version           = "1.2"
  public_network_access_enabled = false
  identity { type = "SystemAssigned" }
  azuread_administrator {
    login_username              = var.sql_admin_login
    object_id                   = var.sql_admin_object_id
    tenant_id                   = data.azurerm_client_config.current.tenant_id
    azuread_authentication_only  = true
  }
}

resource "azurerm_mssql_database" "${variable}" {
  name      = "${name}"
  server_id = azurerm_mssql_server.${variable}_server.id
  sku_name  = "S0"
}`;
    case "storage":
      return `resource "azurerm_storage_account" "${variable}" {
  name                            = "${name}\${var.environment_name}"
${common}
  account_tier                    = "Standard"
  account_replication_type        = "ZRS"
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled       = true
  shared_access_key_enabled       = false
  public_network_access           = "Disabled"
  allow_nested_items_to_be_public = false
}`;
    case "apim":
      return `resource "azurerm_api_management" "${variable}" {
  name                = "${name}-\${var.environment_name}"
${common}
  publisher_name      = "CSA Architecture"
  publisher_email     = var.publisher_email
  sku_name            = "Developer_1"
  identity { type = "SystemAssigned" }
}`;
    case "openai":
      return `resource "azurerm_cognitive_account" "${variable}" {
  name                          = "${name}-\${var.environment_name}"
${common}
  kind                          = "OpenAI"
  sku_name                      = "S0"
  custom_subdomain_name         = "${name}-\${var.environment_name}"
  local_auth_enabled            = false
  public_network_access_enabled = false
  identity { type = "SystemAssigned" }
}`;
    case "key-vault":
      return `resource "azurerm_key_vault" "${variable}" {
  name                          = "${name}-\${var.environment_name}"
${common}
  tenant_id                     = data.azurerm_client_config.current.tenant_id
  sku_name                      = "standard"
  rbac_authorization_enabled    = true
  purge_protection_enabled      = true
  public_network_access_enabled = false
}`;
    case "front-door":
      return `resource "azurerm_cdn_frontdoor_profile" "${variable}" {
  name                = "${name}-\${var.environment_name}"
  resource_group_name = data.azurerm_resource_group.target.name
  sku_name            = "Standard_AzureFrontDoor"
}`;
    case "service-bus":
      return `resource "azurerm_servicebus_namespace" "${variable}" {
  name                          = "${name}-\${var.environment_name}"
${common}
  sku                           = "Standard"
  local_auth_enabled            = false
  public_network_access_enabled = false
  minimum_tls_version           = "1.2"
}`;
    case "cosmos":
      return `resource "azurerm_cosmosdb_account" "${variable}" {
  name                          = "${name}-\${var.environment_name}"
${common}
  offer_type                    = "Standard"
  kind                          = "GlobalDocumentDB"
  local_authentication_enabled  = false
  public_network_access_enabled = false
  consistency_policy { consistency_level = "Session" }
  geo_location {
    location          = local.location
    failover_priority = 0
  }
}`;
    case "aks":
      return `resource "azurerm_kubernetes_cluster" "${variable}" {
  name                = "${name}-\${var.environment_name}"
${common}
  dns_prefix          = "${name}"
  sku_tier            = "Standard"
  default_node_pool {
    name       = "system"
    node_count = 3
    vm_size    = "Standard_D4ds_v5"
  }
  identity { type = "SystemAssigned" }
  role_based_access_control_enabled = true
  node_provisioning_profile {
    mode = "Manual"
  }
}`;
    case "vnet":
      return `resource "azurerm_virtual_network" "${variable}" {
  name                = "${name}-\${var.environment_name}"
${common}
  address_space       = ["10.0.0.0/16"]
}

resource "azurerm_subnet" "${variable}_workload" {
  name                 = "workload"
  resource_group_name  = data.azurerm_resource_group.target.name
  virtual_network_name = azurerm_virtual_network.${variable}.name
  address_prefixes     = ["10.0.1.0/24"]
}`;
    case "log-analytics":
      return workspace(name, variable);
    case "app-insights":
      return `${workspace(`${name}logs`, `${variable}_workspace`)}

resource "azurerm_application_insights" "${variable}" {
  name                          = "${name}-\${var.environment_name}"
${common}
  application_type              = "web"
  local_authentication_enabled  = false
  workspace_id                  = azurerm_log_analytics_workspace.${variable}_workspace.id
}`;
  }
}
