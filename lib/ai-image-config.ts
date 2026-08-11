export interface ImageAiConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
}

export function getImageAiConfig(): ImageAiConfig | null {
  const endpoint = (
    process.env.AZURE_OPENAI_IMAGE_ENDPOINT || process.env.AZURE_OPENAI_ENDPOINT
  )?.trim();
  const apiKey = (
    process.env.AZURE_OPENAI_IMAGE_API_KEY || process.env.AZURE_OPENAI_API_KEY
  )?.trim();
  const deployment = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT?.trim();
  if (!endpoint || !apiKey || !deployment) return null;
  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    apiKey,
    deployment,
  };
}

export function imageAiConfigured(): boolean {
  return getImageAiConfig() !== null;
}

/**
 * Local development can reuse the configured production image route without
 * copying Azure credentials onto every developer machine. Production never
 * falls back implicitly, which prevents proxy loops and keeps deployment
 * configuration explicit.
 */
export function getImageAiProxyBaseUrl(): string | null {
  const configured = process.env.DIAGRAMMATIC_AI_PROXY_URL?.trim();
  if (
    configured &&
    ["off", "disabled", "none"].includes(configured.toLowerCase())
  ) {
    return null;
  }
  if (configured) return configured.replace(/\/+$/, "");
  return process.env.NODE_ENV === "development"
    ? "https://architecture-playground.azurewebsites.net"
    : null;
}
