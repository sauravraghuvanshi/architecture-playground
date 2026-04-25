/**
 * Schema migrations for persisted playground payloads.
 *
 * Every save carries a `version` number.  When loading, we walk from the
 * payload's version to `CURRENT_SCHEMA_VERSION` via the migration ladder.
 *
 * Rules:
 *   - Migrations MUST be backward-only (old → new).
 *   - Each migration returns a fresh object — never mutate in place.
 *   - After migration the payload should pass Zod validation.
 */
import { CURRENT_SCHEMA_VERSION, DEFAULT_LAYER } from "./types";
import type { ConnectionType, LineStyle, ArrowStyle, PlaygroundGraph, StoredPayload } from "./types";

// ---------------------------------------------------------------------------
// Migration functions   (version N → version N+1)
// ---------------------------------------------------------------------------

/**
 * v1 → v2:
 *   - Edges get default `connectionType: "data-flow"`, `lineStyle: "solid"`, `arrowStyle: "forward"`
 *   - Graph gets a default layer
 *   - Graph gets empty metadata
 */
function migrateV1toV2(graph: PlaygroundGraph): PlaygroundGraph {
  const edges = graph.edges.map((e) => {
    const existing = (e.data ?? {}) as Record<string, unknown>;
    return {
      ...e,
      data: {
        ...e.data,
        connectionType: (existing.connectionType as ConnectionType | undefined) ?? ("data-flow" as ConnectionType),
        lineStyle: (existing.lineStyle as LineStyle | undefined) ?? ("solid" as LineStyle),
        arrowStyle: (existing.arrowStyle as ArrowStyle | undefined) ?? ("forward" as ArrowStyle),
      },
    };
  });

  return {
    ...graph,
    edges,
    layers: graph.layers ?? [{ ...DEFAULT_LAYER }],
    metadata: graph.metadata ?? {},
  };
}

// Ordered migration ladder.  Index 0 = v1→v2, index 1 = v2→v3, etc.
const MIGRATIONS: Array<(graph: PlaygroundGraph) => PlaygroundGraph> = [
  migrateV1toV2,
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply all needed migrations to bring a graph from `fromVersion` to
 * `CURRENT_SCHEMA_VERSION`.  Returns the migrated graph and the final version.
 */
export function migrateGraph(
  graph: PlaygroundGraph,
  fromVersion: number
): { graph: PlaygroundGraph; version: number } {
  let current = graph;
  let version = fromVersion;

  while (version < CURRENT_SCHEMA_VERSION) {
    const migrationIdx = version - 1; // v1→v2 is index 0
    const fn = MIGRATIONS[migrationIdx];
    if (!fn) {
      // No migration path — return as-is (the validator will catch real issues).
      break;
    }
    current = fn(current);
    version++;
  }

  return { graph: current, version };
}

/**
 * Migrate a full `StoredPayload` (as parsed from JSON).  Returns a valid
 * payload at the current schema version, or `null` if unrecoverable.
 */
export function migratePayload(raw: unknown): StoredPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<StoredPayload>;

  // Must have a version and a graph.
  if (typeof p.version !== "number" || !p.graph) return null;

  // Already at current version — return as-is.
  if (p.version === CURRENT_SCHEMA_VERSION) return p as StoredPayload;

  // Future version — we can't downgrade.
  if (p.version > CURRENT_SCHEMA_VERSION) return null;

  const { graph, version } = migrateGraph(p.graph, p.version);
  return {
    version,
    savedAt: p.savedAt ?? new Date().toISOString(),
    graph,
  };
}

/**
 * Ensure a bare graph (e.g. from a template or import) has all v2 fields.
 * This is the "normalize" step — it fills defaults without requiring a version.
 */
export function normalizeGraph(graph: PlaygroundGraph): PlaygroundGraph {
  return migrateV1toV2(graph);
}
