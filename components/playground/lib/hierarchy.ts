import type { PlaygroundNode } from "./types";

export function hierarchyErrors(nodes: readonly Pick<PlaygroundNode, "id" | "type" | "parentId">[]): string[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const errors: string[] = [];
  if (byId.size !== nodes.length) errors.push("Hierarchy requires unique node IDs.");
  for (const node of nodes) {
    if (!node.parentId) continue;
    const parent = byId.get(node.parentId);
    if (!parent || parent.type !== "group") {
      errors.push(`Node "${node.id}" must reference an existing parent group.`);
      continue;
    }
    const ancestors = new Set([node.id]);
    let parentId: string | undefined = node.parentId;
    while (parentId) {
      if (ancestors.has(parentId)) {
        errors.push(`Node "${node.id}" has a cyclic parent hierarchy.`);
        break;
      }
      ancestors.add(parentId);
      parentId = byId.get(parentId)?.parentId;
    }
  }
  return errors;
}

/** Call after validating containment; keep siblings in their existing order. */
export function parentFirst<T extends Pick<PlaygroundNode, "id" | "parentId">>(nodes: readonly T[]): T[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  const ordered: T[] = [];
  function add(node: T) {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) add(parent);
    ordered.push(node);
  }
  nodes.forEach(add);
  return ordered;
}
