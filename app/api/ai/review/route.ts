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
  let body: { graph?: unknown };
  try {
    body = (await req.json()) as { graph?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.graph) return NextResponse.json({ error: "Missing 'graph'" }, { status: 400 });

  try {
    const markdown = await chatComplete(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(body.graph).slice(0, 30000) },
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
