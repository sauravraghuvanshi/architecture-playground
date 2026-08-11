import { NextResponse } from "next/server";
import { aiConfigured } from "@/lib/ai";
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
  return NextResponse.json({
    configured: diagramConfigured || imageConfigured,
    diagramConfigured,
    imageConfigured,
    imageSource: imageLocal ? "local" : imageProxy ? "development-proxy" : null,
  });
}
