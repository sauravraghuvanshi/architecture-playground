import { NextResponse } from "next/server";
import { aiRateLimit } from "@/lib/ai-rate-limit";
import { readBoundedJson, RequestBodyError } from "@/lib/request-json";
import { parseArchitectureDocument } from "@/lib/architecture-document";
import { FoundryAgentError, invokeFoundryAgent, isFoundryAgentConfigured } from "@/lib/foundry-agent";
import { DeploymentDraftError, deploymentRequestSchema, generateDeploymentDraft } from "@/lib/deployment-assistance";
import { deploymentTargetKind } from "@/lib/engineering-coverage";
import { preflightEngineeringParser, validateEngineeringArtifact } from "@/lib/engineering-validation";
import { ArtifactParserError } from "@/lib/artifact-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isFoundryAgentConfigured("deployment")) {
    return NextResponse.json({ error: "The deployment Foundry agent is not configured. Configure AZURE_AI_PROJECT_ENDPOINT and AZURE_AI_DEPLOY_AGENT_NAME, or explicitly select offline export." }, { status: 503 });
  }
  const rate = aiRateLimit(request);
  if (!rate.ok) return NextResponse.json({ error: "Rate limit exceeded", retryAfter: rate.retryAfterSec }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } });
  let raw: unknown;
  try {
    raw = await readBoundedJson(request, 1_000_000);
  } catch (error) {
    if (!(error instanceof RequestBodyError)) throw error;
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const input = deploymentRequestSchema.safeParse(raw);
  if (!input.success) return NextResponse.json({ error: "Invalid deployment generation request." }, { status: 400 });
  let payload;
  try {
    payload = parseArchitectureDocument(input.data.payload);
  } catch {
    return NextResponse.json({ error: "Invalid architecture evidence." }, { status: 400 });
  }
  if (!payload.nodes.some(deploymentTargetKind)) {
    return NextResponse.json({ error: "Add a supported canonical Azure service before generating deployment code. Generic shapes and unsupported providers/products are not provisionable mappings." }, { status: 400 });
  }
  try {
    await preflightEngineeringParser(input.data.format, request.signal);
    return NextResponse.json(await generateDeploymentDraft(
      payload, input.data.format, input.data.context,
      (instructions, evidence, signal) => invokeFoundryAgent("deployment", instructions, evidence, signal),
      request.signal,
      validateEngineeringArtifact,
    ));
  } catch (error) {
    if (request.signal.aborted) return NextResponse.json({ error: "Deployment draft request cancelled." }, { status: 499 });
    if (error instanceof DeploymentDraftError) return NextResponse.json({
      error: error.message, diagnostics: error.diagnostics,
    }, { status: error.status });
    if (error instanceof FoundryAgentError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ArtifactParserError) return NextResponse.json({ error: error.message }, { status: error.code === "cancelled" ? 499 : 503 });
    return NextResponse.json({ error: "Deployment agent request failed. Nothing was published or executed." }, { status: 502 });
  }
}
