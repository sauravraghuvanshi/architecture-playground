/**
 * POST /api/ai/generate
 *   { prompt: string, mode?: "architecture"|"flowchart"|"mindmap"|"sequence"|"er"|"uml"|"c4"|"kanban" }
 *   → { graph: <mode-specific payload> }
 *
 * When `mode` is omitted (or "architecture"), returns a PlaygroundGraph
 * (legacy shape) so the architecture canvas's existing prompt path keeps
 * working. For any other mode, returns the mode's native payload shape;
 * the workspace hydrates its canvas directly from `graph`.
 */
import { NextResponse } from "next/server";
import { chatComplete, aiConfigured } from "@/lib/ai";
import { aiRateLimit } from "@/lib/ai-rate-limit";
import { MODE_PROMPTS, validateModeOutput, type AiMode } from "@/lib/ai-mode-prompts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_MODES: AiMode[] = ["architecture", "flowchart", "mindmap", "sequence", "er", "uml", "c4", "kanban"];

export async function POST(req: Request) {
  if (!aiConfigured()) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }
  const rate = aiRateLimit(req);
  if (!rate.ok) {
    return NextResponse.json({ error: "Rate limit exceeded", retryAfter: rate.retryAfterSec }, {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSec) },
    });
  }
  let prompt = "";
  let mode: AiMode = "architecture";
  try {
    const body = (await req.json()) as { prompt?: string; mode?: string };
    prompt = (body.prompt || "").trim();
    if (body.mode && (VALID_MODES as string[]).includes(body.mode)) {
      mode = body.mode as AiMode;
    }
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
        { role: "system", content: MODE_PROMPTS[mode] },
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
    const err = validateModeOutput(mode, parsed);
    if (err) {
      return NextResponse.json({ error: `Schema validation: ${err}` }, { status: 502 });
    }
    return NextResponse.json({ graph: parsed, mode });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI request failed" },
      { status: 502 }
    );
  }
}
