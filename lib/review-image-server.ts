import sharp from "sharp";
import {
  AI_IMAGE_MAX_PIXELS,
  AI_IMAGE_MAX_SIDE,
  aiEvidenceImageSchema,
  decodeEvidenceImageDataUrl,
  EvidenceImageValidationError,
  type AIEvidenceImage,
  type EvidenceImageErrorCode,
} from "./review-image.ts";

export { EvidenceImageValidationError } from "./review-image.ts";

export interface ValidatedEvidenceImage {
  image: AIEvidenceImage;
  width: number;
  height: number;
  byteLength: number;
}

function invalidStructure(message: string): never {
  throw new EvidenceImageValidationError("invalid_structure", message);
}

function rejectAnimation(): never {
  throw new EvidenceImageValidationError("unsupported_animation", "Animated and multipage images are not supported; supply one still image.");
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});

function crc32(bytes: Buffer, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let index = start; index < end; index++) crc = CRC_TABLE[(crc ^ bytes[index]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function validatePngContainer(bytes: Buffer): void {
  let offset = 8;
  let sawHeader = false;
  let sawPalette = false;
  let sawData = false;
  let dataEnded = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) invalidStructure("PNG contains a truncated chunk.");
    const type = bytes.toString("latin1", offset + 4, offset + 8);
    if (!/^[A-Za-z]{4}$/.test(type) || bytes[offset + 6] & 32) invalidStructure("PNG contains an invalid chunk type.");
    if (crc32(bytes, offset + 4, end - 4) !== bytes.readUInt32BE(end - 4)) invalidStructure("PNG chunk checksum is invalid.");
    if (!sawHeader && type !== "IHDR") invalidStructure("PNG must begin with an IHDR chunk.");
    if (type === "acTL" || type === "fcTL" || type === "fdAT") rejectAnimation();
    if (type === "IHDR") {
      if (sawHeader || length !== 13) invalidStructure("PNG contains an invalid or duplicate IHDR chunk.");
      sawHeader = true;
    } else if (type === "PLTE") {
      if (sawPalette || sawData || !length || length > 768 || length % 3 !== 0) invalidStructure("PNG palette is invalid.");
      sawPalette = true;
    } else if (type === "IDAT") {
      if (dataEnded) invalidStructure("PNG image data chunks must be consecutive.");
      sawData = true;
    } else if (type === "IEND") {
      if (length || !sawData || end !== bytes.length) invalidStructure("PNG must end with exactly one complete image.");
      return;
    } else if (!(bytes[offset + 4] & 32)) {
      invalidStructure("PNG contains an unsupported critical chunk.");
    }
    if (sawData && type !== "IDAT") dataEnded = true;
    offset = end;
  }
  invalidStructure("PNG is incomplete or lacks its IEND chunk.");
}

function validateWebpContainer(bytes: Buffer): void {
  if (bytes.length < 20 || bytes.readUInt32LE(4) + 8 !== bytes.length) invalidStructure("WebP RIFF length does not match its complete payload.");
  let offset = 12;
  let images = 0;
  while (offset + 8 <= bytes.length) {
    const type = bytes.toString("latin1", offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    const end = offset + 8 + length;
    if (end + (length & 1) > bytes.length) invalidStructure("WebP contains a truncated chunk.");
    if (type === "ANIM" || type === "ANMF") rejectAnimation();
    if (type === "VP8X") {
      if (offset !== 12 || length !== 10) invalidStructure("WebP extended header is invalid.");
      if (bytes[offset + 8] & 2) rejectAnimation();
      if (bytes[offset + 8] & 0xc1 || bytes[offset + 9] || bytes[offset + 10] || bytes[offset + 11]) {
        invalidStructure("WebP extended header contains nonzero reserved bits.");
      }
    }
    if (type === "VP8 " || type === "VP8L") images++;
    if ((length & 1) && bytes[end] !== 0) invalidStructure("WebP chunk padding must be zero.");
    offset = end + (length & 1);
  }
  if (offset !== bytes.length || images !== 1) invalidStructure("WebP must contain exactly one complete still image.");
}

/**
 * Walk marker boundaries only, not JPEG coefficients or entropy coding. This
 * prevents a tolerant decoder from silently ignoring a second image or tail.
 * libjpeg (through sharp) remains responsible for actual pixel decoding.
 */
function validateJpegContainer(bytes: Buffer): void {
  let offset = 2;
  let inScan = false;
  let sawScan = false;
  while (offset < bytes.length) {
    if (inScan) {
      while (offset < bytes.length && bytes[offset] !== 0xff) offset++;
    } else if (bytes[offset] !== 0xff) {
      invalidStructure("JPEG contains data outside a marker or scan.");
    }
    if (offset >= bytes.length) break;
    while (offset < bytes.length && bytes[offset] === 0xff) offset++;
    if (offset >= bytes.length) break;
    const marker = bytes[offset++];
    if (inScan && (marker === 0 || (marker >= 0xd0 && marker <= 0xd7))) continue;
    inScan = false;
    if (marker === 0xd9) {
      if (!sawScan || offset !== bytes.length) invalidStructure("JPEG must contain exactly one complete image without trailing data.");
      return;
    }
    if (marker === 0xd8 || marker === 0 || (marker >= 0xd0 && marker <= 0xd7)) invalidStructure("JPEG marker sequence is invalid.");
    if (marker === 1) continue;
    if (offset + 2 > bytes.length) break;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) invalidStructure("JPEG contains a truncated marker.");
    if (marker === 0xe2 && length >= 6 && bytes.toString("latin1", offset + 2, offset + 6) === "MPF\0") rejectAnimation();
    offset += length;
    if (marker === 0xda) {
      inScan = true;
      sawScan = true;
    }
  }
  invalidStructure("JPEG is incomplete or lacks its end-of-image marker.");
}

function validateDimensions(width: number | undefined, height: number | undefined): void {
  if (!width || !height || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width > AI_IMAGE_MAX_SIDE || height > AI_IMAGE_MAX_SIDE || width * height > AI_IMAGE_MAX_PIXELS) {
    throw new EvidenceImageValidationError("invalid_dimensions", "Image must be at most 8192 pixels on each side and 16 megapixels in total.");
  }
}

/**
 * Server-only validation. Returns the original, unmodified evidence after a full
 * bounded pixel decode; never re-encodes, crops, drops frames, or calls a provider.
 * Call this before forwarding image evidence to any AI provider.
 */
export async function validateEvidenceImage(input: unknown): Promise<ValidatedEvidenceImage> {
  const parsed = aiEvidenceImageSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const code = issue.code === "custom" ? issue.params?.imageCode as EvidenceImageErrorCode | undefined : undefined;
    throw new EvidenceImageValidationError(code ?? "invalid_image", issue.message);
  }
  const image = parsed.data;
  const bytes = Buffer.from(decodeEvidenceImageDataUrl(image));
  if (image.mimeType === "image/png") validatePngContainer(bytes);
  else if (image.mimeType === "image/webp") validateWebpContainer(bytes);
  else validateJpegContainer(bytes);

  const decoder = sharp(bytes, {
    failOn: "warning",
    limitInputPixels: AI_IMAGE_MAX_PIXELS,
    pages: 1,
    page: 0,
    animated: false,
    unlimited: false,
  });
  try {
    const metadata = await decoder.metadata();
    const expectedFormat = { "image/png": "png", "image/jpeg": "jpeg", "image/webp": "webp" }[image.mimeType];
    if (metadata.format !== expectedFormat) throw new EvidenceImageValidationError("mime_mismatch", "Image decoder format does not match its declared MIME type.");
    if ((metadata.pages ?? 1) !== 1 || metadata.pageHeight && metadata.pageHeight !== metadata.height ||
        metadata.delay && metadata.delay.length > 0 || metadata.loop !== undefined) rejectAnimation();
    validateDimensions(metadata.width, metadata.height);

    // metadata() does not read all compressed pixel data. No resize/extract is
    // allowed here: every pixel must be decoded before the original is accepted.
    const { info } = await decoder.raw().toBuffer({ resolveWithObject: true });
    validateDimensions(info.width, info.height);
    if (info.width !== metadata.width || info.height !== metadata.height) invalidStructure("Decoded dimensions disagree with image metadata.");
    return { image, width: info.width, height: info.height, byteLength: bytes.length };
  } catch (error) {
    if (error instanceof EvidenceImageValidationError) throw error;
    if (error instanceof Error && /pixel limit/i.test(error.message)) {
      throw new EvidenceImageValidationError("invalid_dimensions", "Image exceeds the 16 megapixel decoding limit.");
    }
    throw new EvidenceImageValidationError("decode_failed", "Image is corrupt, truncated, or cannot be fully decoded.");
  } finally {
    decoder.destroy();
  }
}
