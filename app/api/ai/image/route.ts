/**
 * POST /api/ai/image
 *   { prompt, size?, style?, canvas?: { theme, backgroundColor, foregroundColor } }
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
 *   'data: {"type":"result","b64":"...","mimeType":"image/png","size":...}\n\n'
 *   'data: {"type":"error","code":"upstream","message":"...","status":502}\n\n'
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
import { buildImagePrompt, imageRequestSchema } from "@/lib/image-styles";
import { readBoundedJson, RequestBodyError } from "@/lib/request-json";
import { IMAGE_RESPONSE_MAX_BYTES, imageFailureCode, imageFailureMessage, type ImageErrorCode } from "@/lib/ai-image-events";
import { validateEvidenceImage } from "@/lib/review-image-server";
import { EvidenceImageValidationError } from "@/lib/review-image";
import {
  getImageAiConfig,
  getImageAiProxyBaseUrl,
} from "@/lib/ai-image-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const HEARTBEAT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 270_000; // 4m30s — generous upper bound for gpt-image-2

function sseStream(producer: (
  send: (data: object) => void,
  fail: (code: ImageErrorCode, status?: number) => void,
  signal: AbortSignal,
) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const cancelled = new AbortController();
  let cancel = () => cancelled.abort();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
          cancelled.abort();
        }
      };
      const heartbeat = setInterval(() => safeEnqueue(`: hb ${Date.now()}\n\n`), HEARTBEAT_MS);
      const send = (data: object) => safeEnqueue(`data: ${JSON.stringify(data)}\n\n`);
      const fail = (code: ImageErrorCode, status = 502) => send({ type: "error", code, message: imageFailureMessage(code), status });
      cancel = () => { closed = true; clearInterval(heartbeat); cancelled.abort(); };

      send({ type: "started", elapsed: 0 });
      void producer(send, fail, cancelled.signal).catch(() => {
        if (!cancelled.signal.aborted) fail("upstream");
      }).finally(() => {
        clearInterval(heartbeat);
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      cancel();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "Connection": "keep-alive",
      // Disable buffering on Azure App Service / nginx-style proxies.
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(req: Request) {
  if (req.signal.aborted) return NextResponse.json({ error: "Image request cancelled." }, { status: 499 });
  const rate = aiRateLimit(req);
  if (!rate.ok) {
    return NextResponse.json({ error: "Rate limit exceeded", retryAfter: rate.retryAfterSec }, {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSec) },
    });
  }

  let body: unknown;
  try {
    body = await readBoundedJson(req, 16_000);
  } catch (error) {
    if (!(error instanceof RequestBodyError)) throw error;
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const parsed = imageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { size, canvas } = parsed.data;
  const prompt = buildImagePrompt(parsed.data);

  const config = getImageAiConfig();
  if (!config) {
    const proxyBaseUrl = getImageAiProxyBaseUrl();
    if (!proxyBaseUrl) {
      return NextResponse.json(
        {
          error:
            "Image generation not configured. Set AZURE_OPENAI_IMAGE_DEPLOYMENT (and optionally AZURE_OPENAI_IMAGE_ENDPOINT / AZURE_OPENAI_IMAGE_API_KEY).",
        },
        { status: 503 }
      );
    }
    if (new URL(req.url).origin === proxyBaseUrl) return NextResponse.json({
      error: "Image proxy points to this application. Configure a distinct approved destination; no request was forwarded.",
    }, { status: 503 });
    if (req.headers.get("x-diagrammatic-image-proxy") === "1") return NextResponse.json({
      error: "Chained image proxying is not supported. Configure the approved provider on the proxy host.",
    }, { status: 503 });
    try {
      const upstream = await fetch(`${proxyBaseUrl}/api/ai/image`, {
        method: "POST",
        redirect: "error",
        headers: { "Content-Type": "application/json", "X-Diagrammatic-Image-Proxy": "1" },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.any([req.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
      });
      const headers = new Headers();
      for (const name of [
        "content-type",
        "cache-control",
        "connection",
        "x-accel-buffering",
        "retry-after",
      ]) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
      }
      return new Response(upstream.body, {
        status: upstream.status,
        headers,
      });
    } catch (cause) {
      if (req.signal.aborted) return NextResponse.json({ error: "Image request cancelled." }, { status: 499 });
      const code = cause instanceof Error && cause.name === "TimeoutError" ? "timeout" : "upstream";
      return NextResponse.json(
        {
          error: imageFailureMessage(code), code,
        },
        { status: code === "timeout" ? 504 : 502 }
      );
    }
  }

  const url = `${config.endpoint}/openai/v1/images/generations`;

  return sseStream(async (send, fail, signal) => {
    const t0 = Date.now();
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`,
          "api-key": config.apiKey,
        },
        body: JSON.stringify({ model: config.deployment, prompt, size, n: 1 }),
        signal: AbortSignal.any([controller.signal, req.signal, signal]),
      });
      if (!res.ok) {
        let code = imageFailureCode(res.status);
        if (res.status === 400 || res.status === 403) {
          try {
            const error: unknown = await readBoundedJson(res, 16_000);
            if (error && typeof error === "object" && "error" in error && error.error &&
              typeof error.error === "object" && "code" in error.error &&
              typeof error.error.code === "string" &&
              ["contentfilter", "content_policy_violation", "responsibleaipolicyviolation"].includes(error.error.code.toLowerCase())) {
              code = "refused";
            } else await res.body?.cancel();
          } catch (cause) {
            if (!(cause instanceof RequestBodyError)) throw cause;
            // Preserve the explicit upstream failure even when its error body is malformed.
          }
        }
        fail(code, res.status);
        return;
      }
      const json = await readBoundedJson(res, IMAGE_RESPONSE_MAX_BYTES);
      const data: unknown = json && typeof json === "object" && "data" in json ? json.data : undefined;
      const first: unknown = Array.isArray(data) && data.length === 1 ? data[0] : undefined;
      if (!first || typeof first !== "object" || !("b64_json" in first) || typeof first.b64_json !== "string") {
        fail("invalid_output");
        return;
      }
      const b64 = first.b64_json;
      const prefix = Buffer.from(b64.slice(0, 24), "base64");
      const mimeType = prefix[0] === 0x89 && prefix[1] === 0x50 ? "image/png"
        : prefix[0] === 0xff && prefix[1] === 0xd8 ? "image/jpeg" : "image/webp";
      await validateEvidenceImage({ name: "generated-image", mimeType, dataUrl: `data:${mimeType};base64,${b64}` });
      if (req.signal.aborted || signal.aborted) return;
      if (controller.signal.aborted) { fail("timeout", 504); return; }
      const elapsed = Math.round((Date.now() - t0) / 1000);
      send({ type: "result", b64, mimeType, size, elapsed, canvas });
    } catch (err) {
      if (req.signal.aborted || signal.aborted) return;
      const code = controller.signal.aborted ? "timeout"
        : err instanceof RequestBodyError || err instanceof EvidenceImageValidationError ? "invalid_output" : "upstream";
      fail(code, code === "timeout" ? 504 : 502);
    } finally {
      clearTimeout(abortTimer);
    }
  });
}
