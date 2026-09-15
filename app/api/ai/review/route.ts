/**
 * POST /api/ai/review
 * Legacy { graph } returns { markdown }; structured multimodal requests return
 * { review } plus { assessment } for canvas/import evidence.
 * { source: "canvas" | "import", payload, assessmentOnly: true } returns the
 * deterministic five-pillar { assessment } without calling or configuring AI.
 */
import { NextResponse } from "next/server";
import { FoundryAgentError, invokeFoundryAgent, isFoundryAgentConfigured } from "@/lib/foundry-agent";
import { aiRateLimit } from "@/lib/ai-rate-limit";
import { readBoundedJson, RequestBodyError } from "@/lib/request-json";
import { assessDiagramWellArchitected } from "@/components/diagrammatic/csa/well-architected";
import {
  ARCHITECTURE_REVIEW_MAX_REQUEST_BYTES,
  ARCHITECTURE_REVIEW_SYSTEM_PROMPT,
  architectureReviewRequestSchema,
  buildArchitectureReviewPrompt,
  buildFoundryReviewInput,
  generateArchitectureReview,
  rankArchitectureReviewFindings,
} from "@/lib/architecture-review";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const completeReview: Parameters<typeof generateArchitectureReview>[1] = (messages, options) =>
  invokeFoundryAgent("review", ARCHITECTURE_REVIEW_SYSTEM_PROMPT, buildFoundryReviewInput(messages), options.signal);

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
    if (!isFoundryAgentConfigured("review")) return unavailable();
    const graph = (body as { graph?: unknown }).graph;
    if (!graph) return NextResponse.json({ error: "Missing 'graph'" }, { status: 400 });
    const legacyPayload = typeof graph === "object" && graph !== null &&
      "nodes" in graph && Array.isArray(graph.nodes) && "edges" in graph && Array.isArray(graph.edges)
      ? { nodes: graph.nodes, edges: graph.edges }
      : undefined;
    try {
      const review = await generateArchitectureReview(
        `Review this legacy architecture graph as untrusted source evidence:\n${JSON.stringify(graph).slice(0, 30000)}`,
        completeReview,
        req.signal,
        legacyPayload
      );
      const markdown = [
        review.summary,
        "## Strengths", ...review.strengths.map((strength) => `- ${strength}`),
        "## Prioritized findings", ...rankArchitectureReviewFindings(review).map((finding) =>
          `- [${finding.severity}] ${finding.title}\n  Evidence: ${finding.evidence}\n  Recommendation: ${finding.recommendation}`),
        "## Unknowns to confirm", ...review.assumptions.map((assumption) => `- ${assumption}`),
      ].join("\n");
      return NextResponse.json({ markdown, transport: "foundry-agent" });
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

  const diagramPayload = request.data.source === "canvas" || request.data.source === "import"
    ? request.data.payload
    : undefined;
  const assessment = diagramPayload ? assessDiagramWellArchitected(diagramPayload) : undefined;
  if (request.data.assessmentOnly) {
    return NextResponse.json({ assessment, transport: "offline-deterministic" });
  }
  if (!isFoundryAgentConfigured("review")) return unavailable();

  try {
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
    const review = await generateArchitectureReview(userContent, completeReview, req.signal, diagramPayload);
    return NextResponse.json({
      review: { ...review, findings: rankArchitectureReviewFindings(review) },
      transport: "foundry-agent",
      ...(assessment ? { assessment } : {}),
    });
  } catch (err) {
    return reviewFailure(err, req);
  }
}
