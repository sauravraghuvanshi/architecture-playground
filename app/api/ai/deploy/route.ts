import { NextResponse } from "next/server";
import { aiRateLimit } from "@/lib/ai-rate-limit";
import { readBoundedJson, RequestBodyError } from "@/lib/request-json";
import { parseArchitectureDocument } from "@/lib/architecture-document";
import { FoundryAgentError, invokeFoundryAgent, isFoundryAgentConfigured } from "@/lib/foundry-agent";
import { DEPLOYMENT_AGENT_INSTRUCTIONS, deploymentRequestSchema, parseDeploymentDraft } from "@/lib/deployment-assistance";

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
  if (!payload.nodes.some((node) => node.kind !== "group")) {
    return NextResponse.json({ error: "Add workload nodes before generating deployment code." }, { status: 400 });
  }
  try {
    const output = await invokeFoundryAgent("deployment", DEPLOYMENT_AGENT_INSTRUCTIONS, JSON.stringify({
      format: input.data.format, context: input.data.context, diagram: payload,
    }), request.signal);
    try {
      return NextResponse.json(parseDeploymentDraft(JSON.parse(output), payload, input.data.format));
    } catch {
      return NextResponse.json({ error: "Foundry returned an invalid or unsupported deployment draft. Nothing was published or executed; refine the request and retry." }, { status: 502 });
    }
  } catch (error) {
    if (error instanceof FoundryAgentError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Deployment agent request failed. Nothing was published or executed." }, { status: 502 });
  }
}
