/**
 * Sequence playback helpers.
 *
 * Concepts:
 *  - An edge's `data.step` (1..N) defines its position in the sequence.
 *  - Edges with no `step` are excluded from playback.
 *  - Edges sharing the same `step` fire in parallel (a "frame").
 *  - normalizeSequence renumbers used steps to contiguous 1..K.
 *  - autoSequenceFromTopology assigns steps via BFS layering per connected
 *    component. Refuses on graphs containing cycles (returns null + reason).
 *
 * All functions are pure and synchronous so they unit-test easily.
 */
import type { PlaygroundEdge, PlaygroundGraph, PlaygroundNode } from "./types";

export interface SequenceFrame {
  step: number;          // 1..K (contiguous)
  edgeIds: string[];
  activeNodeIds: string[]; // sources + targets of this frame's edges
}

export interface NormalizedSequence {
  frames: SequenceFrame[];
  totalSteps: number;
}

/** Renumber `data.step` to contiguous order; group same-step edges into frames. */
export function normalizeSequence(edges: PlaygroundEdge[]): NormalizedSequence {
  const stepped = edges
    .filter((e) => typeof e.data?.step === "number" && Number.isFinite(e.data.step))
    .map((e) => ({ edge: e, step: e.data!.step as number }));

  if (stepped.length === 0) return { frames: [], totalSteps: 0 };

  // Group by original step.
  const groups = new Map<number, PlaygroundEdge[]>();
  for (const { edge, step } of stepped) {
    const arr = groups.get(step) ?? [];
    arr.push(edge);
    groups.set(step, arr);
  }

  const sortedSteps = Array.from(groups.keys()).sort((a, b) => a - b);

  const frames: SequenceFrame[] = sortedSteps.map((origStep, i) => {
    const edgeList = groups.get(origStep)!;
    const activeNodes = new Set<string>();
    for (const e of edgeList) {
      activeNodes.add(e.source);
      activeNodes.add(e.target);
    }
    return {
      step: i + 1,
      edgeIds: edgeList.map((e) => e.id),
      activeNodeIds: Array.from(activeNodes),
    };
  });

  return { frames, totalSteps: frames.length };
}

export interface AutoSequenceResult {
  ok: boolean;
  edgeUpdates?: Array<{ id: string; step: number }>;
  reason?: string;
}

/**
 * Assigns deterministic steps via per-component BFS layering.
 * Returns updates suitable for applying via `setEdges(prev => …)`.
 *
 * Determinism rules:
 *  - Within a component, root order = ascending position.x then position.y.
 *  - Layers are numbered globally with a per-component offset, so component 1
 *    finishes before component 2 begins (so a multi-cloud diagram plays as
 *    cloud-A then cloud-B rather than interleaved).
 */
export function autoSequenceFromTopology(
  nodes: PlaygroundNode[],
  edges: PlaygroundEdge[]
): AutoSequenceResult {
  // Cycle detection (Kahn's algorithm — if not all nodes get visited, there's a cycle).
  const indeg = new Map<string, number>();
  const out = new Map<string, string[]>();
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const id of nodeIds) {
    indeg.set(id, 0);
    out.set(id, []);
  }
  for (const e of edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
    out.get(e.source)!.push(e.target);
  }
  let visited = 0;
  const tmpIndeg = new Map(indeg);
  const stack = Array.from(tmpIndeg.entries()).filter(([, d]) => d === 0).map(([id]) => id);
  while (stack.length) {
    const id = stack.pop()!;
    visited++;
    for (const next of out.get(id) ?? []) {
      tmpIndeg.set(next, (tmpIndeg.get(next) ?? 0) - 1);
      if (tmpIndeg.get(next) === 0) stack.push(next);
    }
  }
  if (visited < nodeIds.size) {
    return { ok: false, reason: "Cycle detected — set edge steps manually." };
  }

  // Per-component BFS with deterministic root ordering.
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const adjUndirected = new Map<string, Set<string>>();
  for (const id of nodeIds) adjUndirected.set(id, new Set());
  for (const e of edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
    adjUndirected.get(e.source)!.add(e.target);
    adjUndirected.get(e.target)!.add(e.source);
  }

  const componentOf = new Map<string, number>();
  let comp = 0;
  for (const id of nodeIds) {
    if (componentOf.has(id)) continue;
    comp++;
    const queue = [id];
    componentOf.set(id, comp);
    while (queue.length) {
      const cur = queue.shift()!;
      for (const nb of adjUndirected.get(cur)!) {
        if (!componentOf.has(nb)) {
          componentOf.set(nb, comp);
          queue.push(nb);
        }
      }
    }
  }

  // Compute representative position per component (top-leftmost node).
  const compRepPos = new Map<number, { x: number; y: number }>();
  for (const n of nodes) {
    const c = componentOf.get(n.id)!;
    const cur = compRepPos.get(c);
    if (!cur || n.position.x < cur.x || (n.position.x === cur.x && n.position.y < cur.y)) {
      compRepPos.set(c, { x: n.position.x, y: n.position.y });
    }
  }
  const componentOrder = Array.from(compRepPos.keys()).sort((a, b) => {
    const pa = compRepPos.get(a)!;
    const pb = compRepPos.get(b)!;
    return pa.x - pb.x || pa.y - pb.y;
  });

  const layerOfNode = new Map<string, number>();
  let globalLayer = 0;
  for (const c of componentOrder) {
    const compNodes = nodes.filter((n) => componentOf.get(n.id) === c);
    const compIndeg = new Map<string, number>();
    for (const n of compNodes) compIndeg.set(n.id, 0);
    for (const e of edges) {
      if (componentOf.get(e.source) !== c) continue;
      compIndeg.set(e.target, (compIndeg.get(e.target) ?? 0) + 1);
    }
    let frontier = compNodes
      .filter((n) => (compIndeg.get(n.id) ?? 0) === 0)
      .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)
      .map((n) => n.id);

    let layerInComp = 0;
    while (frontier.length) {
      const layerForFrontier = globalLayer + layerInComp;
      for (const id of frontier) layerOfNode.set(id, layerForFrontier);
      const next = new Set<string>();
      for (const id of frontier) {
        for (const nb of out.get(id) ?? []) {
          if (componentOf.get(nb) !== c) continue;
          compIndeg.set(nb, (compIndeg.get(nb) ?? 0) - 1);
          if (compIndeg.get(nb) === 0) next.add(nb);
        }
      }
      frontier = Array.from(next).sort((a, b) => {
        const pa = nodeMap.get(a)!.position;
        const pb = nodeMap.get(b)!.position;
        return pa.x - pb.x || pa.y - pb.y;
      });
      layerInComp++;
    }
    globalLayer += Math.max(layerInComp, 1);
  }

  // Edge step = source layer + 1 (so step 1 = first edges leaving roots).
  const updates: Array<{ id: string; step: number }> = [];
  for (const e of edges) {
    const srcLayer = layerOfNode.get(e.source);
    if (srcLayer === undefined) continue;
    updates.push({ id: e.id, step: srcLayer + 1 });
  }

  return { ok: true, edgeUpdates: updates };
}

/** Convenience: apply autosequence updates to a graph clone. */
export function applyAutoSequence(graph: PlaygroundGraph): {
  ok: boolean;
  graph?: PlaygroundGraph;
  reason?: string;
} {
  const result = autoSequenceFromTopology(graph.nodes, graph.edges);
  if (!result.ok || !result.edgeUpdates) return { ok: false, reason: result.reason };
  const stepById = new Map(result.edgeUpdates.map((u) => [u.id, u.step]));
  const edges = graph.edges.map((e) => ({
    ...e,
    data: { ...(e.data ?? {}), step: stepById.get(e.id) ?? e.data?.step, animated: true },
  }));
  return { ok: true, graph: { ...graph, edges } };
}
