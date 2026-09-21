import { z } from "zod";
import { consumeSseResponse } from "./sse-client.ts";
import { decodeEvidenceImageDataUrl, AI_IMAGE_MAX_BYTES } from "./review-image.ts";
import { imageCanvasContextSchema } from "./image-styles.ts";

export const imageErrorCodeSchema = z.enum(["timeout", "throttled", "refused", "invalid_output", "unavailable", "upstream"]);
export type ImageErrorCode = z.infer<typeof imageErrorCodeSchema>;
export const IMAGE_RESPONSE_MAX_BYTES = 7_100_000;

const imageResultSchema = z.object({
  type: z.literal("result"),
  b64: z.string().min(1).max(4 * Math.ceil(AI_IMAGE_MAX_BYTES / 3)),
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]).default("image/png"),
  size: z.string().max(32).optional(),
  elapsed: z.number().finite().nonnegative().optional(),
  canvas: imageCanvasContextSchema.optional(),
}).strict();

const imageEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("started"), elapsed: z.number().finite().nonnegative().optional() }).strict(),
  imageResultSchema,
  z.object({
    type: z.literal("error"), message: z.string().max(500).optional(),
    status: z.number().int().min(400).max(599).optional(), code: imageErrorCodeSchema.optional(),
  }).strict(),
]);

export function imageFailureMessage(code: ImageErrorCode): string {
  switch (code) {
    case "timeout": return "Image generation timed out. No image was inserted; retry when the service is available.";
    case "throttled": return "Image generation was throttled. Wait before trying again.";
    case "refused": return "Image generation was refused by the content policy. Revise the prompt before retrying.";
    case "invalid_output": return "The image service returned incomplete or invalid image data. Nothing was inserted.";
    case "unavailable": return "Image generation is unavailable. Check the configured deployment and credentials.";
    case "upstream": return "The image service could not complete the request. No alternate destination was tried.";
  }
}

export function imageFailureCode(status: number): ImageErrorCode {
  if (status === 429) return "throttled";
  if (status === 408 || status === 504) return "timeout";
  if ([401, 403, 404, 503].includes(status)) return "unavailable";
  return "upstream";
}

export async function consumeImageResponse(response: Response, signal?: AbortSignal) {
  let result: z.infer<typeof imageResultSchema> | undefined;
  let terminal = false;
  let started = false;
  await consumeSseResponse(response, {
    signal,
    onEvent({ data }) {
      if (terminal) throw new Error("Image stream returned more than one terminal event. Nothing was inserted.");
      let json: unknown;
      try { json = JSON.parse(data); }
      catch { throw new Error("Image stream returned invalid JSON. Nothing was inserted."); }
      const parsed = imageEventSchema.safeParse(json);
      if (!parsed.success) throw new Error(imageFailureMessage("invalid_output"));
      const event = parsed.data;
      if (event.type === "started") {
        if (started) throw new Error("Image stream restarted unexpectedly. Nothing was inserted.");
        started = true;
      } else if (event.type === "error") {
        terminal = true;
        throw new Error(imageFailureMessage(event.code ?? imageFailureCode(event.status ?? 502)));
      } else {
        terminal = true;
        decodeEvidenceImageDataUrl({ mimeType: event.mimeType, dataUrl: `data:${event.mimeType};base64,${event.b64}` });
        result = event;
      }
    },
  });
  signal?.throwIfAborted();
  if (!result) throw new Error("Image generation ended without a complete result. Nothing was inserted.");
  return result;
}
