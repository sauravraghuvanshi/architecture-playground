/**
 * POST /api/ai/image
 *   { prompt: string, size?: "1024x1024"|"1024x1536"|"1536x1024" }
 *   → { url?: string, b64?: string }
 *
 * Generates an image via Azure OpenAI's gpt-image-2 deployment.
 *
 * Image generation is hosted on a dedicated Azure AI Services account
 * separate from the chat/completions resource (different region, different
 * quota pool). We therefore prefer dedicated env vars and only fall back to
 * the chat ones for single-resource setups:
 *
 *   AZURE_OPENAI_IMAGE_ENDPOINT      → endpoint of the image account
 *   AZURE_OPENAI_IMAGE_API_KEY       → key for the image account
 *   AZURE_OPENAI_IMAGE_DEPLOYMENT    → deployment name (e.g. gpt-image-2)
 *   AZURE_OPENAI_IMAGE_API_VERSION   → optional, defaults to 2025-04-01-preview
 *
 * If *_IMAGE_ENDPOINT / *_IMAGE_API_KEY are not set, falls back to
 * AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY (single-resource case).
 *
 * Returns 503 when no image deployment is configured at all.
 */
import { NextResponse } from "next/server";
import { aiRateLimit } from "@/lib/ai-rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function imageEndpoint(): string | null {
  return (
    process.env.AZURE_OPENAI_IMAGE_ENDPOINT ||
    process.env.AZURE_OPENAI_ENDPOINT ||
    null
  );
}
function imageKey(): string | null {
  return (
    process.env.AZURE_OPENAI_IMAGE_API_KEY ||
    process.env.AZURE_OPENAI_API_KEY ||
    null
  );
}
function imageConfigured(): boolean {
  return !!(imageEndpoint() && imageKey() && process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT);
}

export async function POST(req: Request) {
  if (!imageConfigured()) {
    return NextResponse.json(
      { error: "Image generation not configured. Set AZURE_OPENAI_IMAGE_DEPLOYMENT (and optionally AZURE_OPENAI_IMAGE_ENDPOINT / AZURE_OPENAI_IMAGE_API_KEY)." },
      { status: 503 }
    );
  }
  const rate = aiRateLimit(req);
  if (!rate.ok) {
    return NextResponse.json({ error: "Rate limit exceeded", retryAfter: rate.retryAfterSec }, {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSec) },
    });
  }

  let prompt = "";
  let size: "1024x1024" | "1024x1536" | "1536x1024" = "1024x1024";
  try {
    const body = (await req.json()) as { prompt?: string; size?: string };
    prompt = (body.prompt || "").trim();
    if (body.size === "1024x1536" || body.size === "1536x1024") size = body.size;
  } catch { /* empty body */ }
  if (!prompt) return NextResponse.json({ error: "Missing 'prompt'" }, { status: 400 });
  if (prompt.length > 1000) return NextResponse.json({ error: "Prompt too long" }, { status: 400 });

  const endpoint = imageEndpoint()!.replace(/\/$/, "");
  const deployment = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT!;
  const apiVersion = process.env.AZURE_OPENAI_IMAGE_API_VERSION ?? "2025-04-01-preview";
  const url = `${endpoint}/openai/deployments/${deployment}/images/generations?api-version=${apiVersion}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": imageKey()!,
      },
      // gpt-image-2 returns base64 by default; n=1 keeps cost predictable.
      body: JSON.stringify({ prompt, size, n: 1 }),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Image API ${res.status}: ${text.slice(0, 200)}` }, { status: 502 });
    }
    const j = (await res.json()) as { data?: Array<{ url?: string; b64_json?: string }> };
    const first = j.data?.[0];
    if (!first) return NextResponse.json({ error: "Model returned no image" }, { status: 502 });
    if (first.url) return NextResponse.json({ url: first.url });
    if (first.b64_json) return NextResponse.json({ b64: first.b64_json });
    return NextResponse.json({ error: "Model returned no image data" }, { status: 502 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Image request failed" },
      { status: 502 }
    );
  }
}
