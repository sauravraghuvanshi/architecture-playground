// Shared types for the Architecture Playground.
// Server (page.tsx) and client (Playground/Canvas) both import from here.

// ---------------------------------------------------------------------------
// Cloud provider identifiers
// ---------------------------------------------------------------------------

export type CloudId = "azure" | "aws" | "gcp";

/** Superset that includes a "generic" provider for cloud-agnostic shapes. */
export type CloudProvider = CloudId | "generic";

// ---------------------------------------------------------------------------
// Icon manifest (generated at build time by scripts/build-cloud-icon-manifest)
// ---------------------------------------------------------------------------

export interface IconManifestEntry {
  id: string;            // "azure/compute/app-service"
  cloud: CloudId;
  cloudLabel: string;
  category: string;
  categoryLabel: string;
  slug: string;
  label: string;         // "App Service"
  path: string;          // "/cloud-icons/azure/compute/app-service.svg"
}

export interface IconManifest {
  version: number;
  generatedAt: string;
  count: number;
  icons: IconManifestEntry[];
}

// ---------------------------------------------------------------------------
// Connection types — semantic meaning of an edge
// ---------------------------------------------------------------------------

export type ConnectionType =
  | "data-flow"      // data moves between services (default)
  | "network"        // network-level connectivity (VNet peering, Private Link)
  | "dependency"     // one service depends on another (not a data path)
  | "sequence"       // numbered request-flow step (participates in playback)
  | "custom";        // user-defined

/** Edge line rendering style. */
export type LineStyle = "solid" | "dashed" | "dotted";

/** Edge arrow direction. */
export type ArrowStyle = "none" | "forward" | "backward" | "bidirectional";

/** Connection types that participate in sequence playback and auto-sequencing. */
export const SEQUENCEABLE_CONNECTION_TYPES: ReadonlySet<ConnectionType> = new Set([
  "data-flow",
  "sequence",
]);

// ---------------------------------------------------------------------------
// Layer model (data-only in P0; UI in P2)
// ---------------------------------------------------------------------------

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color: string;       // hex color for layer indicator
  order: number;       // sort order (lower = rendered first / behind)
}

export const DEFAULT_LAYER: Layer = {
  id: "default",
  name: "Default",
  visible: true,
  locked: false,
  color: "#6366f1",
  order: 0,
};

// ---------------------------------------------------------------------------
// Service definition — rich metadata resolved from the service registry
// ---------------------------------------------------------------------------

export interface ServiceDefinition {
  serviceId: string;           // canonical ID: matches IconManifestEntry.id
  displayName: string;
  category: string;            // "Compute", "Networking", "AI", etc.
  provider: CloudProvider;
  icon: string;                // icon path
  description?: string;
  properties?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Diagram metadata
// ---------------------------------------------------------------------------

export interface DiagramMetadata {
  name?: string;
  description?: string;
  author?: string;
  tags?: string[];
  createdAt?: string;          // ISO 8601
  updatedAt?: string;          // ISO 8601
}

// ---------------------------------------------------------------------------
// Node types
// ---------------------------------------------------------------------------

export type ServiceNodeType = "service";
export type GroupNodeType = "group";
export type StickyNodeType = "sticky";
export type PlaygroundNodeType = ServiceNodeType | GroupNodeType | StickyNodeType;

export interface BasePosition {
  x: number;
  y: number;
}

/**
 * Free-form typed properties on a service node.
 * Used by IaC emitters (Bicep/Terraform) and AI review.
 * Keys & values are intentionally loose (sku, tier, region, replicas, etc).
 */
export type ServiceProperties = Record<string, string | number | boolean>;

export interface ServiceNodeData {
  iconId: string;        // matches IconManifestEntry.id
  label: string;
  cloud: CloudId;
  description?: string;
  layerId?: string;      // layer assignment; defaults to "default"
  tags?: string[];
  properties?: ServiceProperties;
}

export interface GroupNodeData {
  label: string;
  variant: "vpc" | "resource-group" | "project" | "subnet" | "region" | "custom";
  color?: string;        // hex string
  description?: string;
  layerId?: string;
}

export interface StickyNodeData {
  label: string;
  color?: string;
  layerId?: string;
}

export interface PlaygroundNode {
  id: string;
  type: PlaygroundNodeType;
  position: BasePosition;
  data: ServiceNodeData | GroupNodeData | StickyNodeData;
  parentId?: string;
  width?: number;
  height?: number;
  zIndex?: number;
}

// ---------------------------------------------------------------------------
// Edge types
// ---------------------------------------------------------------------------

export interface PlaygroundEdgeData {
  label?: string;
  animated?: boolean;
  step?: number;             // 1..N for sequence playback. undefined = excluded.
  color?: string;
  connectionType?: ConnectionType;   // defaults to "data-flow"
  protocol?: string;                 // "HTTPS", "gRPC", "AMQP", "MQTT", etc.
  lineStyle?: LineStyle;             // defaults to "solid"
  arrowStyle?: ArrowStyle;           // defaults to "forward"
  description?: string;
}

export interface PlaygroundEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: PlaygroundEdgeData;
}

// ---------------------------------------------------------------------------
// Graph / diagram
// ---------------------------------------------------------------------------

export interface PlaygroundViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface PlaygroundGraph {
  nodes: PlaygroundNode[];
  edges: PlaygroundEdge[];
  viewport?: PlaygroundViewport;
  layers?: Layer[];
  metadata?: DiagramMetadata;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export interface PlaygroundTemplate {
  id: string;
  name: string;
  description: string;
  cloud: CloudId | "multi";
  graph: PlaygroundGraph;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/** Current schema version for persisted payloads. */
export const CURRENT_SCHEMA_VERSION = 2;

export interface StoredPayload {
  version: number;
  savedAt: string;
  graph: PlaygroundGraph;
}
