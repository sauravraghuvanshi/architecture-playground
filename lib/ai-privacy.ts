import { getAiConfig } from "./ai.ts";
import { getImageAiConfig, getImageAiProxyBaseUrl } from "./ai-image-config.ts";
import { foundryProjectOrigin } from "./foundry-agent.ts";
import type { AiPrivacy } from "./ai-privacy-contract.ts";

export function describeAiPrivacy(): AiPrivacy {
  const chat = getAiConfig();
  const image = getImageAiConfig();
  const proxy = image ? null : getImageAiProxyBaseUrl();
  const agent = (purpose: "review" | "deployment") => {
    const origin = foundryProjectOrigin(purpose);
    return {
      configured: Boolean(origin), transport: origin ? "foundry-agent" as const : "unavailable" as const, origin,
      data: purpose === "review"
        ? "Selected diagram or image, customer context and review corrections are sent when you request a review."
        : "Selected architecture, requirements, context and artifact correction feedback are sent when you request generation. Offline exports and static validation do not invoke a model.",
      retention: "The app requests store:false and creates no Foundry conversation. This is not a zero-retention guarantee: provider policies, configured agent features and Azure diagnostics still apply.",
    };
  };
  return { version: 1, destinations: {
    chat: {
      configured: Boolean(chat), transport: chat ? "azure-openai" : "unavailable", origin: chat?.endpoint ?? null,
      data: "Generation sends the prompt and constraints. Describe sends the selected graph. Whiteboard conversion sends a PNG and explicit service identity metadata.",
      retention: "Requests do not create an app-managed provider conversation. Provider processing, abuse-monitoring and diagnostic retention policies still apply. Accepted architecture intent/evidence is saved with your local diagram.",
    },
    image: {
      configured: Boolean(image || proxy), transport: image ? "azure-openai" : proxy ? "configured-proxy" : "unavailable",
      origin: image?.endpoint ?? proxy,
      data: "Image generation sends your prompt, style, size and canvas colors. It does not automatically upload your existing Whiteboard.",
      retention: proxy
        ? "This explicitly configured proxy receives the input and may forward it to its own provider. Its downstream destination, logging and retention are controlled by that operator and cannot be verified here. Inserted images are saved with the local Whiteboard."
        : "Provider processing and diagnostic retention policies apply. Image prompts are not stored as a separate native history; inserted images are saved with the local Whiteboard.",
    },
    review: agent("review"), deployment: agent("deployment"),
  } };
}
