import { configuredAiOrigin } from "./ai-destination.ts";

export interface ImageAiConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
}

export function getImageAiConfig(): ImageAiConfig | null {
  const endpoint = configuredAiOrigin(
    process.env.AZURE_OPENAI_IMAGE_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT
  );
  const apiKey = (
    process.env.AZURE_OPENAI_IMAGE_API_KEY || process.env.AZURE_OPENAI_API_KEY
  )?.trim();
  const deployment = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT?.trim();
  if (!endpoint || !apiKey || !deployment) return null;
  return {
    endpoint,
    apiKey,
    deployment,
  };
}

export function imageAiConfigured(): boolean {
  return getImageAiConfig() !== null;
}

/** Remote image proxying always requires an explicitly configured origin. */
export function getImageAiProxyBaseUrl(): string | null {
  const configured = process.env.DIAGRAMMATIC_AI_PROXY_URL?.trim();
  if (
    configured &&
    ["off", "disabled", "none"].includes(configured.toLowerCase())
  ) {
    return null;
  }
  return configuredAiOrigin(configured);
}
