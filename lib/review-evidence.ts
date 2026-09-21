import { z } from "zod";
import { parseArchitectureDocument } from "./architecture-document.ts";

export const REVIEW_EVIDENCE_MAX_BYTES = 120_000;
const id = z.string().min(1).max(200).refine((value) => Boolean(value.trim()), "Evidence IDs cannot be blank.");

// Legacy evidence retains its fields; native versioned data uses the shared model.
export const reviewEvidenceSchema = z.object({
  schemaVersion: z.number().optional(),
  nodes: z.array(z.object({ id }).passthrough()).max(500),
  edges: z.array(z.object({ id, source: id, target: id }).passthrough()).max(1000),
}).passthrough().superRefine((payload, context) => {
  const pending: Array<{ value: unknown; depth: number }> = [{ value: payload, depth: 0 }];
  let visited = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (++visited > 30_000 || depth > 32) {
      context.addIssue({ code: "custom", message: "Diagram evidence nesting or value count exceeds the supported limit." });
      return;
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      context.addIssue({ code: "custom", message: "Diagram evidence contains a non-finite number." });
      return;
    }
    if (value && typeof value === "object") {
      for (const child of Object.values(value)) pending.push({ value: child, depth: depth + 1 });
    }
  }
  const nodes = new Set(payload.nodes.map((node) => node.id));
  const edges = new Set(payload.edges.map((edge) => edge.id));
  if (nodes.size !== payload.nodes.length || edges.size !== payload.edges.length) context.addIssue({
    code: "custom", message: "Evidence node and connection IDs must be unique.",
  });
  if (payload.edges.some((edge) => !nodes.has(edge.source) || !nodes.has(edge.target))) context.addIssue({
    code: "custom", message: "Evidence connections must reference existing nodes.",
  });
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > REVIEW_EVIDENCE_MAX_BYTES) context.addIssue({
    code: "custom", message: `Diagram evidence exceeds the ${REVIEW_EVIDENCE_MAX_BYTES.toLocaleString("en-US")}-byte limit. Reduce the diagram; evidence is never silently truncated.`,
  });
}).transform((payload, context) => {
  if (payload.schemaVersion === undefined) return payload;
  try { return parseArchitectureDocument(payload); }
  catch {
    context.addIssue({ code: "custom", message: "Invalid versioned architecture evidence." });
    return z.NEVER;
  }
});

export const legacyReviewRequestSchema = z.object({ graph: reviewEvidenceSchema }).strict();
