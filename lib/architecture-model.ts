import { z } from "zod";

export const ARCHITECTURE_MODEL_VERSION = 1;
export const MAX_PLAYBACK_STEP = 100_000;
export const architectureProviderSchema = z.enum(["azure", "aws", "gcp"]);
export type ArchitectureProvider = z.infer<typeof architectureProviderSchema>;

const id = z.string().min(1).max(200).refine((value) => Boolean(value.trim()), "IDs must not be blank.");
const references = z.array(id).max(100).refine((items) => new Set(items).size === items.length, "References must be unique.");
export const servicePropertiesSchema = z.record(
  z.string().min(1).max(64).refine((key) => !["__proto__", "constructor", "prototype"].includes(key), "Unsupported property name."),
  z.union([z.string().max(200), z.number().finite(), z.boolean()]),
).refine((properties) => Object.keys(properties).length <= 32, "At most 32 properties are supported.");
const traceability = {
  requirementIds: references.optional(),
  evidenceIds: references.optional(),
};

export const architectureNodeSemanticsSchema = z.object({
  provider: architectureProviderSchema.optional(),
  region: z.string().trim().max(100).optional(),
  sku: z.string().trim().max(100).optional(),
  environmentId: id.optional(),
  properties: servicePropertiesSchema.optional(),
  ...traceability,
}).strict().superRefine((semantics, context) => {
  for (const field of ["provider", "region", "sku", "environmentId", "requirementIds", "evidenceIds"]) {
    if (semantics.properties && field in semantics.properties) context.addIssue({
      code: "custom", path: ["properties", field], message: `Use semantics.${field}, not a duplicate free-form property.`,
    });
  }
});
export type ArchitectureNodeSemantics = z.infer<typeof architectureNodeSemanticsSchema>;

export function serviceNodeSemantics(iconId: string, semantics?: ArchitectureNodeSemantics): ArchitectureNodeSemantics | undefined {
  const provider = iconId.split("/")[0];
  if (provider !== "azure" && provider !== "aws" && provider !== "gcp") return semantics;
  if (semantics?.provider && semantics.provider !== provider) throw new Error("Conflicting service and provider identities.");
  return { ...semantics, provider };
}

export const connectionTypeSchema = z.enum(["data-flow", "network", "dependency", "sequence", "custom"]);
export const architectureEdgeSemanticsSchema = z.object({
  connectionType: connectionTypeSchema.optional(),
  protocol: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  arrowStyle: z.enum(["none", "forward", "backward", "bidirectional"]).optional(),
  lineStyle: z.enum(["solid", "dashed", "dotted"]).optional(),
  ...traceability,
}).strict();
export type ArchitectureEdgeSemantics = z.infer<typeof architectureEdgeSemanticsSchema>;

export const architectureMetadataSchema = z.object({
  name: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  designIntent: z.string().max(8000).optional(),
  author: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  createdAt: z.string().max(100).optional(),
  updatedAt: z.string().max(100).optional(),
  environments: z.array(z.object({
    id, name: z.string().trim().min(1).max(200), description: z.string().max(2000).optional(),
  }).strict()).max(50).optional(),
  requirements: z.array(z.object({
    id,
    category: z.enum(["functional", "reliability", "security", "cost", "performance", "operations", "compliance", "other"]),
    statement: z.string().trim().min(1).max(2000),
    evidenceIds: references.optional(),
  }).strict()).max(100).optional(),
  evidence: z.array(z.object({
    id,
    source: z.enum(["user", "document", "configuration", "test", "whiteboard-model", "ai-assumption"]),
    summary: z.string().trim().min(1).max(2000),
    uri: z.string().url().startsWith("https://").max(2000).optional(),
    sourceElementId: id.optional(),
    capturedAt: z.string().datetime({ offset: true }).optional(),
  }).strict()).max(1000).optional(),
}).strict();
export type ArchitectureMetadata = z.infer<typeof architectureMetadataSchema>;

const position = {
  id,
  label: z.string().max(1000),
  x: z.number().finite().min(-1_000_000).max(1_000_000),
  y: z.number().finite().min(-1_000_000).max(1_000_000),
  width: z.number().positive().max(100_000).optional(),
  height: z.number().positive().max(100_000).optional(),
  semantics: architectureNodeSemanticsSchema.optional(),
};
const child = { parentId: id.optional(), subtitle: z.string().max(2000).optional() };
export const architectureShapeSchema = z.enum(["rectangle", "circle", "diamond", "database", "person", "document", "internet"]);
export type ArchShape = z.infer<typeof architectureShapeSchema>;
const iconSchema = z.object({
  ...position, ...child, kind: z.literal("icon").optional(),
  iconId: z.string().max(1000), iconPath: z.string().max(2000),
});
const shapeSchema = z.object({ ...position, ...child, kind: z.literal("shape"), shape: architectureShapeSchema });
const groupSchema = z.object({
  ...position, kind: z.literal("group"), parentId: id.optional(),
  width: z.number().positive().max(100_000), height: z.number().positive().max(100_000),
  tier: z.string().max(200).optional(),
});
export type ArchIconNode = z.infer<typeof iconSchema>;
export type ArchShapeNode = z.infer<typeof shapeSchema>;
export type ArchGroupNode = z.infer<typeof groupSchema>;
export type ArchNode = ArchIconNode | ArchShapeNode | ArchGroupNode;
export const architectureEdgeSchema = z.object({
  id, source: id, target: id, label: z.string().max(1000).optional(),
  sourceHandle: z.enum(["top", "right", "bottom", "left"]).nullable().optional(),
  targetHandle: z.enum(["top", "right", "bottom", "left"]).nullable().optional(),
  style: z.enum(["solid", "dashed", "flow"]).optional(),
  step: z.number().int().positive().max(MAX_PLAYBACK_STEP).optional(),
  semantics: architectureEdgeSemanticsSchema.optional(),
});
export type ArchEdge = z.infer<typeof architectureEdgeSchema>;
export type ArchEdgeStyle = NonNullable<ArchEdge["style"]>;

export function parseConnectionHandle(value: string | null | undefined): ArchEdge["sourceHandle"] {
  if (value === undefined || value === null || value === "top" || value === "right" || value === "bottom" || value === "left") return value;
  throw new Error(`Unsupported connection handle "${value}".`);
}

export const architectureModelSchema = z.object({
  schemaVersion: z.literal(ARCHITECTURE_MODEL_VERSION).optional(),
  metadata: architectureMetadataSchema.optional(),
  nodes: z.array(z.union([iconSchema, shapeSchema, groupSchema])).max(500),
  edges: z.array(architectureEdgeSchema).max(1000),
}).strict();

/** Unversioned input remains accepted; every parsed/serialized document is versioned. */
export type ArchPayload = z.infer<typeof architectureModelSchema>;
export type VersionedArchitecture = ArchPayload & { schemaVersion: typeof ARCHITECTURE_MODEL_VERSION };
export function hasArchitectureContent(payload: ArchPayload): boolean {
  return payload.nodes.length > 0 || payload.edges.length > 0 ||
    Object.values(payload.metadata ?? {}).some((value) => Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.trim().length > 0);
}

export interface ArchitectureCodeInput {
  nodes: Array<Pick<ArchNode, "id" | "kind" | "label" | "semantics"> & { iconId?: string; cloud?: string }>;
  edges: Array<Pick<ArchEdge, "id" | "source" | "target" | "label" | "semantics">>;
  metadata?: ArchitectureMetadata;
  schemaVersion?: typeof ARCHITECTURE_MODEL_VERSION;
}

export function legacyNodeSemantics(data: { cloud?: unknown; properties?: unknown; semantics?: unknown }): ArchitectureNodeSemantics | undefined {
  const semantics = architectureNodeSemanticsSchema.parse(data.semantics ?? {});
  if (data.cloud !== undefined) {
    const provider = architectureProviderSchema.parse(data.cloud);
    if (semantics.provider && semantics.provider !== provider) throw new Error("Conflicting legacy provider identities.");
    semantics.provider = provider;
  }
  if (data.properties !== undefined) {
    const properties = servicePropertiesSchema.parse(data.properties);
    for (const field of ["region", "sku"] as const) {
      if (typeof properties[field] === "string") {
        if (semantics[field] && semantics[field] !== properties[field]) throw new Error(`Conflicting legacy ${field} values.`);
        semantics[field] = properties[field];
        delete properties[field];
      }
    }
    for (const [key, value] of Object.entries(properties)) {
      if (semantics.properties?.[key] !== undefined && semantics.properties[key] !== value) throw new Error(`Conflicting legacy property "${key}".`);
    }
    if (Object.keys(properties).length) semantics.properties = { ...properties, ...semantics.properties };
  }
  return Object.keys(semantics).length ? architectureNodeSemanticsSchema.parse(semantics) : undefined;
}

export function validateArchitectureReferences(payload: {
  metadata?: ArchitectureMetadata;
  nodes: Array<{ id: string; iconId?: string; semantics?: ArchitectureNodeSemantics }>;
  edges: Array<{ id: string; semantics?: ArchitectureEdgeSemantics }>;
}): void {
  const metadata = payload.metadata;
  for (const field of ["environments", "requirements", "evidence"] as const) {
    const entries = metadata?.[field] ?? [];
    if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
      throw new Error(`Architecture ${field} IDs must be unique.`);
    }
  }
  const environments = new Set(metadata?.environments?.map((entry) => entry.id));
  const requirements = new Set(metadata?.requirements?.map((entry) => entry.id));
  const evidence = new Set(metadata?.evidence?.map((entry) => entry.id));
  const check = (entry: { requirementIds?: string[]; evidenceIds?: string[] }, label: string) => {
    if (entry.requirementIds?.some((id) => !requirements.has(id))) throw new Error(`${label} references a missing requirement.`);
    if (entry.evidenceIds?.some((id) => !evidence.has(id))) throw new Error(`${label} references missing evidence.`);
  };
  for (const requirement of metadata?.requirements ?? []) check(requirement, `Requirement "${requirement.id}"`);
  for (const node of payload.nodes) {
    const semantics = node.semantics;
    if (!semantics) continue;
    check(semantics, `Node "${node.id}"`);
    if (semantics.environmentId && !environments.has(semantics.environmentId)) throw new Error(`Node "${node.id}" references a missing environment.`);
    if (node.iconId && semantics.provider && !node.iconId.startsWith(`${semantics.provider}/`)) {
      throw new Error(`Node "${node.id}" has conflicting service and provider identities.`);
    }
  }
  for (const edge of payload.edges) if (edge.semantics) check(edge.semantics, `Connection "${edge.id}"`);
}
