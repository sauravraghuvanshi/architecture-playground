import { NextResponse } from "next/server";
import { z } from "zod";
import { aiRateLimit } from "@/lib/ai-rate-limit";
import { readBoundedJson, RequestBodyError } from "@/lib/request-json";
import { parseArchitectureDocument } from "@/lib/architecture-document";
import { engineeringArtifactInputSchema, parseDeploymentDraft } from "@/lib/deployment-assistance";
import { validateEngineeringArtifact } from "@/lib/engineering-validation";
import { ArtifactParserError } from "@/lib/artifact-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const inputSchema = z.object({ payload: z.unknown(), artifact: engineeringArtifactInputSchema }).strict();

export async function POST(request: Request) {
  const rate = aiRateLimit(request);
  if (!rate.ok) return NextResponse.json({ error: "Rate limit exceeded", retryAfter: rate.retryAfterSec }, {
    status: 429, headers: { "Retry-After": String(rate.retryAfterSec) },
  });
  let payload;
  let draft;
  try {
    const input = inputSchema.parse(await readBoundedJson(request, 1_000_000));
    payload = parseArchitectureDocument(input.payload);
    draft = parseDeploymentDraft({
      ...input.artifact, warnings: [], assumptions: ["Explicit static validation; no model or infrastructure invoked."],
    }, payload, input.artifact.format);
  } catch (cause) {
    if (cause instanceof RequestBodyError) return NextResponse.json({ error: cause.message }, { status: cause.status });
    if (cause instanceof Error) return NextResponse.json({ error: "Invalid or unsupported artifact/evidence. Nothing was executed or published." }, { status: 400 });
    throw cause;
  }
  try {
    const validation = await validateEngineeringArtifact(draft, payload, request.signal);
    return NextResponse.json({ validation }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof ArtifactParserError) return NextResponse.json({ error: cause.message, code: cause.code }, { status: cause.code === "cancelled" ? 499 : 503 });
    return NextResponse.json({ error: "Artifact validation failed unexpectedly. Nothing was executed or published." }, { status: 502 });
  }
}
