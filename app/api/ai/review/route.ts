/**
 * POST /api/ai/review
 *   { graph: PlaygroundGraph }
 *   → { markdown: string }
 *
 * Returns a markdown review of the diagram against the Azure Well-Architected
 * Framework pillars (Reliability, Security, Cost, Operational Excellence,
 * Performance Efficiency) plus AWS/GCP equivalents when relevant.
 */
import { NextResponse } from "next/server";
import { chatComplete, aiConfigured } from "@/lib/ai";
import { aiRateLimit } from "@/lib/ai-rate-limit";
import {
  ARCHITECTURE_REVIEW_SYSTEM_PROMPT,
  architectureReviewRequestSchema,
  buildArchitectureReviewPrompt,
  parseArchitectureReview,
} from "@/lib/architecture-review";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a cloud Well-Architected reviewer.
The user will paste a JSON diagram. Produce concise markdown:

## Strengths
- Bulleted list, max 5

## Risks
- Bulleted list, max 7. Tag each with a pillar in brackets, e.g. [Security], [Reliability], [Cost], [Operational Excellence], [Performance].

## Recommendations
- Numbered, prioritized, max 5 actionable changes.

Be specific. Reference services by their labels. No filler.`;

export async function POST(req: Request) {
  if (!aiConfigured()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }
  const rate = aiRateLimit(req);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rate.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "graph" in body &&
    !("source" in body)
  ) {
    const graph = (body as { graph?: unknown }).graph;
    if (!graph) return NextResponse.json({ error: "Missing 'graph'" }, { status: 400 });
    try {
      const markdown = await chatComplete(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(graph).slice(0, 30000) },
        ],
        { temperature: 0.3, maxTokens: 1500 }
      );
      return NextResponse.json({ markdown });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "AI request failed" },
        { status: 502 }
      );
    }
  }

  const request = architectureReviewRequestSchema.safeParse(body);
  if (!request.success) {
    return NextResponse.json(
      { error: request.error.issues[0]?.message ?? "Invalid review request" },
      { status: 400 }
    );
  }

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
    const raw = await chatComplete(
      [
        { role: "system", content: ARCHITECTURE_REVIEW_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      { temperature: 0.2, maxTokens: 4000, responseFormat: "json_object" }
    );
    const review = parseArchitectureReview(raw);
    return NextResponse.json({ review });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? request.data.source === "image" && /Azure OpenAI 4\d\d/.test(err.message)
              ? "Architecture image review requires a vision-enabled Azure OpenAI deployment."
              : `Architecture review failed: ${err.message}`
            : "Architecture review failed",
      },
      { status: 502 }
    );
  }
}
