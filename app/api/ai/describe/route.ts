/**
 * POST /api/ai/describe
 *   { graph: PlaygroundGraph }
 *   → { markdown: string }
 *
 * Returns a markdown explanation of the diagram aimed at an engineering
 * audience: components, data flows, and notable patterns.
 */
import { NextResponse } from "next/server";
import { chatComplete, aiConfigured } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a senior cloud architect.
The user will paste a JSON diagram (nodes + edges, typed by iconId).
Return concise markdown with three sections:

## Components
- Bullet list, one per service node.

## Data flows
- Numbered list of flows in topological order.

## Notes
- Patterns, scalability/security observations, gaps.

Be specific; reference services by their labels. Do not echo the JSON.`;

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
      { temperature: 0.2, maxTokens: 1500 }
    );
    return NextResponse.json({ markdown });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI request failed" },
      { status: 502 }
    );
  }
}
