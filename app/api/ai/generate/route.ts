/**
 * POST /api/ai/generate
 *   { prompt: string }
 *   → { graph: PlaygroundGraph }
 *
 * Generates a starter diagram from a natural-language prompt. The model is
 * instructed to return strict JSON matching the PlaygroundGraph shape. The
 * response is then JSON-parsed and lightly validated. If parsing fails or
 * the AI is not configured, returns a structured error.
 */
import { NextResponse } from "next/server";
import { chatComplete, aiConfigured } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are an expert cloud architect. Convert the user's
description into a JSON object with this exact shape:

{
  "metadata": { "name": "<short title>", "description": "<one sentence>" },
  "nodes": [
    { "id": "<unique>", "type": "service",
      "position": { "x": <number>, "y": <number> },
      "data": { "iconId": "<provider>/<category>/<slug>", "label": "<name>", "cloud": "azure"|"aws"|"gcp" } }
  ],
  "edges": [
    { "id": "<unique>", "source": "<nodeId>", "target": "<nodeId>",
      "data": { "label": "<short>", "connectionType": "data-flow", "lineStyle": "solid", "arrowStyle": "forward" } }
  ]
}

Rules:
- Use realistic iconIds like "azure/compute/app-service", "azure/databases/sql-database", "aws/compute/lambda", "gcp/compute/cloud-functions". Don't invent paths beyond a 3-segment provider/category/slug.
- Position nodes in a clear left-to-right flow with x spacing of 200 and y rows of 150.
- Return ONLY valid JSON. No prose, no markdown, no code fences.`;

export async function POST(req: Request) {
  if (!aiConfigured()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }
  let prompt = "";
  try {
    const body = (await req.json()) as { prompt?: string };
    prompt = (body.prompt || "").trim();
  } catch {
    /* empty body */
  }
  if (!prompt) {
    return NextResponse.json({ error: "Missing 'prompt'" }, { status: 400 });
  }
  if (prompt.length > 2000) {
    return NextResponse.json({ error: "Prompt too long (max 2000 chars)" }, { status: 400 });
  }

  try {
    const raw = await chatComplete(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      { temperature: 0.4, maxTokens: 2000, responseFormat: "json_object" }
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Model returned non-JSON output", raw }, { status: 502 });
    }
    const graph = parsed as { nodes?: unknown[]; edges?: unknown[] };
    if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      return NextResponse.json({ error: "Model output missing nodes/edges arrays" }, { status: 502 });
    }
    return NextResponse.json({ graph: parsed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI request failed" },
      { status: 502 }
    );
  }
}
