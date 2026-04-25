/**
 * Template engine — parameterized PlaygroundTemplate resolution.
 *
 * Design:
 *   - A `ParameterizedTemplate` is a `PlaygroundTemplate` plus optional
 *     `parameters` (declared knobs the user can set) and optional per-node /
 *     per-edge `_when` predicates that filter the graph at resolve time.
 *   - Resolving a template means: read parameter values (defaults if missing),
 *     drop nodes/edges whose `_when` predicate fails, optionally swap icon
 *     choices, then return a clean `PlaygroundGraph`.
 *   - Drops cascade: edges whose source/target was filtered out are dropped.
 *
 * The engine is pure & deterministic so it's trivial to unit test.
 */
import type {
  PlaygroundEdge,
  PlaygroundGraph,
  PlaygroundNode,
  PlaygroundTemplate,
  ServiceNodeData,
} from "./types";
import { normalizeGraph } from "./migrations";

export type ParameterValue = string | number | boolean;

export interface TemplateParameter {
  id: string;
  label: string;
  description?: string;
  type: "enum" | "number" | "boolean";
  default: ParameterValue;
  choices?: Array<{ value: ParameterValue; label: string }>;
  /** Inclusive bounds for `number` type. */
  min?: number;
  max?: number;
}

/** Predicate describing when a node/edge should be included. */
export interface WhenPredicate {
  /** Map of parameterId → allowed value(s). All entries must match. */
  [paramId: string]: ParameterValue | ParameterValue[];
}

/** Per-node icon swap based on a parameter's value. */
export interface IconChoice {
  paramId: string;
  /** Map of parameter value → iconId to substitute. */
  values: Record<string, string>;
}

export type ParameterizedNode = PlaygroundNode & {
  _when?: WhenPredicate;
  _iconChoice?: IconChoice;
};

export type ParameterizedEdge = PlaygroundEdge & {
  _when?: WhenPredicate;
};

export interface ParameterizedTemplate
  extends Omit<PlaygroundTemplate, "graph"> {
  category?: string;
  tags?: string[];
  difficulty?: "beginner" | "intermediate" | "advanced";
  author?: string;
  thumbnail?: string;
  parameters?: TemplateParameter[];
  graph: {
    nodes: ParameterizedNode[];
    edges: ParameterizedEdge[];
    viewport?: PlaygroundGraph["viewport"];
    layers?: PlaygroundGraph["layers"];
    metadata?: PlaygroundGraph["metadata"];
  };
}

// ---------------------------------------------------------------------------

/**
 * Returns true if `predicate` matches the supplied parameter values.
 * Missing param → fall back to undefined → only matches if predicate explicitly
 * allows undefined (we treat this as "not matched" → element excluded).
 */
export function matchesPredicate(
  predicate: WhenPredicate | undefined,
  values: Record<string, ParameterValue>
): boolean {
  if (!predicate) return true;
  for (const [paramId, expected] of Object.entries(predicate)) {
    const actual = values[paramId];
    if (Array.isArray(expected)) {
      if (!expected.includes(actual)) return false;
    } else if (actual !== expected) {
      return false;
    }
  }
  return true;
}

/** Returns the resolved parameter values, filling defaults for missing keys. */
export function resolveParameterValues(
  template: ParameterizedTemplate,
  overrides: Record<string, ParameterValue> = {}
): Record<string, ParameterValue> {
  const out: Record<string, ParameterValue> = {};
  for (const param of template.parameters ?? []) {
    const v = Object.prototype.hasOwnProperty.call(overrides, param.id)
      ? overrides[param.id]
      : param.default;
    out[param.id] = v;
  }
  // Allow extra overrides too (caller knows what they're doing).
  for (const [k, v] of Object.entries(overrides)) {
    if (!(k in out)) out[k] = v;
  }
  return out;
}

/**
 * Resolve a parameterized template against the supplied parameter values
 * (defaults applied for missing keys). Returns a clean, schema-v2 graph
 * with the `_when` / `_iconChoice` template metadata stripped.
 */
export function resolveTemplate(
  template: ParameterizedTemplate,
  overrides: Record<string, ParameterValue> = {}
): PlaygroundGraph {
  const values = resolveParameterValues(template, overrides);

  // 1. Filter & finalize nodes.
  const keptNodes: PlaygroundNode[] = [];
  const keptIds = new Set<string>();
  for (const n of template.graph.nodes) {
    if (!matchesPredicate(n._when, values)) continue;

    let data = n.data;
    // Apply icon choice for service nodes.
    if (n._iconChoice && n.type === "service") {
      const paramVal = values[n._iconChoice.paramId];
      const replacement = n._iconChoice.values[String(paramVal)];
      if (replacement) {
        data = { ...(data as ServiceNodeData), iconId: replacement };
      }
    }
    const { _when, _iconChoice, ...clean } = n;
    void _when; void _iconChoice;
    keptNodes.push({ ...clean, data });
    keptIds.add(n.id);
  }

  // 2. Filter edges (drop if endpoints missing or predicate fails).
  const keptEdges: PlaygroundEdge[] = [];
  for (const e of template.graph.edges) {
    if (!matchesPredicate(e._when, values)) continue;
    if (!keptIds.has(e.source) || !keptIds.has(e.target)) continue;
    const { _when, ...clean } = e;
    void _when;
    keptEdges.push(clean);
  }

  return normalizeGraph({
    nodes: keptNodes,
    edges: keptEdges,
    viewport: template.graph.viewport,
    layers: template.graph.layers,
    metadata: template.graph.metadata,
  });
}

/** Convenience: resolve with all defaults. */
export function resolveTemplateDefaults(
  template: ParameterizedTemplate
): PlaygroundGraph {
  return resolveTemplate(template, {});
}
