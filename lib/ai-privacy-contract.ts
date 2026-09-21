import { z } from "zod";

export const AI_CAPABILITIES = ["chat", "image", "review", "deployment"] as const;
export type AiCapability = (typeof AI_CAPABILITIES)[number];
export const aiDestinationSchema = z.object({
  configured: z.boolean(),
  transport: z.enum(["azure-openai", "foundry-agent", "configured-proxy", "unavailable"]),
  origin: z.string().url().nullable(),
  data: z.string().max(1000),
  retention: z.string().max(1500),
}).strict();
export const aiPrivacySchema = z.object({
  version: z.literal(1),
  destinations: z.object({
    chat: aiDestinationSchema, image: aiDestinationSchema,
    review: aiDestinationSchema, deployment: aiDestinationSchema,
  }).strict(),
}).strict();
export type AiPrivacy = z.infer<typeof aiPrivacySchema>;
export const AI_LOCAL_CLEAR_NOTICE =
  "Clearing local AI history or this session does not delete saved diagrams, inserted images, exports, browser URL history or data retained by the configured provider. Remove those copies separately. Do not include secrets.";
