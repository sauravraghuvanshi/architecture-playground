import { z } from "zod";

export const REVIEW_PROMPT_VERSION = "architecture-review-v2";
export const REVIEW_OUTPUT_SCHEMA_VERSION = 2;
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const identifier = z.string().min(1).max(200);
export const reviewInvocationSchema = z.object({
  agentName: identifier,
  agentVersion: z.null(),
  modelReportedId: identifier.nullable(),
  responseId: identifier.nullable(),
  maxOutputTokens: z.number().int().positive(),
  toolChoice: z.literal("none"),
  store: z.literal(false),
}).strict();
export type ReviewInvocation = z.infer<typeof reviewInvocationSchema>;

export const reviewProvenanceSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string().datetime(),
  promptVersion: z.literal(REVIEW_PROMPT_VERSION),
  outputSchemaVersion: z.literal(REVIEW_OUTPUT_SCHEMA_VERSION),
  guidanceVersion: identifier,
  guidanceSha256: hash,
  evidenceSha256: hash,
  systemPromptSha256: hash,
  outputSchemaSha256: hash,
  reviewSha256: hash,
  source: z.enum(["canvas", "import", "description", "image", "legacy"]),
  hashAlgorithm: z.literal("sha256-canonical-json-v1"),
  attempts: z.array(z.object({
    requestSha256: hash,
    invocation: reviewInvocationSchema,
  }).strict()).min(1).max(2),
  validationScope: z.literal("input-schema-output-schema-and-reference-checks"),
  runtimeVerified: z.literal(false),
  replayGuarantee: z.literal("not-guaranteed-unpinned-agent-and-model-nondeterminism"),
}).strict();
export type ReviewProvenance = z.infer<typeof reviewProvenanceSchema>;

export function canonicalReviewJson(value: unknown): string {
  const result = JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0))
      : item);
  if (result === undefined) throw new Error("Review evidence cannot be serialized.");
  return result;
}
