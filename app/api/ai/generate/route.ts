/**
 * POST /api/ai/generate
 *   { prompt: string, mode?: AiMode, businessConstraints?: BusinessConstraints }
 *   → { graph: <mode-specific payload>, mode, designAssistance?: DesignAssistance }
 *
 * When `mode` is omitted (or "architecture"), returns a PlaygroundGraph
 * (legacy shape) so the architecture canvas's existing prompt path keeps
 * working. For any other mode, returns the mode's native payload shape;
 * the workspace hydrates its canvas directly from `graph`.
 */
import { NextResponse } from "next/server";
import { chatComplete, aiConfigured } from "@/lib/ai";
import { aiRateLimit } from "@/lib/ai-rate-limit";
import {
  MODE_PROMPTS, validateModeOutput, generationRequestSchema,
  buildGenerationUserPrompt, generateGuidedArchitecture,
} from "@/lib/ai-mode-prompts";
import { readBoundedJson, RequestBodyError } from "@/lib/request-json";
import manifest from "@/content/cloud-icons.json";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  let body: unknown;
  try {
    body = await readBoundedJson(req, 32_768);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  const input = generationRequestSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ error: input.error.issues[0]?.message ?? "Invalid generation request" }, { status: 400 });
  }
  const { mode } = input.data;

  try {
    if (mode === "architecture") {
      return NextResponse.json({
        ...await generateGuidedArchitecture(input.data, manifest.icons, chatComplete, req.signal),
        mode,
      });
    }
    const raw = await chatComplete(
      [
        { role: "system", content: MODE_PROMPTS[mode] },
        { role: "user", content: buildGenerationUserPrompt(input.data) },
      ],
      { temperature: 0.4, maxTokens: 2000, responseFormat: "json_object", signal: req.signal }
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Model returned non-JSON output" }, { status: 502 });
    }
    const err = validateModeOutput(mode, parsed);
    if (err) {
      return NextResponse.json({ error: `Schema validation: ${err}` }, { status: 502 });
    }
    return NextResponse.json({ graph: parsed, mode });
  } catch (err) {
    console.error("AI generation failed", err instanceof Error ? err.name : "Unknown error");
    return NextResponse.json(
      { error: "AI request failed. Please try again." },
      { status: 502 }
    );
  }
}
