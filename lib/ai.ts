/**
 * Azure OpenAI client used by /api/ai/* routes.
 *
 * Configuration via environment variables:
 *   AZURE_OPENAI_ENDPOINT       https://<name>.openai.azure.com
 *   AZURE_OPENAI_API_KEY        <key>
 *   AZURE_OPENAI_DEPLOYMENT     deployment name (e.g. "gpt-4o")
 *   AZURE_OPENAI_API_VERSION    optional, defaults to "2024-10-21"
 *
 * If any required var is missing, `aiConfigured()` returns false and routes
 * respond 503 with `{ error: "AI not configured" }` so the UI can hide the
 * AI Assist controls gracefully.
 *
 * We deliberately avoid pulling in @azure/openai SDK to keep bundle small —
 * a single fetch call to the chat completions REST endpoint is enough.
 */

export interface AiConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
}

export function getAiConfig(): AiConfig | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT?.trim();
  if (!endpoint || !apiKey || !deployment) return null;
  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    apiKey,
    deployment,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION?.trim() || "2024-10-21",
  };
}

export function aiConfigured(): boolean {
  return getAiConfig() !== null;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json_object";
}

export async function chatComplete(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  const cfg = getAiConfig();
  if (!cfg) throw new Error("AI not configured");

  const url = `${cfg.endpoint}/openai/deployments/${encodeURIComponent(cfg.deployment)}/chat/completions?api-version=${cfg.apiVersion}`;
  const body: Record<string, unknown> = {
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 2000,
  };
  if (opts.responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "api-key": cfg.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure OpenAI ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? "";
}
