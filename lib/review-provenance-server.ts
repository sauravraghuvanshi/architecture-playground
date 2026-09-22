import { createHash } from "node:crypto";
import {
  ARCHITECTURE_REVIEW_JSON_SCHEMA, buildArchitectureReviewSystemPrompt,
  type ArchitectureReview,
} from "./architecture-review.ts";
import { REVIEW_GUIDANCE, REVIEW_GUIDANCE_VERSION } from "./review-guidance.ts";
import {
  REVIEW_PROMPT_VERSION, REVIEW_OUTPUT_SCHEMA_VERSION, reviewProvenanceSchema,
  canonicalReviewJson, type ReviewProvenance,
} from "./review-provenance.ts";

export function reviewHash(value: unknown): string {
  return createHash("sha256").update(canonicalReviewJson(value), "utf8").digest("hex");
}

export function createReviewProvenance({
  source, evidence, review, payload, attempts,
}: {
  source: ReviewProvenance["source"];
  evidence: unknown;
  review: ArchitectureReview;
  payload?: { nodes: readonly unknown[]; edges: readonly unknown[] };
  attempts: ReviewProvenance["attempts"];
}): ReviewProvenance {
  return reviewProvenanceSchema.parse({
    version: 1, generatedAt: new Date().toISOString(),
    promptVersion: REVIEW_PROMPT_VERSION, outputSchemaVersion: REVIEW_OUTPUT_SCHEMA_VERSION,
    guidanceVersion: REVIEW_GUIDANCE_VERSION, source, hashAlgorithm: "sha256-canonical-json-v1",
    guidanceSha256: reviewHash(REVIEW_GUIDANCE),
    evidenceSha256: reviewHash(evidence),
    systemPromptSha256: reviewHash(buildArchitectureReviewSystemPrompt(payload)),
    outputSchemaSha256: reviewHash(ARCHITECTURE_REVIEW_JSON_SCHEMA),
    reviewSha256: reviewHash(review), attempts,
    validationScope: "input-schema-output-schema-and-reference-checks",
    runtimeVerified: false,
    replayGuarantee: "not-guaranteed-unpinned-agent-and-model-nondeterminism",
  });
}
