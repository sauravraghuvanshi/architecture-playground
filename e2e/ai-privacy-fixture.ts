import type { AiPrivacy } from "../lib/ai-privacy-contract";

export const privacyFixture: AiPrivacy = {
  version: 1,
  destinations: {
    chat: { configured: true, transport: "azure-openai", origin: "https://approved-chat.example", data: "Prompt, constraints or selected graph/image.", retention: "Synthetic test disclosure; no provider invoked." },
    image: { configured: true, transport: "configured-proxy", origin: "https://approved-image.example", data: "Prompt, style and canvas colors.", retention: "Proxy operator controls downstream retention; not verified here." },
    review: { configured: true, transport: "foundry-agent", origin: "https://approved-foundry.example", data: "Selected evidence and context.", retention: "store:false does not guarantee zero retention." },
    deployment: { configured: true, transport: "foundry-agent", origin: "https://approved-foundry.example", data: "Selected architecture and constraints.", retention: "store:false does not guarantee zero retention." },
  },
};
