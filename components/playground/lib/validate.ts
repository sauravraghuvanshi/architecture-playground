/**
 * Strict Zod schema + sanitized rebuild for imported playground graphs.
 *
 * Hard caps protect against:
 *   - OOM via huge graphs
 *   - non-finite coordinates
 *   - unknown node/edge types
 *   - unknown icon slugs (must exist in the live manifest)
 *   - extreme label lengths (XSS-via-bloat is mitigated; React text rendering
 *     handles escaping)
 *
 * The validator returns a freshly-constructed graph — never spread raw input
 * into application state.
 */
import { z } from "zod";
import type { IconManifestEntry, PlaygroundGraph } from "./types";
import { normalizeGraph } from "./migrations";

const MAX_NODES = 200;
const MAX_EDGES = 500;
const MAX_LABEL = 200;
const COORD_LIMIT = 50_000;

const finite = z
  .number()
  .refine((n) => Number.isFinite(n), "must be finite")
  .refine((n) => n >= -COORD_LIMIT && n <= COORD_LIMIT, "out of range");

const positionSchema = z.object({ x: finite, y: finite });

const labelSchema = z.string().max(MAX_LABEL);

const hexColor = z.string().regex(/^#[0-9a-f]{3,8}$/i).optional();

const serviceDataSchema = z.object({
  iconId: z.string().max(200),
  label: labelSchema,
  cloud: z.enum(["azure", "aws", "gcp"]),
  description: z.string().max(500).optional(),
  layerId: z.string().max(64).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

const groupDataSchema = z.object({
  label: labelSchema,
  variant: z.enum(["vpc", "resource-group", "project", "subnet", "region", "custom"]),
  color: hexColor,
  description: z.string().max(500).optional(),
  layerId: z.string().max(64).optional(),
});

const stickyDataSchema = z.object({
  label: labelSchema,
  color: hexColor,
  layerId: z.string().max(64).optional(),
});

const nodeSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1).max(64),
    type: z.literal("service"),
    position: positionSchema,
    data: serviceDataSchema,
    parentId: z.string().min(1).max(64).optional(),
    width: finite.optional(),
    height: finite.optional(),
    zIndex: z.number().optional(),
  }),
  z.object({
    id: z.string().min(1).max(64),
    type: z.literal("group"),
    position: positionSchema,
    data: groupDataSchema,
    parentId: z.string().min(1).max(64).optional(),
    width: finite.optional(),
    height: finite.optional(),
    zIndex: z.number().optional(),
  }),
  z.object({
    id: z.string().min(1).max(64),
    type: z.literal("sticky"),
    position: positionSchema,
    data: stickyDataSchema,
    parentId: z.string().min(1).max(64).optional(),
    width: finite.optional(),
    height: finite.optional(),
    zIndex: z.number().optional(),
  }),
]);

const edgeSchema = z.object({
  id: z.string().min(1).max(64),
  source: z.string().min(1).max(64),
  target: z.string().min(1).max(64),
  sourceHandle: z.string().max(32).nullish(),
  targetHandle: z.string().max(32).nullish(),
  data: z
    .object({
      label: labelSchema.optional(),
      animated: z.boolean().optional(),
      step: z.number().int().min(1).max(100).optional(),
      color: hexColor,
      connectionType: z.enum(["data-flow", "network", "dependency", "sequence", "custom"]).optional(),
      protocol: z.string().max(50).optional(),
      lineStyle: z.enum(["solid", "dashed", "dotted"]).optional(),
      arrowStyle: z.enum(["none", "forward", "backward", "bidirectional"]).optional(),
      description: z.string().max(500).optional(),
    })
    .optional(),
});

const layerSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(100),
  visible: z.boolean(),
  locked: z.boolean(),
  color: hexColor.unwrap(), // required hex string
  order: z.number().int(),
});

const metadataSchema = z.object({
  name: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  author: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const graphSchema = z.object({
  nodes: z.array(nodeSchema).max(MAX_NODES),
  edges: z.array(edgeSchema).max(MAX_EDGES),
  viewport: z
    .object({ x: finite, y: finite, zoom: z.number().positive().max(10) })
    .optional(),
  layers: z.array(layerSchema).max(50).optional(),
  metadata: metadataSchema.optional(),
});

export interface ValidationResult {
  ok: boolean;
  graph?: PlaygroundGraph;
  errors?: string[];
}

/**
 * Validates a parsed JSON payload + rebuilds a clean, sanitized graph.
 * Drops edges referencing missing nodes and (optionally) drops service nodes
 * whose iconId is not in the live manifest.
 */
export function validateImportedGraph(
  raw: unknown,
  manifest: IconManifestEntry[],
  options: { strictIcons?: boolean } = { strictIcons: true }
): ValidationResult {
  const parsed = graphSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }

  const knownIcons = new Set(manifest.map((i) => i.id));
  const seenNodeIds = new Set<string>();
  const cleanNodes: PlaygroundGraph["nodes"] = [];
  const errors: string[] = [];

  for (const n of parsed.data.nodes) {
    if (seenNodeIds.has(n.id)) {
      errors.push(`duplicate node id: ${n.id}`);
      continue;
    }
    if (n.type === "service") {
      const iconId = (n.data as { iconId: string }).iconId;
      if (options.strictIcons && !knownIcons.has(iconId)) {
        errors.push(`unknown icon: ${iconId}`);
        continue;
      }
    }
    seenNodeIds.add(n.id);
    // Rebuild — never spread raw.
    cleanNodes.push({
      id: n.id,
      type: n.type,
      position: { x: n.position.x, y: n.position.y },
      data: { ...n.data } as PlaygroundGraph["nodes"][number]["data"],
      parentId: n.parentId,
      width: n.width,
      height: n.height,
      zIndex: n.zIndex,
    });
  }

  const cleanEdges: PlaygroundGraph["edges"] = [];
  const seenEdgeIds = new Set<string>();
  for (const e of parsed.data.edges) {
    if (seenEdgeIds.has(e.id)) continue;
    if (!seenNodeIds.has(e.source) || !seenNodeIds.has(e.target)) {
      errors.push(`edge ${e.id} references missing node`);
      continue;
    }
    seenEdgeIds.add(e.id);
    cleanEdges.push({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
      data: e.data ? { ...e.data } : undefined,
    });
  }

  return {
    ok: true,
    graph: normalizeGraph({
      nodes: cleanNodes,
      edges: cleanEdges,
      viewport: parsed.data.viewport,
      layers: parsed.data.layers,
      metadata: parsed.data.metadata,
    }),
    errors: errors.length ? errors : undefined,
  };
}

export const LIMITS = { MAX_NODES, MAX_EDGES, MAX_LABEL, COORD_LIMIT };
