import type { Node } from "@xyflow/react";

export const ARCHITECTURE_TIERS = [
  "Landing Zone", "Subscription", "Resource Group", "Region", "Virtual Network", "VPC", "Subnet",
  "Edge", "Frontend", "Gateway", "Compute", "Messaging", "Data", "Ops", "Custom",
] as const;

export const GROUP_INSET = { x: 24, y: 56 };

type Related = { id: string; parentId?: string };

export function descendantIds<T extends Related>(nodes: readonly T[], roots: Iterable<string>): Set<string> {
  const result = new Set(roots);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.parentId && result.has(node.parentId) && !result.has(node.id)) {
        result.add(node.id);
        changed = true;
      }
    }
  }
  return result;
}

export function parentFirst<T extends Related>(nodes: readonly T[]): T[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  if (byId.size !== nodes.length) throw new Error("Architecture node IDs must be unique.");
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const result: T[] = [];
  function visit(node: T) {
    if (visited.has(node.id)) return;
    if (visiting.has(node.id)) throw new Error("Architecture boundaries cannot contain a cycle.");
    visiting.add(node.id);
    if (node.parentId) {
      const parent = byId.get(node.parentId);
      if (!parent) throw new Error(`Node "${node.id}" references a missing boundary.`);
      visit(parent);
    }
    visiting.delete(node.id);
    visited.add(node.id);
    result.push(node);
  }
  nodes.forEach(visit);
  return result;
}

export function absolutePosition<T extends Related & { position: { x: number; y: number } }>(
  node: T, nodes: readonly T[],
): { x: number; y: number } {
  const byId = new Map(nodes.map((item) => [item.id, item]));
  const position = { ...node.position };
  const visited = new Set([node.id]);
  let parentId = node.parentId;
  while (parentId) {
    if (visited.has(parentId)) throw new Error("Architecture boundaries cannot contain a cycle.");
    visited.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) throw new Error(`Node "${node.id}" references a missing boundary.`);
    position.x += parent.position.x;
    position.y += parent.position.y;
    parentId = parent.parentId;
  }
  return position;
}

export function nodeSize(node: Node): { width: number; height: number } {
  const dimension = (key: "width" | "height", fallback: number) => {
    const value = node[key] ?? node.style?.[key] ?? node.measured?.[key];
    return typeof value === "number" ? value : fallback;
  };
  return {
    width: dimension("width", node.type === "group" ? 440 : node.type === "shape" ? 128 : 132),
    height: dimension("height", node.type === "group" ? 220 : node.type === "shape" ? 104 : 116),
  };
}

export function boundaryAtPoint(nodes: readonly Node[], x: number, y: number, exclude: Iterable<string> = []): Node | undefined {
  const excluded = new Set(exclude);
  return nodes.filter((node) => {
    if (node.type !== "group" || excluded.has(node.id)) return false;
    const p = absolutePosition(node, nodes);
    const size = nodeSize(node);
    return x >= p.x && y >= p.y + 32 && x <= p.x + size.width && y <= p.y + size.height;
  }).sort((left, right) => {
    if (descendantIds(nodes, [left.id]).has(right.id)) return 1;
    if (descendantIds(nodes, [right.id]).has(left.id)) return -1;
    const a = nodeSize(left), b = nodeSize(right);
    return a.width * a.height - b.width * b.height;
  })[0];
}

export function reparentNode(nodes: readonly Node[], id: string, parentId?: string): Node[] {
  const node = nodes.find((item) => item.id === id);
  if (!node) throw new Error("The component to move no longer exists.");
  const parent = parentId ? nodes.find((item) => item.id === parentId) : undefined;
  if (parentId && parent?.type !== "group") throw new Error("Choose an existing architecture boundary.");
  if (parentId && descendantIds(nodes, [id]).has(parentId)) {
    throw new Error("A boundary cannot be moved inside itself or one of its descendants.");
  }
  const position = absolutePosition(node, nodes);
  if (parent) {
    const origin = absolutePosition(parent, nodes);
    const childSize = nodeSize(node), parentSize = nodeSize(parent);
    position.x = Math.max(GROUP_INSET.x, Math.min(position.x - origin.x, parentSize.width - childSize.width - GROUP_INSET.x));
    position.y = Math.max(GROUP_INSET.y, Math.min(position.y - origin.y, parentSize.height - childSize.height - GROUP_INSET.x));
  }
  // No parent extent: a child can be dragged out and explicitly detached on drop.
  const { parentId: _oldParent, extent: _oldExtent, ...unparented } = node;
  void _oldParent; void _oldExtent;
  const next = nodes.map((item) => item.id === id
    ? { ...unparented, position, ...(parentId ? { parentId } : {}) }
    : item);
  return parentFirst(expandAncestors(next, id));
}

export function expandAncestors(nodes: readonly Node[], id: string): Node[] {
  let next = [...nodes];
  let child = next.find((item) => item.id === id)!;
  while (child.parentId) {
    const container = next.find((item) => item.id === child.parentId)!;
    const current = nodeSize(container), size = nodeSize(child);
    const width = Math.max(current.width, child.position.x + size.width + GROUP_INSET.x);
    const height = Math.max(current.height, child.position.y + size.height + GROUP_INSET.x);
    if (width > 100_000 || height > 100_000) throw new Error("This boundary would exceed the supported canvas size.");
    const expanded = { ...container, width, height, style: { ...container.style, width, height } };
    next = next.map((item) => item.id === container.id ? expanded : item);
    child = expanded;
  }
  return next;
}
