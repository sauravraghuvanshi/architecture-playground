/**
 * POST /api/ai/image
 *   { prompt: string, size?: "1024x1024"|"1024x1536"|"1536x1024" }
 *
 * Generates an image via Azure OpenAI's gpt-image-2 deployment.
 *
 * RESPONSE FORMAT — Server-Sent Events (text/event-stream)
 * --------------------------------------------------------
 * gpt-image-2 takes ~3–4 minutes to return one image, which exceeds the
 * Azure App Service front-end LB's ~230s idle timeout. To survive that,
 * the route streams SSE messages: a comment-style heartbeat every 15s
 * keeps the connection alive, and the final result is emitted as a JSON
 * `data:` payload.
 *
 * Event protocol:
 *   ': hb 15\n\n'                                     ← every 15s while waiting
 *   'data: {"type":"started","elapsed":0}\n\n'        ← once at start
 *   'data: {"type":"result","b64":"...","size":...}\n\n' ← on success, then close
 *   'data: {"type":"error","message":"...","status":502}\n\n' ← on failure, then close
 *
 * Image generation is hosted on a dedicated Azure AI Services account
 * separate from the chat/completions resource (different region, different
 * quota pool). Env vars:
 *
 *   AZURE_OPENAI_IMAGE_ENDPOINT      → e.g. https://ap-img-generator.openai.azure.com
 *   AZURE_OPENAI_IMAGE_API_KEY       → key for the image account
 *   AZURE_OPENAI_IMAGE_DEPLOYMENT    → deployment name (e.g. gpt-image-2),
 *                                      passed as `model` in the request body
 *
 * If *_IMAGE_ENDPOINT / *_IMAGE_API_KEY are not set, falls back to
 * AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY (single-resource case).
 *
 * The endpoint is called via the OpenAI-compatible v1 path
 * `${endpoint}/openai/v1/images/generations` (no api-version query
 * parameter, deployment passed as `model`). Both `Authorization: Bearer`
 * and `api-key` headers are sent for compatibility.
 *
 * Returns 503 when no image deployment is configured at all.
 */
import { NextResponse } from "next/server";
import { aiRateLimit } from "@/lib/ai-rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const HEARTBEAT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 270_000; // 4m30s — generous upper bound for gpt-image-2

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

function sseStream(producer: (
  send: (data: object) => void,
  fail: (message: string, status?: number) => void,
) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // controller already closed (client disconnect)
        }
      };
      const heartbeat = setInterval(() => safeEnqueue(`: hb ${Date.now()}\n\n`), HEARTBEAT_MS);
      const send = (data: object) => safeEnqueue(`data: ${JSON.stringify(data)}\n\n`);
      const fail = (message: string, status = 502) => send({ type: "error", message, status });

      send({ type: "started", elapsed: 0 });
      try {
        await producer(send, fail);
      } catch (err) {
        fail(err instanceof Error ? err.message : "Unknown error");
      } finally {
        clearInterval(heartbeat);
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      // Disable buffering on Azure App Service / nginx-style proxies.
      "X-Accel-Buffering": "no",
    },
  });
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
  const key = imageKey()!;
  const url = `${endpoint}/openai/v1/images/generations`;

  return sseStream(async (send, fail) => {
    const t0 = Date.now();
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
          "api-key": key,
        },
        body: JSON.stringify({ model: deployment, prompt, size, n: 1 }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        fail(`Image API ${res.status}: ${text.slice(0, 200)}`, 502);
        return;
      }
      const j = (await res.json()) as { data?: Array<{ url?: string; b64_json?: string }> };
      const first = j.data?.[0];
      if (!first) {
        fail("Model returned no image", 502);
        return;
      }
      const elapsed = Math.round((Date.now() - t0) / 1000);
      if (first.b64_json) {
        send({ type: "result", b64: first.b64_json, size, elapsed });
      } else if (first.url) {
        send({ type: "result", url: first.url, size, elapsed });
      } else {
        fail("Model returned no image data", 502);
      }
    } catch (err) {
      const message = err instanceof Error
        ? (err.name === "AbortError" ? `Image request timed out after ${REQUEST_TIMEOUT_MS / 1000}s` : err.message)
        : "Image request failed";
      fail(message, 504);
    } finally {
      clearTimeout(abortTimer);
    }
  });
}
