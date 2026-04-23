// Shared types for the Architecture Playground.
// Server (page.tsx) and client (Playground/Canvas) both import from here.

export type CloudId = "azure" | "aws" | "gcp";

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

export type ServiceNodeType = "service";
export type GroupNodeType = "group";
export type StickyNodeType = "sticky";
export type PlaygroundNodeType = ServiceNodeType | GroupNodeType | StickyNodeType;

export interface BasePosition {
  x: number;
  y: number;
}

export interface ServiceNodeData {
  iconId: string;        // matches IconManifestEntry.id
  label: string;
  cloud: CloudId;
}

export interface GroupNodeData {
  label: string;
  variant: "vpc" | "resource-group" | "project" | "subnet" | "region" | "custom";
  color?: string;        // hex string
}

export interface StickyNodeData {
  label: string;
  color?: string;
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

export interface PlaygroundEdgeData {
  label?: string;
  animated?: boolean;
  step?: number;         // 1..N for sequence playback. undefined = excluded from playback.
  color?: string;
}

export interface PlaygroundEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: PlaygroundEdgeData;
}

export interface PlaygroundViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface PlaygroundGraph {
  nodes: PlaygroundNode[];
  edges: PlaygroundEdge[];
  viewport?: PlaygroundViewport;
}

export interface PlaygroundTemplate {
  id: string;
  name: string;
  description: string;
  cloud: CloudId | "multi";
  graph: PlaygroundGraph;
}

export interface StoredPayload {
  version: number;
  savedAt: string;
  graph: PlaygroundGraph;
}
