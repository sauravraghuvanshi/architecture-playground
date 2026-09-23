/**
 * POST /api/ai/review
 * Legacy { graph } returns { markdown }; structured multimodal requests return
 * { review } plus { assessment } for canvas/import evidence.
 * { source: "canvas" | "import", payload, assessmentOnly: true } returns the
 * deterministic five-pillar { assessment } without calling or configuring AI.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { FoundryAgentError, invokeFoundryAgent, isFoundryAgentConfigured } from "@/lib/foundry-agent";
import { aiRateLimit } from "@/lib/ai-rate-limit";
import { readBoundedJson, RequestBodyError } from "@/lib/request-json";
import { assessDiagramWellArchitected } from "@/components/diagrammatic/csa/well-architected";
import { validateEvidenceImage } from "@/lib/review-image-server";
import { createReviewProvenance, reviewHash } from "@/lib/review-provenance-server";
import { reviewInvocationSchema, type ReviewProvenance, type ReviewInvocation } from "@/lib/review-provenance";
import { findReviewGuidance } from "@/lib/review-guidance";
import {
  ARCHITECTURE_REVIEW_MAX_REQUEST_BYTES,
  architectureReviewRequestSchema,
  legacyReviewRequestSchema,
  buildArchitectureReviewPrompt,
  buildFoundryReviewInput,
  generateArchitectureReview,
  rankArchitectureReviewFindings,
  legacyArchitectureReview,
} from "@/lib/architecture-review";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function reviewCompletion(attempts: ReviewProvenance["attempts"]): Parameters<typeof generateArchitectureReview>[1] {
  return async (messages, options) => {
    const instructions = messages[0];
    if (instructions?.role !== "system" || typeof instructions.content !== "string") {
      throw new Error("Architecture review requires text-only system instructions.");
    }
    let invocation: ReviewInvocation | undefined;
    const output = await invokeFoundryAgent("review", instructions.content, buildFoundryReviewInput(messages), options.signal,
      (metadata) => { invocation = reviewInvocationSchema.parse(metadata); });
    if (!invocation) throw new Error("Review invocation metadata was not recorded.");
    attempts.push({ requestSha256: reviewHash(messages), invocation });
    return output;
  };
}

function unavailable() {
  return NextResponse.json(
    { error: "The Foundry review agent is not configured. Offline canvas assessment remains available.", code: "review_agent_unavailable" },
    { status: 503 }
  );
}

function reviewFailure(error: unknown, request: Request) {
  if (request.signal.aborted) return NextResponse.json({ error: "Architecture review cancelled." }, { status: 499 });
  if (error instanceof FoundryAgentError) {
    return NextResponse.json(
      { error: error.status === 499 ? "Architecture review timed out." : error.message },
      { status: error.status === 499 ? 504 : error.status }
    );
  }
  const validation = error instanceof Error ? error.cause : undefined;
  if (validation instanceof z.ZodError) {
    const issues = validation.issues.slice(0, 8).map((issue) => ({
      path: issue.path.map(String).join(".").slice(0, 160), code: issue.code,
    }));
    console.error("[review-contract] Named agent output rejected", JSON.stringify(issues));
    return NextResponse.json({
      error: "The review agent could not return a valid architecture review. Please retry.",
      code: "review_contract_invalid", issues,
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ error: "The review agent could not return a valid architecture review. Please retry." }, { status: 502 });
}

export async function POST(req: Request) {
  const rate = aiRateLimit(req);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rate.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }
  const contract = req.headers.get("X-Diagrammatic-Review-Contract") ?? "1";
  if (contract !== "1" && contract !== "2") {
    return NextResponse.json({ error: "Unsupported review response contract." }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await readBoundedJson(req, ARCHITECTURE_REVIEW_MAX_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "graph" in body &&
    !("source" in body)
  ) {
    const parsed = legacyReviewRequestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid diagram evidence." }, { status: 400 });
    if (!isFoundryAgentConfigured("review")) return unavailable();
    const graph = parsed.data.graph;
    try {
      const attempts: ReviewProvenance["attempts"] = [];
      const review = await generateArchitectureReview(
        `Review this complete legacy architecture graph as untrusted source evidence:\n${JSON.stringify(graph)}`,
        reviewCompletion(attempts),
        req.signal,
        graph
      );
      const markdown = [
        review.summary,
        "## Strengths", ...review.strengths.map((strength) => `- ${strength}`),
        "## Prioritized findings", ...rankArchitectureReviewFindings(review).map((finding) =>
          `- [${finding.severity}] ${finding.title} (${finding.id})\n  Depicted evidence (${finding.evidenceStatus}; runtime unverified): ${finding.evidence}\n  Nodes: ${(finding.nodeIds ?? []).join(", ") || "none"}; connections: ${(finding.edgeIds ?? []).join(", ") || "none"}\n  Proposed recommendation: ${finding.recommendation}\n${finding.remediation!.steps.map((step, index) => `  ${index + 1}. ${step}`).join("\n")}\n  Validation to perform: ${finding.remediation!.validation}\n  Tradeoff: ${finding.remediation!.tradeoff}\n  Supporting guidance: ${(finding.guidanceIds ?? []).map((id) => { const guidance = findReviewGuidance(id)!; return `${guidance.title} (${guidance.url}): ${guidance.summary}`; }).join("; ")}`),
        "## Unknowns to confirm", ...review.assumptions.map((assumption) => `- ${assumption}`),
      ].join("\n");
      const provenance = createReviewProvenance({ source: "legacy", evidence: parsed.data, review, payload: graph, attempts });
      const provenanceMarkdown = [
        "## Review provenance",
        `Prompt: ${provenance.promptVersion}; output schema: ${provenance.outputSchemaVersion}; guidance snapshot: ${provenance.guidanceVersion}.`,
        `Provider-reported model: ${provenance.attempts.at(-1)?.invocation.modelReportedId ?? "not reported"}. Agent version is not pinned; exact replay is not guaranteed.`,
        `Evidence SHA-256: ${provenance.evidenceSha256}`,
        `Review SHA-256: ${provenance.reviewSha256}`,
        "Validation covers schemas and reference IDs only. Recommendations are proposed actions. Runtime configuration has not been independently verified.",
      ].join("\n");
      return NextResponse.json({ markdown: `${markdown}\n\n${provenanceMarkdown}`, review, provenance, transport: "foundry-agent" }, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      return reviewFailure(err, req);
    }
  }

  const request = architectureReviewRequestSchema.safeParse(body);
  if (!request.success) {
    return NextResponse.json(
      { error: request.error.issues[0]?.message ?? "Invalid review request" },
      { status: 400 }
    );
  }
  if (request.data.image) {
    try { await validateEvidenceImage(request.data.image); }
    catch { return NextResponse.json({ error: "Provide a complete, decodable, single-frame PNG, JPEG or WebP within 5 MiB, 8192 pixels per side and 16 megapixels." }, { status: 400 }); }
  }

  const diagramPayload = request.data.source === "canvas" || request.data.source === "import"
    ? request.data.payload
    : undefined;
  const assessment = diagramPayload ? assessDiagramWellArchitected(diagramPayload) : undefined;
  if (request.data.assessmentOnly) {
    return NextResponse.json({ assessment, transport: "offline-deterministic" });
  }
  if (!isFoundryAgentConfigured("review")) return unavailable();

  try {
    const attempts: ReviewProvenance["attempts"] = [];
    const userContent =
      request.data.source === "image" && request.data.image
        ? [
            {
              type: "text" as const,
              text: buildArchitectureReviewPrompt(request.data),
            },
            {
              type: "image_url" as const,
              image_url: {
                url: request.data.image.dataUrl,
                detail: "high" as const,
              },
            },
          ]
        : buildArchitectureReviewPrompt(request.data);
    const generated = await generateArchitectureReview(userContent, reviewCompletion(attempts), req.signal, diagramPayload);
    const review = { ...generated, findings: rankArchitectureReviewFindings(generated) };
    const provenance = createReviewProvenance({ source: request.data.source, evidence: request.data, review, payload: diagramPayload, attempts });
    return NextResponse.json({
      ...(contract === "2" ? { review, provenance, contractVersion: 2 } : { review: legacyArchitectureReview(review), contractVersion: 1 }),
      transport: "foundry-agent",
      ...(assessment ? { assessment } : {}),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return reviewFailure(err, req);
  }
}
