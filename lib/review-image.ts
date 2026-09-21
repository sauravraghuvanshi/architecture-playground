import { z } from "zod";

export const AI_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const AI_IMAGE_MAX_SIDE = 8192;
export const AI_IMAGE_MAX_PIXELS = 16_000_000;
export const AI_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type AIImageMimeType = (typeof AI_IMAGE_MIME_TYPES)[number];
export type EvidenceImageErrorCode =
  | "invalid_image"
  | "invalid_data_url"
  | "invalid_base64"
  | "image_too_large"
  | "mime_mismatch"
  | "invalid_structure"
  | "invalid_dimensions"
  | "unsupported_animation"
  | "decode_failed";

export class EvidenceImageValidationError extends Error {
  readonly code: EvidenceImageErrorCode;

  constructor(code: EvidenceImageErrorCode, message: string) {
    super(message);
    this.name = "EvidenceImageValidationError";
    this.code = code;
  }
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const MAX_BASE64_LENGTH = 4 * Math.ceil(AI_IMAGE_MAX_BYTES / 3);

function validateHeaderDimensions(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 ||
      width > AI_IMAGE_MAX_SIDE || height > AI_IMAGE_MAX_SIDE || width * height > AI_IMAGE_MAX_PIXELS) {
    throw new EvidenceImageValidationError("invalid_dimensions", "Image must be at most 8192 pixels on each side and 16 megapixels in total.");
  }
}

function validateContainerEnvelope(bytes: Uint8Array, mimeType: AIImageMimeType): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const textAt = (offset: number, text: string) =>
    [...text].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
  const invalid = () => {
    throw new EvidenceImageValidationError("invalid_structure", "Image is missing a complete PNG, JPEG, or WebP container.");
  };
  if (mimeType === "image/png") {
    if (bytes.length < 57 || view.getUint32(8) !== 13 || !textAt(12, "IHDR") ||
        view.getUint32(bytes.length - 12) !== 0 || !textAt(bytes.length - 8, "IEND")) invalid();
    validateHeaderDimensions(view.getUint32(16), view.getUint32(20));
    let sawData = false;
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset);
      if (offset + 12 + length > bytes.length) invalid();
      if (textAt(offset + 4, "IDAT") && length > 0) sawData = true;
      offset += 12 + length;
    }
    if (!sawData || offset !== bytes.length) invalid();
  } else if (mimeType === "image/webp") {
    if (bytes.length < 20 || view.getUint32(4, true) + 8 !== bytes.length) invalid();
    let images = 0;
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const length = view.getUint32(offset + 4, true);
      if (offset + 8 + length + (length & 1) > bytes.length) invalid();
      const payload = offset + 8;
      if (textAt(offset, "VP8X")) {
        if (offset !== 12 || length !== 10) invalid();
        const uint24 = (position: number) => bytes[position] | bytes[position + 1] << 8 | bytes[position + 2] << 16;
        validateHeaderDimensions(uint24(payload + 4) + 1, uint24(payload + 7) + 1);
      } else if (textAt(offset, "VP8 ")) {
        if (length < 10 || bytes[payload + 3] !== 0x9d || bytes[payload + 4] !== 1 || bytes[payload + 5] !== 0x2a) invalid();
        validateHeaderDimensions(view.getUint16(payload + 6, true) & 0x3fff, view.getUint16(payload + 8, true) & 0x3fff);
      } else if (textAt(offset, "VP8L")) {
        if (length < 5 || bytes[payload] !== 0x2f) invalid();
        const dimensions = view.getUint32(payload + 1, true);
        validateHeaderDimensions((dimensions & 0x3fff) + 1, ((dimensions >>> 14) & 0x3fff) + 1);
      }
      if (textAt(offset, "VP8 ") || textAt(offset, "VP8L") || textAt(offset, "ANMF")) {
        if (length === 0) invalid();
        images++;
      }
      offset += 8 + length + (length & 1);
    }
    if (!images || offset !== bytes.length) invalid();
  } else {
    if (bytes.length < 4 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) invalid();
    let offset = 2;
    let sawFrame = false;
    while (offset < bytes.length - 2) {
      if (bytes[offset++] !== 0xff) invalid();
      while (offset < bytes.length && bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 1) continue;
      if (marker === 0 || marker >= 0xd0 && marker <= 0xd9 || offset + 2 > bytes.length) invalid();
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length - 2) invalid();
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (length < 11) invalid();
        validateHeaderDimensions(view.getUint16(offset + 5), view.getUint16(offset + 3));
        sawFrame = true;
      }
      if (marker === 0xda) {
        if (!sawFrame || length < 6) invalid();
        return;
      }
      offset += length;
    }
    invalid();
  }
}

/**
 * Validates the exact transport representation without trimming, repairing padding,
 * or accepting a claimed MIME type in place of the decoded file signature.
 * Parsed-header dimension checks run synchronously. Pixel decoding and complete
 * container validation still require validateEvidenceImage on the server.
 */
export function decodeEvidenceImageDataUrl(image: { mimeType: AIImageMimeType; dataUrl: string }): Uint8Array {
  const prefix = `data:${image.mimeType};base64,`;
  if (!image.dataUrl.startsWith(prefix)) {
    throw new EvidenceImageValidationError("invalid_data_url", "Image data URL must exactly match its declared MIME type.");
  }
  const encoded = image.dataUrl.slice(prefix.length);
  if (encoded.length > MAX_BASE64_LENGTH) {
    throw new EvidenceImageValidationError("image_too_large", "Image exceeds the 5 MiB limit.");
  }
  if (!encoded.length || encoded.length % 4 !== 0) {
    throw new EvidenceImageValidationError("invalid_base64", "Image must contain nonempty, canonical padded base64.");
  }
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  const contentLength = encoded.length - padding;
  for (let index = 0; index < contentLength; index++) {
    if (BASE64_ALPHABET.indexOf(encoded[index]) === -1) {
      throw new EvidenceImageValidationError("invalid_base64", "Image must contain only canonical base64 characters.");
    }
  }
  const lastValue = BASE64_ALPHABET.indexOf(encoded[contentLength - 1]);
  if ((padding === 2 && (lastValue & 15) !== 0) || (padding === 1 && (lastValue & 3) !== 0)) {
    throw new EvidenceImageValidationError("invalid_base64", "Image base64 contains nonzero padding bits.");
  }
  const byteLength = encoded.length / 4 * 3 - padding;
  if (byteLength > AI_IMAGE_MAX_BYTES) {
    throw new EvidenceImageValidationError("image_too_large", "Image exceeds the 5 MiB limit.");
  }
  const binary = atob(encoded);
  const bytes = new Uint8Array(byteLength);
  for (let index = 0; index < byteLength; index++) bytes[index] = binary.charCodeAt(index);

  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const webp = binary.startsWith("RIFF") && binary.slice(8, 12) === "WEBP";
  if (!({ "image/png": png, "image/jpeg": jpeg, "image/webp": webp }[image.mimeType])) {
    throw new EvidenceImageValidationError("mime_mismatch", "Decoded image bytes do not match the declared PNG, JPEG, or WebP type.");
  }
  validateContainerEnvelope(bytes, image.mimeType);
  return bytes;
}

/** Browser-safe transport/header validation; the server must also fully decode the image. */
export const aiEvidenceImageSchema = z.object({
  name: z.string().min(1).max(255).refine((value) => Boolean(value.trim()), "Image name cannot be blank."),
  mimeType: z.enum(AI_IMAGE_MIME_TYPES),
  dataUrl: z.string(),
}).strict().superRefine((image, context) => {
  try {
    decodeEvidenceImageDataUrl(image);
  } catch (error) {
    if (!(error instanceof EvidenceImageValidationError)) throw error;
    context.addIssue({
      code: "custom",
      path: ["dataUrl"],
      message: error.message,
      params: { imageCode: error.code },
    });
  }
});

export type AIEvidenceImage = z.infer<typeof aiEvidenceImageSchema>;
