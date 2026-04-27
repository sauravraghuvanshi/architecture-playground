/**
 * POST /api/ai/image
 *   { prompt: string, size?: "1024x1024"|"1792x1024"|"1024x1792" }
 *   → { url: string }
 *
 * Generates an image via Azure OpenAI's DALL-E 3 deployment.
 * Returns 503 when the dedicated image deployment env vars are not set.
 *
 * Why a separate env var (AZURE_OPENAI_IMAGE_DEPLOYMENT)? DALL-E 3 ships
 * as its own deployment in Azure OpenAI, distinct from the chat/completions
 * model used by /api/ai/generate. We don't want a missing image deployment
 * to silently fall through to the chat one.
 */
import { NextResponse } from "next/server";
import { aiRateLimit } from "@/lib/ai-rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function imageConfigured(): boolean {
  return !!(
    process.env.AZURE_OPENAI_ENDPOINT &&
    process.env.AZURE_OPENAI_API_KEY &&
    process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT
  );
}

export async function POST(req: Request) {
  if (!imageConfigured()) {
    return NextResponse.json(
      { error: "Image generation not configured. Set AZURE_OPENAI_IMAGE_DEPLOYMENT." },
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
  let size = "1024x1024";
  try {
    const body = (await req.json()) as { prompt?: string; size?: string };
    prompt = (body.prompt || "").trim();
    if (body.size === "1792x1024" || body.size === "1024x1792") size = body.size;
  } catch { /* empty body */ }
  if (!prompt) return NextResponse.json({ error: "Missing 'prompt'" }, { status: 400 });
  if (prompt.length > 1000) return NextResponse.json({ error: "Prompt too long" }, { status: 400 });

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT!.replace(/\/$/, "");
  const deployment = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT!;
  const apiVersion = process.env.AZURE_OPENAI_IMAGE_API_VERSION ?? "2024-02-01";
  const url = `${endpoint}/openai/deployments/${deployment}/images/generations?api-version=${apiVersion}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.AZURE_OPENAI_API_KEY!,
      },
      body: JSON.stringify({ prompt, size, n: 1 }),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Image API ${res.status}: ${text.slice(0, 200)}` }, { status: 502 });
    }
    const j = (await res.json()) as { data?: Array<{ url?: string; b64_json?: string }> };
    const first = j.data?.[0];
    if (!first?.url) return NextResponse.json({ error: "Model returned no image URL" }, { status: 502 });
    return NextResponse.json({ url: first.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Image request failed" },
      { status: 502 }
    );
  }
}
