export const supportedIcons = [
  ["app-service", "azure/application/application-service"],
  ["sql", "azure/data/sql-database"],
  ["storage", "azure/storage/storage-account"],
  ["apim", "azure/management/api-management-service"],
  ["openai", "azure/ai/azure-openai"],
  ["key-vault", "azure/security/key-vault"],
  ["front-door", "azure/networking/azure-front-door"],
  ["service-bus", "azure/data/service-bus"],
  ["cosmos", "azure/data/azure-cosmos-db"],
  ["functions", "azure/application/function-app"],
  ["aks", "azure/compute/container-kubernetes-service"],
  ["vnet", "azure/networking/virtual-network"],
  ["log-analytics", "azure/management/log-analytics-workspace"],
  ["app-insights", "azure/management/application-insights"],
];

export const service = (id, iconId, label = id) => ({ id, kind: "icon", iconId, label, cloud: "azure" });
export const graph = (nodes) => ({ nodes, edges: [] });
export const allKinds = graph(supportedIcons.map(([kind, iconId]) => service(kind, iconId)));
export const repeatedKinds = graph(supportedIcons.flatMap(([kind, iconId]) => [
  service(`${kind}-1`, iconId, "123 duplicated customer label"),
  service(`${kind}-2`, iconId, "123 duplicated customer label"),
]));
export const edgeNames = graph([
  ...["", "123", "\u6771\u4eac", "a".repeat(400), "a'${injection}", "A", "a"].map(
    (label, index) => service(`edge-${index}`, "azure/storage/storage-account", label),
  ),
  // These IDs collide in FNV-1a; the allocator must resolve the collision.
  ...["costarring", "liquid"].map((id) => service(id, "azure/storage/storage-account", "same")),
]);
export const compilerFixtures = [
  ["all-kinds", allKinds],
  ...supportedIcons.map(([kind, iconId]) => [kind, graph([service(kind, iconId)])]),
  ["repeated-kinds", repeatedKinds],
  ["edge-names", edgeNames],
];
