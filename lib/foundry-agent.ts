import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";

export type FoundryAgentPurpose = "review" | "deployment";
export type FoundryInputMessage = {
  role: "user";
  content: string | Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "auto" | "low" | "high" }
  >;
} | { role: "assistant"; content: string };
export type FoundryAgentInput = string | FoundryInputMessage[];

export const FOUNDRY_AGENT_TIMEOUT_MS = 120_000;
export class FoundryAgentError extends Error {
  readonly status: 502 | 503 | 504 | 499;
  constructor(message: string, status: 502 | 503 | 504 | 499) {
    super(message);
    this.name = "FoundryAgentError";
    this.status = status;
  }
}

function configuration(purpose: FoundryAgentPurpose) {
  const endpoint = process.env.AZURE_AI_PROJECT_ENDPOINT?.trim();
  const name = process.env[purpose === "review" ? "AZURE_AI_REVIEW_AGENT_NAME" : "AZURE_AI_DEPLOY_AGENT_NAME"]?.trim();
  if (!endpoint || !name || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(name)) return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
    (url.port && url.port !== "443") ||
    !/^[a-z0-9-]+\.services\.ai\.azure\.(com|us|cn)$/.test(url.hostname) ||
    !/^\/api\/projects\/[a-zA-Z0-9._-]+\/?$/.test(url.pathname)
  ) return null;
  return { endpoint: url.toString().replace(/\/$/, ""), name };
}

export function isFoundryAgentConfigured(purpose: FoundryAgentPurpose): boolean {
  return configuration(purpose) !== null;
}

export function foundryProjectOrigin(purpose: FoundryAgentPurpose): string | null {
  const config = configuration(purpose);
  return config ? new URL(config.endpoint).origin : null;
}

export async function invokeFoundryAgent(
  purpose: FoundryAgentPurpose,
  instructions: string,
  input: FoundryAgentInput,
  signal?: AbortSignal
): Promise<string> {
  const config = configuration(purpose);
  if (!config) throw new FoundryAgentError(`The ${purpose} Foundry agent is not configured. Set the project endpoint and role-specific agent name.`, 503);
  const timeout = AbortSignal.timeout(FOUNDRY_AGENT_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let onAbort: (() => void) | undefined;
  try {
    combined.throwIfAborted();
    const evidence = typeof input === "string" ? [{ role: "user" as const, content: input }] : input;
    // Named agents reject top-level instructions/text overrides. Their definition
    // owns JSON output; trusted app instructions remain separate from user evidence.
    const messages = [
      { type: "message" as const, role: "developer" as const, content: instructions },
      ...evidence.map((message) => ({ ...message, type: "message" as const })),
    ];
    const project = new AIProjectClient(config.endpoint, new DefaultAzureCredential());
    const client = project.getOpenAIClient({ timeout: FOUNDRY_AGENT_TIMEOUT_MS, maxRetries: 0 });
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => reject(new Error("Foundry request interrupted"));
      combined.addEventListener("abort", onAbort, { once: true });
    });
    const response = await Promise.race([
      client.responses.create(
        {
          input: messages, store: false, stream: false,
          max_output_tokens: purpose === "deployment" ? 12_000 : 6000,
          tool_choice: "none",
        },
        {
          signal: combined,
          body: { agent_reference: { name: config.name, type: "agent_reference" } },
        }
      ),
      aborted,
    ]);
    if (response.status !== "completed" || !response.output_text?.trim() || response.output_text.length > 250_000) {
      throw new FoundryAgentError("Foundry returned an incomplete or invalid agent response. Try again with a smaller diagram.", 502);
    }
    return response.output_text;
  } catch (error) {
    if (signal?.aborted) throw new FoundryAgentError("Foundry request cancelled.", 499);
    if (timeout.aborted) throw new FoundryAgentError("Foundry agent request timed out. Try a smaller diagram.", 504);
    if (error instanceof FoundryAgentError) throw error;
    // Provider errors can contain endpoint, tenant, input or credential details.
    throw new FoundryAgentError("Foundry agent request failed. Verify the configured agent, model access and Azure identity permissions.", 502);
  } finally {
    if (onAbort) combined.removeEventListener("abort", onAbort);
  }
}
