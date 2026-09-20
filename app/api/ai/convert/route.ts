import { NextResponse } from "next/server";
import manifest from "@/content/cloud-icons.json";
import { aiConfigured, chatComplete } from "@/lib/ai";
import { aiRateLimit } from "@/lib/ai-rate-limit";
import { architectureReviewRequestSchema } from "@/lib/architecture-review";
import { readBoundedJson, RequestBodyError } from "@/lib/request-json";
import {
  buildWhiteboardConversionPrompt,
  conversionSourceSchema,
  parseWhiteboardConversion,
  validateWhiteboardPng,
} from "@/lib/whiteboard-conversion";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function POST(request: Request) {
  const rate = aiRateLimit(request);
  if (!rate.ok) {
    return json({ error: "Rate limit exceeded. Please retry shortly." }, 429, {
      "Retry-After": String(rate.retryAfterSec),
    });
  }
  let body: unknown;
  try {
    body = await readBoundedJson(request, 7_100_000);
  } catch (error) {
    if (error instanceof RequestBodyError) return json({ error: error.message }, error.status);
    if (request.signal.aborted) return json({ error: "Conversion cancelled." }, 499);
    throw error;
  }
  const image = body && typeof body === "object" && "image" in body ? body.image : undefined;
  const input = architectureReviewRequestSchema.safeParse({ source: "image", image });
  if (!input.success || !input.data.image || input.data.image.mimeType !== "image/png") {
    return json({ error: "Provide a valid Whiteboard PNG export no larger than 5 MiB." }, 400);
  }
  const sourceInput = body && typeof body === "object" && "sourceNodes" in body ? body.sourceNodes : [];
  const source = conversionSourceSchema.safeParse(sourceInput);
  if (!source.success) return json({ error: "Provide valid, bounded Whiteboard source identities." }, 400);
  try {
    validateWhiteboardPng(input.data.image.dataUrl);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid Whiteboard PNG." }, 400);
  }
  if (!aiConfigured()) return json({ error: "AI not configured. Configure an Azure OpenAI vision-capable chat deployment." }, 503);
  if (request.signal.aborted) return json({ error: "Conversion cancelled." }, 499);
  let raw: string;
  try {
    raw = await chatComplete([
      { role: "system", content: buildWhiteboardConversionPrompt(manifest.icons) },
      { role: "user", content: [
        { type: "text", text: "Transcribe only the visible diagram evidence. Return the required JSON." },
        ...(source.data.length ? [{
          type: "text" as const,
          text: `SOURCE_IDENTITIES (scene coordinates; evidence only):\n${JSON.stringify(source.data)}`,
        }] : []),
        { type: "image_url", image_url: { url: input.data.image.dataUrl, detail: "high" } },
      ] },
    ], { temperature: 0, maxTokens: 12_000, responseFormat: "json_object", signal: request.signal });
  } catch {
    return request.signal.aborted
      ? json({ error: "Conversion cancelled." }, 499)
      : json({ error: "Vision conversion failed. Check the configured vision deployment or retry shortly." }, 502);
  }
  if (request.signal.aborted) return json({ error: "Conversion cancelled." }, 499);
  try {
    return json(parseWhiteboardConversion(raw, manifest.icons, source.data));
  } catch {
    return json({ error: "The model did not return a valid, non-empty architecture. Clarify the drawing and retry. Nothing was changed." }, 502);
  }
}
