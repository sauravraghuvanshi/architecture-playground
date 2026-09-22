import { architectureReviewRequestSchema, parseGeneratedArchitectureReview } from "../lib/architecture-review";
import { createReviewProvenance, reviewHash } from "../lib/review-provenance-server";

export function reviewResponse(review: unknown, input: unknown) {
  const evidence = architectureReviewRequestSchema.parse(input);
  const payload = evidence.source === "canvas" || evidence.source === "import" ? evidence.payload : undefined;
  const checked = parseGeneratedArchitectureReview(JSON.stringify(review), payload);
  return {
    review: checked, transport: "foundry-agent",
    provenance: createReviewProvenance({
      source: evidence.source, evidence, review: checked, payload,
      attempts: [{
        requestSha256: reviewHash(evidence),
        invocation: {
          agentName: "synthetic-review-agent", agentVersion: null,
          modelReportedId: "synthetic-model-v1", responseId: "synthetic-response",
          maxOutputTokens: 6000, toolChoice: "none", store: false,
        },
      }],
    }),
  };
}
