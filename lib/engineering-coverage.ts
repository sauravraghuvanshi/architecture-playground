import { azureResourceKind, type AzureResourceKind } from "./service-identity.ts";
import type { ArchitectureCodeInput } from "./architecture-model.ts";
import type { ArmTemplate } from "./deployment-assistance.ts";
import type { EngineeringCheck, EngineeringCoverage } from "./engineering-validation-contract.ts";

export interface ArtifactMapping {
  nodeId: string;
  resourceType: string;
  resourceName: string;
}

const RESOURCE_TYPES: Record<AzureResourceKind, { primary: string; support: readonly string[] }> = {
  "app-service": { primary: "Microsoft.Web/sites", support: ["Microsoft.Web/serverfarms"] },
  functions: { primary: "Microsoft.Web/sites", support: ["Microsoft.Web/serverfarms", "Microsoft.Storage/storageAccounts", "Microsoft.ManagedIdentity/userAssignedIdentities", "Microsoft.Authorization/roleAssignments"] },
  sql: { primary: "Microsoft.Sql/servers/databases", support: ["Microsoft.Sql/servers"] },
  storage: { primary: "Microsoft.Storage/storageAccounts", support: [] },
  apim: { primary: "Microsoft.ApiManagement/service", support: [] },
  openai: { primary: "Microsoft.CognitiveServices/accounts", support: [] },
  "key-vault": { primary: "Microsoft.KeyVault/vaults", support: [] },
  "front-door": { primary: "Microsoft.Cdn/profiles", support: [] },
  "service-bus": { primary: "Microsoft.ServiceBus/namespaces", support: [] },
  cosmos: { primary: "Microsoft.DocumentDB/databaseAccounts", support: [] },
  aks: { primary: "Microsoft.ContainerService/managedClusters", support: [] },
  vnet: { primary: "Microsoft.Network/virtualNetworks", support: [] },
  "log-analytics": { primary: "Microsoft.OperationalInsights/workspaces", support: [] },
  "app-insights": { primary: "Microsoft.Insights/components", support: ["Microsoft.OperationalInsights/workspaces"] },
};

const object = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const typeEquals = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
function reference(value: unknown, type: string): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  if (value.startsWith("[") && value.endsWith("]")) {
    const literalType = /^\[\s*resourceId\(\s*'([^']+)'/i.exec(value)?.[1];
    return !literalType || typeEquals(literalType, type);
  }
  const escaped = type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^/subscriptions/[0-9a-f-]{36}/resourceGroups/[^/]+/providers/${escaped}/[^/?#]+$`, "i").test(value);
}

export function deploymentTargetKind(node: ArchitectureCodeInput["nodes"][number]): AzureResourceKind | undefined {
  if (node.kind === "group" || node.kind === "shape" || !node.iconId) return undefined;
  return azureResourceKind(node.iconId, node.semantics?.provider ?? node.cloud);
}

export function inspectEngineeringCoverage(
  template: ArmTemplate,
  mappings: readonly ArtifactMapping[],
  evidence: ArchitectureCodeInput,
): { mapping: EngineeringCheck; coverageCheck: EngineeringCheck; coverage: EngineeringCoverage[] } {
  const failures: string[] = [];
  const nodes = new Map(evidence.nodes.map((node) => [node.id, node]));
  const resources = new Map(template.resources.map((resource) => [`${resource.type}/${resource.name}`, resource]));
  for (const mapping of mappings) {
    const node = nodes.get(mapping.nodeId);
    const kind = node && deploymentTargetKind(node);
    if (!node || !kind) {
      failures.push(`Mapping "${mapping.nodeId}" does not target a supported canonical Azure service.`);
      continue;
    }
    const policy = RESOURCE_TYPES[kind];
    const resource = resources.get(`${mapping.resourceType}/${mapping.resourceName}`);
    if (!resource || ![policy.primary, ...policy.support].some((type) => typeEquals(type, mapping.resourceType))) {
      failures.push(`Node "${node.id}" (${kind}) cannot represent resource type "${mapping.resourceType}".`);
      continue;
    }
    if (typeEquals(resource.type, "Microsoft.Web/sites")) {
      const declaredKind = typeof resource.kind === "string" ? resource.kind.toLowerCase().split(",") : [];
      if (declaredKind.includes("workflowapp") || (kind === "functions" && !declaredKind.includes("functionapp")) ||
          (kind === "app-service" && declaredKind.includes("functionapp"))) {
        failures.push(`Node "${node.id}" and its Web/sites workload kind do not match.`);
      }
    }
    if (kind === "openai" && resource.kind !== "OpenAI") {
      failures.push(`Node "${node.id}" requires an OpenAI account, not another Cognitive Services product.`);
    }
  }
  const coverage: EngineeringCoverage[] = evidence.nodes.map((node) => {
    const kind = deploymentTargetKind(node);
    const selected = mappings.filter((mapping) => mapping.nodeId === node.id);
    const resourceTypes = selected.map((mapping) => mapping.resourceType);
    const base = { nodeId: node.id, label: node.label, ...(node.iconId ? { serviceId: node.iconId } : {}), resourceTypes };
    if (node.kind === "group" || node.kind === "shape" || !node.iconId) {
      return { ...base, status: "excluded", reason: "Boundary or generic annotation; not treated as a provisionable service." };
    }
    if (!kind) return { ...base, status: "unsupported", reason: "This provider/product has no audited mapping in the current Azure validation profile." };
    if (!selected.length) return { ...base, status: "excluded", reason: "Supported service omitted from this artifact set." };
    if (!selected.some((mapping) => typeEquals(mapping.resourceType, RESOURCE_TYPES[kind].primary))) {
      failures.push(`Node "${node.id}" has supporting resources but no primary "${RESOURCE_TYPES[kind].primary}" resource.`);
      return { ...base, status: "partial", reason: "Only supporting resources were mapped; the requested service is missing." };
    }
    return { ...base, status: "mapped", reason: "Primary resource declaration is mapped; this is not deployed-workload verification." };
  });
  const gaps = coverage.filter((row) => row.status === "unsupported" || (row.status === "excluded" && row.serviceId));
  const configured = evidence.nodes.filter((node) => node.semantics &&
    (node.semantics.region || node.semantics.sku || node.semantics.environmentId || Object.keys(node.semantics.properties ?? {}).length));
  const constraints = configured.length > 0 || Boolean(evidence.metadata?.requirements?.length);
  return {
    mapping: {
      id: "resource-mappings", status: failures.length ? "failed" : "passed",
      summary: failures.length ? "Some resources do not match their diagram service identity." : "Declared resources match supported canonical service types.",
      details: failures.slice(0, 100),
    },
    coverageCheck: {
      id: "coverage", status: gaps.length || constraints ? "not-verified" : "passed",
      summary: gaps.length ? `${gaps.length} service nodes are omitted or unsupported.` :
        constraints ? "Resource identities are mapped, but declared configuration/requirements still need review." : "All supported service nodes have declared artifact coverage.",
      details: [
        ...gaps.map((row) => `${row.nodeId}: ${row.reason}`),
        ...(constraints ? ["This profile does not prove fulfillment of declared region/SKU/environment/properties or business requirements. Review them against the generated defaults before handoff."] : []),
      ].slice(0, 100),
    },
    coverage,
  };
}

export function inspectEngineeringPrerequisites(template: ArmTemplate): EngineeringCheck {
  const failures: string[] = [];
  const uncertain: string[] = [];
  for (const resource of template.resources) {
    const properties = object(resource.properties) ?? {};
    if (typeEquals(resource.type, "Microsoft.Web/sites") || typeEquals(resource.type, "Microsoft.Web/serverfarms")) {
      for (const key of ["identity", "kind", "sku"]) {
        if (key in properties) failures.push(`${resource.name}: Web resource "${key}" must be at the resource root, not inside properties.`);
      }
    }
    if (typeEquals(resource.type, "Microsoft.Web/sites")) {
      if (!reference(properties.serverFarmId, "Microsoft.Web/serverfarms")) {
        failures.push(`${resource.name}: an explicit App Service plan reference is required; automatic plan creation is not supported.`);
      }
      const kind = typeof resource.kind === "string" ? resource.kind.toLowerCase() : "";
      if (kind.includes("functionapp")) {
        const siteConfig = object(properties.siteConfig);
        const settings = Array.isArray(siteConfig?.appSettings)
          ? siteConfig.appSettings.map(object).filter((setting) => setting !== undefined) : [];
        const values = new Map(settings.map((setting) => [setting.name, setting.value]));
        const identity = object(resource.identity);
        if (typeof identity?.type !== "string" || !identity.type.split(",").map((part) => part.trim()).some((part) => ["SystemAssigned", "UserAssigned"].includes(part))) {
          failures.push(`${resource.name}: Function host managed identity is missing.`);
        }
        const supplied = (name: string) => typeof values.get(name) === "string" && Boolean(String(values.get(name)).trim());
        const host = supplied("AzureWebJobsStorage__accountName") ||
          ["blob", "queue", "table"].every((service) => supplied(`AzureWebJobsStorage__${service}ServiceUri`));
        if (!host || values.get("AzureWebJobsStorage__credential") !== "managedidentity") {
          failures.push(`${resource.name}: explicit identity-based Function host storage configuration is missing.`);
        }
        if (values.has("AzureWebJobsStorage")) {
          failures.push(`${resource.name}: connection-string host storage is outside the keyless validation profile.`);
        }
        uncertain.push(`${resource.name}: host-storage existence, scoped permissions, role propagation and trigger-specific access require environment validation.`);
      }
    }
    if (typeEquals(resource.type, "Microsoft.Sql/servers")) {
      const administrators = object(properties.administrators);
      if (administrators?.azureADOnlyAuthentication !== true || "administratorLogin" in properties || "administratorLoginPassword" in properties) {
        failures.push(`${resource.name}: SQL must declare Microsoft Entra-only administration without SQL-login credentials.`);
      }
      if (typeof administrators?.sid !== "string" || !administrators.sid.trim() ||
          typeof administrators.login !== "string" || !administrators.login.trim()) {
        failures.push(`${resource.name}: SQL Entra administrator identity and display name must be explicitly supplied.`);
      }
    }
    if (typeEquals(resource.type, "Microsoft.Insights/components") &&
        !reference(properties.WorkspaceResourceId, "Microsoft.OperationalInsights/workspaces")) {
      failures.push(`${resource.name}: Application Insights requires an explicit workspace reference.`);
    }
    if (typeEquals(resource.type, "Microsoft.Authorization/roleAssignments")) {
      uncertain.push(`${resource.name}: role principal, role definition and scope must be independently reviewed before any deployment.`);
    }
    if ("copy" in resource || "condition" in resource || "scope" in resource) {
      uncertain.push(`${resource.name}: instance expansion, conditions or explicit scope require additional review.`);
    }
  }
  return {
    id: "prerequisites", status: failures.length ? "failed" : uncertain.length ? "not-verified" : "passed",
    summary: failures.length ? "Required explicit resource prerequisites are missing or outside policy." :
      uncertain.length ? "Basic prerequisite fields are present; unresolved prerequisites still need review." : "Supported prerequisite fields are present.",
    details: [...failures, ...uncertain].slice(0, 100),
  };
}
