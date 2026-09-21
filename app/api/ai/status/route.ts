import { NextResponse } from "next/server";
import { aiConfigured } from "@/lib/ai";
import { isFoundryAgentConfigured } from "@/lib/foundry-agent";
import {
  getImageAiProxyBaseUrl,
  imageAiConfigured,
} from "@/lib/ai-image-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const diagramConfigured = aiConfigured();
  const imageLocal = imageAiConfigured();
  const imageProxy = getImageAiProxyBaseUrl();
  const imageConfigured = imageLocal || !!imageProxy;
  const reviewAgentConfigured = isFoundryAgentConfigured("review");
  const deploymentAgentConfigured = isFoundryAgentConfigured("deployment");
  return NextResponse.json({
    configured: diagramConfigured || imageConfigured || reviewAgentConfigured || deploymentAgentConfigured,
    diagramConfigured,
    imageConfigured,
    imageSource: imageLocal ? "local" : imageProxy ? "configured-proxy" : null,
    architectureImageReview: true,
    reviewAgentConfigured,
    deploymentAgentConfigured,
  });
}
