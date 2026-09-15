import { z } from "zod";
import type { ArchPayload } from "../components/diagrammatic/modes/architecture/ArchitectureCanvas";

const id = z.string().min(1).max(200);
const position = {
  id,
  label: z.string().max(1000),
  x: z.number().finite().min(-1_000_000).max(1_000_000),
  y: z.number().finite().min(-1_000_000).max(1_000_000),
  width: z.number().positive().max(100_000).optional(),
  height: z.number().positive().max(100_000).optional(),
};
const child = { parentId: id.optional(), subtitle: z.string().max(2000).optional() };
const schema = z.object({
  nodes: z.array(z.union([
    z.object({ ...position, ...child, kind: z.literal("icon").optional(), iconId: z.string().max(1000), iconPath: z.string().max(2000) }),
    z.object({ ...position, ...child, kind: z.literal("shape"), shape: z.enum(["rectangle", "circle", "diamond", "database", "person", "document", "internet"]) }),
    z.object({ ...position, kind: z.literal("group"), width: z.number().positive().max(100_000), height: z.number().positive().max(100_000), tier: z.string().max(200).optional() }),
  ])).max(500),
  edges: z.array(z.object({
    id, source: id, target: id, label: z.string().max(1000).optional(),
    style: z.enum(["solid", "dashed", "flow"]).optional(),
    step: z.number().int().positive().max(100_000).optional(),
  })).max(1000),
});

export function parseArchitectureDocument(value: unknown): ArchPayload {
  const payload = schema.parse(value);
  const nodeIds = new Set(payload.nodes.map((node) => node.id));
  if (nodeIds.size !== payload.nodes.length || new Set(payload.edges.map((edge) => edge.id)).size !== payload.edges.length) {
    throw new Error("Diagram IDs must be unique.");
  }
  const groups = new Set(payload.nodes.filter((node) => node.kind === "group").map((node) => node.id));
  for (const node of payload.nodes) {
    if ("parentId" in node && node.parentId && !groups.has(node.parentId)) {
      throw new Error(`Node "${node.id}" references a missing group.`);
    }
    if ("iconPath" in node && node.iconPath && (!node.iconPath.startsWith("/cloud-icons/") || node.iconPath.includes(".."))) {
      throw new Error("Imported icons must use the bundled cloud catalog.");
    }
  }
  if (payload.edges.some((edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target))) {
    throw new Error("Every connection must reference existing nodes.");
  }
  return payload;
}
