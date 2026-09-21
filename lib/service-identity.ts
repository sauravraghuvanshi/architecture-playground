import manifest from "../content/cloud-icons.json" with { type: "json" };

export interface ServiceIcon {
  id: string;
  label: string;
  path: string;
  cloud?: string;
}

export const SERVICE_CATALOG: readonly ServiceIcon[] = manifest.icons;
export type ServiceProvider = "azure" | "aws" | "gcp";

const SERVICE_ALIASES: Record<string, Record<string, string>> = {
  azure: {
    "app service": "azure/application/application-service",
    "app services": "azure/application/application-service",
    "application service": "azure/application/application-service",
    "appservice": "azure/application/application-service",
    "sql database": "azure/data/sql-database",
    "sql databases": "azure/data/sql-database",
    "functions": "azure/application/function-app",
    "function app": "azure/application/function-app",
    "aks": "azure/compute/container-kubernetes-service",
    "kubernetes": "azure/compute/container-kubernetes-service",
    "api management": "azure/management/api-management-service",
    "apim": "azure/management/api-management-service",
    "front door": "azure/networking/azure-front-door",
    "openai": "azure/ai/azure-openai",
    "cosmos db": "azure/data/azure-cosmos-db",
    "cosmos": "azure/data/azure-cosmos-db",
    "blob storage": "azure/storage/storage-account-blob",
    "container apps": "azure/application/container-app",
    "static web apps": "azure/application/static-web-app",
    "entra id": "azure/identity/azure-active-directory",
    "active directory": "azure/identity/azure-active-directory",
    "monitor": "azure/management/azure-monitor",
    "app insights": "azure/management/application-insights",
    "log analytics": "azure/management/log-analytics-workspace",
    "event hubs": "azure/application/event-hub",
    "event grid": "azure/application/event-grid-topic",
    "redis": "azure/networking/azure-cache-for-redis",
    "postgresql": "azure/data/azure-database-for-postgresql",
    "postgres": "azure/data/azure-database-for-postgresql",
    "mysql": "azure/data/azure-database-for-mysql",
    "ai search": "azure/ai/cognitive-services-search",
    "cognitive search": "azure/ai/cognitive-services-search",
    "synapse": "azure/data/azure-synapse-analytics",
    "databricks": "azure/data/azure-databricks",
    "managed hsm": "azure/security/azure-key-vault-managed-hsm",
  },
  aws: {
    "s3": "aws/storage/simple-storage-service",
    "iam": "aws/security/identity-and-access-management",
    "eks": "aws/containers/elastic-kubernetes-service",
    "ecs": "aws/containers/elastic-container-service",
    "fargate": "aws/compute/fargate",
  },
  gcp: {
    "gke": "gcp/containers/g-k-e",
    "bigquery": "gcp/analytics/big-query",
    "big query": "gcp/analytics/big-query",
    "cloud sql": "gcp/database/cloud-s-q-l",
    "gcs": "gcp/storage/cloud-storage",
  },
};

// Finite, audited legacy IDs. Null is an explicit catalog gap, never a fallback.
const LEGACY_ICON_IDS: Record<string, string | null> = {
  "aws/identity/iam": "aws/security/identity-and-access-management",
  "aws/networking/api-gateway": null,
  "aws/storage/s3": "aws/storage/simple-storage-service",
  "azure/ai/03438-icon-service-azure-openai": "azure/ai/azure-openai",
  "azure/ai/10044-icon-service-cognitive-search": "azure/ai/cognitive-services-search",
  "azure/analytics/00039-icon-service-event-hubs": "azure/application/event-hub",
  "azure/analytics/00606-icon-service-azure-synapse-analytics": "azure/data/azure-synapse-analytics",
  "azure/analytics/10143-icon-service-data-lake-analytics": "azure/data/data-lake-analytics",
  "azure/analytics/10145-icon-service-azure-data-explorer-clusters": "azure/data/azure-data-explorer-cluster",
  "azure/application/10035-icon-service-app-services": "azure/application/application-service",
  "azure/application/10073-icon-service-front-door-and-cdn-profiles": "azure/networking/azure-front-door",
  "azure/compute/10023-icon-service-kubernetes-services": "azure/compute/container-kubernetes-service",
  "azure/compute/10029-icon-service-function-apps": "azure/application/function-app",
  "azure/compute/app-service": "azure/application/application-service",
  "azure/compute/functions": "azure/application/function-app",
  "azure/containers/10105-icon-service-container-registries": "azure/compute/container-registry",
  "azure/database/02827-icon-service-azure-database-postgresql-server-group": "azure/data/azure-database-for-postgresql-group",
  "azure/database/10121-icon-service-azure-cosmos-db": "azure/data/azure-cosmos-db",
  "azure/database/10130-icon-service-sql-database": "azure/data/sql-database",
  "azure/database/10137-icon-service-cache-redis": "azure/networking/azure-cache-for-redis",
  "azure/database/sql-db": "azure/data/sql-database",
  "azure/devops/00012-icon-service-application-insights": "azure/management/application-insights",
  "azure/general/02989-icon-service-container-apps-environments": "azure/application/container-app-environment",
  "azure/identity/entra-id": "azure/identity/azure-active-directory",
  "azure/integration/03637-icon-service-business-process-tracking": null,
  "azure/integration/10042-icon-service-api-management-services": "azure/management/api-management-service",
  "azure/integration/10206-icon-service-event-grid-topics": "azure/application/event-grid-topic",
  "azure/integration/service-bus": "azure/data/service-bus",
  "azure/monitor/app-insights": "azure/management/application-insights",
  "azure/networking/02422-icon-service-bastions": "azure/networking/bastion",
  "azure/networking/10061-icon-service-virtual-networks": "azure/networking/virtual-network",
  "azure/networking/10064-icon-service-dns-zones": "azure/networking/dns-zone-public",
  "azure/networking/10065-icon-service-traffic-manager-profiles": "azure/networking/traffic-manager-profile",
  "azure/networking/10084-icon-service-firewalls": "azure/security/azure-firewall",
  "azure/networking/front-door": "azure/networking/azure-front-door",
  "azure/security/10245-icon-service-key-vaults": "azure/security/key-vault",
  "azure/storage/10086-icon-service-storage-accounts": "azure/storage/storage-account",
  "azure/storage/blob-storage": "azure/storage/storage-account-blob",
  "gcp/compute/gke": "gcp/containers/g-k-e",
  "gcp/database/bigquery": "gcp/analytics/big-query",
  "gcp/database/cloud-sql": "gcp/database/cloud-s-q-l",
  "gcp/integration/pub-sub": null,
  "gcp/networking/cloud-load-balancing": null,
};

const GENERIC_NAMES = new Set([
  "database", "data store", "storage", "object storage", "compute", "server", "virtual machine",
  "container", "containers", "function", "functions", "cloud", "network", "networking",
  "application", "app", "service", "web app", "api", "api gateway", "gateway", "load balancer",
  "queue", "cache", "identity", "security", "monitoring", "analytics", "sql database", "sql databases",
]);

function normalizedName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function serviceLabelProvider(value: string): { cloud?: string; name: string } {
  const normalized = normalizedName(value);
  const prefixes: Array<[ServiceProvider, RegExp]> = [
    ["azure", /^(?:microsoft azure|azure)\b\s*/],
    ["aws", /^(?:amazon web services|aws|amazon)\b\s*/],
    ["gcp", /^(?:google cloud platform|google cloud|gcp|google)\b\s*/],
  ];
  for (const [cloud, pattern] of prefixes) {
    if (pattern.test(normalized)) return { cloud, name: normalized.replace(pattern, "") };
  }
  return { name: normalized };
}

export function iconProvider(icon: ServiceIcon): string {
  const prefix = icon.id.split("/")[0];
  return ["azure", "aws", "gcp"].includes(prefix) && (!icon.cloud || icon.cloud === prefix) ? prefix : "unknown";
}

/** Known IDs win over editable labels; unknowns never use partial-token scoring. */
export function resolveServiceIcon<T extends ServiceIcon>(
  identity: { iconId?: string; label?: string; cloud?: string },
  icons: readonly T[],
): T | undefined {
  const exact = icons.find((icon) => icon.id === identity.iconId);
  if (exact) return iconProvider(exact) !== "unknown" && (!identity.cloud || iconProvider(exact) === identity.cloud) ? exact : undefined;
  if (identity.iconId && Object.hasOwn(LEGACY_ICON_IDS, identity.iconId)) {
    const canonical = icons.find((icon) => icon.id === LEGACY_ICON_IDS[identity.iconId!]);
    return canonical && iconProvider(canonical) !== "unknown" && (!identity.cloud || iconProvider(canonical) === identity.cloud) ? canonical : undefined;
  }
  const labeled = serviceLabelProvider(identity.label ?? "");
  const idProvider = identity.iconId?.split("/")[0];
  if (identity.iconId?.includes("/") && idProvider && !["azure", "aws", "gcp"].includes(idProvider)) return undefined;
  const clouds = new Set([
    identity.cloud,
    idProvider && ["azure", "aws", "gcp"].includes(idProvider) ? idProvider : undefined,
    labeled.cloud,
  ].filter((cloud): cloud is string => !!cloud));
  if (clouds.size > 1) return undefined;
  const cloud = [...clouds][0];
  const candidates = icons.filter((icon) => iconProvider(icon) !== "unknown" && (!cloud || iconProvider(icon) === cloud));
  const leaf = identity.iconId?.split("/").at(-1)?.replace(/^\d+-icon-service-/, "") ?? "";
  const terms = new Set([normalizedName(leaf), labeled.name].filter((term) => term && (cloud || !GENERIC_NAMES.has(term))));
  const matches = candidates.filter((icon) => {
    const aliases = SERVICE_ALIASES[iconProvider(icon)] ?? {};
    return [...terms].some((term) => aliases[term] === icon.id ||
      (!aliases[term] && (serviceLabelProvider(icon.label).name === term || normalizedName(icon.id.split("/").at(-1) ?? "") === term)));
  });
  return matches.length === 1 ? matches[0] : undefined;
}

/** Human search can browse partial text, but exact product aliases are ranked first. */
export function searchServiceIcons<T extends ServiceIcon & { category?: string; categoryLabel?: string; cloudLabel?: string; slug?: string }>(
  icons: readonly T[], query: string, cloud?: string,
): T[] {
  const needle = query.trim().toLowerCase();
  const canonical = needle ? resolveServiceIcon({ label: query, cloud }, icons)?.id : undefined;
  return icons.filter((icon) => (!cloud || iconProvider(icon) === cloud) &&
    (!needle || icon.id === canonical || [icon.id, icon.label, icon.category, icon.categoryLabel, icon.cloudLabel, icon.slug]
      .filter(Boolean).join(" ").toLowerCase().includes(needle)))
    .sort((left, right) => Number(right.id === canonical) - Number(left.id === canonical));
}

export type AzureResourceKind = "app-service" | "sql" | "storage" | "apim" | "openai" | "key-vault" |
  "front-door" | "service-bus" | "cosmos" | "functions" | "aks" | "vnet" | "log-analytics" | "app-insights";

const AZURE_RESOURCE_KINDS: Readonly<Record<string, AzureResourceKind>> = {
  "azure/application/application-service": "app-service",
  "azure/data/sql-database": "sql",
  "azure/storage/storage-account": "storage",
  "azure/storage/storage-account-blob": "storage",
  "azure/management/api-management-service": "apim",
  "azure/application/app-service-api-management": "apim",
  "azure/ai/azure-openai": "openai",
  "azure/security/key-vault": "key-vault",
  "azure/networking/azure-front-door": "front-door",
  "azure/data/service-bus": "service-bus",
  "azure/data/azure-cosmos-db": "cosmos",
  "azure/application/function-app": "functions",
  "azure/compute/container-kubernetes-service": "aks",
  "azure/networking/virtual-network": "vnet",
  "azure/management/log-analytics-workspace": "log-analytics",
  "azure/management/application-insights": "app-insights",
};

export function azureResourceKind(iconId: string, cloud?: string): AzureResourceKind | undefined {
  const icon = resolveServiceIcon({ iconId, cloud }, SERVICE_CATALOG);
  return icon && iconProvider(icon) === "azure" ? AZURE_RESOURCE_KINDS[icon.id] : undefined;
}
