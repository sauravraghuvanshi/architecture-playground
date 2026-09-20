import { ARCHITECTURE_MODEL_VERSION, architectureModelSchema, serviceNodeSemantics, validateArchitectureReferences, type VersionedArchitecture } from "./architecture-model.ts";
import { parentFirst } from "./architecture-hierarchy.ts";
import { resolveServiceIcon, SERVICE_CATALOG } from "./service-identity.ts";
export { MAX_PLAYBACK_STEP, hasArchitectureContent } from "./architecture-model.ts";

export function parseArchitectureDocument(value: unknown): VersionedArchitecture {
  const payload = architectureModelSchema.parse(value);
  const nodeIds = new Set(payload.nodes.map((node) => node.id));
  if (nodeIds.size !== payload.nodes.length || new Set(payload.edges.map((edge) => edge.id)).size !== payload.edges.length) {
    throw new Error("Diagram IDs must be unique.");
  }
  const groups = new Set(payload.nodes.filter((node) => node.kind === "group").map((node) => node.id));
  for (const node of payload.nodes) {
    if ("iconId" in node) {
      const semantics = serviceNodeSemantics(node.iconId, node.semantics);
      if (semantics) node.semantics = semantics;
    }
    if ("parentId" in node && node.parentId && !groups.has(node.parentId)) {
      throw new Error(`Node "${node.id}" references a missing group.`);
    }
    if ("iconPath" in node && node.iconPath && (!node.iconPath.startsWith("/cloud-icons/") || node.iconPath.includes(".."))) {
      throw new Error("Imported icons must use the bundled cloud catalog.");
    }
    if ("iconId" in node) {
      const canonical = resolveServiceIcon({ iconId: node.iconId, cloud: node.semantics?.provider }, SERVICE_CATALOG);
      if (canonical) {
        node.iconId = canonical.id;
        node.iconPath = canonical.path;
      }
    }
  }
  if (payload.edges.some((edge) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target))) {
    throw new Error("Every connection must reference existing nodes.");
  }
  parentFirst(payload.nodes);
  validateArchitectureReferences(payload);
  return { ...payload, schemaVersion: ARCHITECTURE_MODEL_VERSION };
}
