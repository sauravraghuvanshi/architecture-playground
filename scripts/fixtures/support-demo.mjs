export const supportDemo = {
  nodes: [
    { kind: "shape", id: "n1", shape: "person", label: "Employees", x: 0, y: 0 },
    { kind: "icon", id: "n2", iconId: "azure/application/container-app", iconPath: "", label: "Support orchestrator", x: 250, y: 0 },
    { kind: "icon", id: "n3", iconId: "azure/ai/azure-openai", iconPath: "", label: "Knowledge agent", x: 500, y: 0 },
    { kind: "icon", id: "n4", iconId: "azure/ai/search-service", iconPath: "", label: "Approved knowledge", x: 750, y: 0 },
    { kind: "icon", id: "n5", iconId: "azure/ai/azure-openai", iconPath: "", label: "Resolution agent", x: 750, y: 250 },
    { kind: "shape", id: "n6", shape: "diamond", label: "Human approval", x: 500, y: 250 },
    { kind: "icon", id: "n7", iconId: "azure/application/function-app", iconPath: "", label: "Action worker", x: 250, y: 250 },
    { kind: "shape", id: "n8", shape: "database", label: "Ticket system", x: 0, y: 250 },
  ],
  edges: [
    ["n1", "n2", "Classify request"], ["n2", "n3", "Retrieve answer"],
    ["n3", "n4", "Grounded retrieval"], ["n2", "n5", "Plan resolution"],
    ["n5", "n6", "Review proposed action"], ["n6", "n7", "Approved actions"],
    ["n7", "n8", "Update / audit"],
  ].map(([source, target, label], index) => ({ id: `e${index + 1}`, source, target, label, step: index + 1, style: "flow" })),
};
