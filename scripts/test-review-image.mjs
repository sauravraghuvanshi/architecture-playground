import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import sharp from "sharp";
import {
  AI_IMAGE_MAX_BYTES, AI_IMAGE_MAX_PIXELS, AI_IMAGE_MAX_SIDE,
  AI_IMAGE_MIME_TYPES, aiEvidenceImageSchema, EvidenceImageValidationError,
} from "../lib/review-image.ts";
import { validateEvidenceImage } from "../lib/review-image-server.ts";

const evidence = (bytes, mimeType = "image/png") => ({
  name: " Evidence image ", mimeType, dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`,
});
const solid = (width, height, background = "#3276a8") => sharp({
  create: { width, height, channels: 3, background },
});
const formats = new Map([
  ["image/png", await solid(16, 12).png().toBuffer()],
  ["image/jpeg", await solid(16, 12).jpeg().toBuffer()],
  ["image/webp", await solid(16, 12).webp().toBuffer()],
]);
const png = formats.get("image/png");
const jpeg = formats.get("image/jpeg");
const webp = formats.get("image/webp");

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type, payload) {
  const chunk = Buffer.alloc(payload.length + 12);
  chunk.writeUInt32BE(payload.length);
  chunk.write(type, 4, "ascii");
  payload.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
  return chunk;
}

function pngChunks(bytes) {
  const chunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const end = offset + bytes.readUInt32BE(offset) + 12;
    chunks.push({ type: bytes.toString("ascii", offset + 4, offset + 8), data: bytes.subarray(offset + 8, end - 4), raw: bytes.subarray(offset, end) });
    offset = end;
  }
  return chunks;
}

function withText(bytes, length) {
  assert.ok(length >= 5);
  const text = Buffer.alloc(length, 65);
  text.write("Note\0", 0, "ascii");
  return Buffer.concat([bytes.subarray(0, -12), pngChunk("tEXt", text), bytes.subarray(-12)]);
}

async function rejectsImage(input, code) {
  await assert.rejects(validateEvidenceImage(input), (error) => {
    assert.ok(error instanceof EvidenceImageValidationError, error);
    if (code) assert.equal(error.code, code, error.message);
    return true;
  });
}

test("installed sharp version is inspectable; client module has no server dependency", () => {
  const pkg = JSON.parse(readFileSync(new URL("../node_modules/sharp/package.json", import.meta.url), "utf8"));
  assert.equal(pkg.version, sharp.versions.sharp);
  console.log(`Validated with sharp ${pkg.version} / libvips ${sharp.versions.vips}`);
  const source = readFileSync(new URL("../lib/review-image.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\bBuffer\b|from ["'](?:sharp|node:)/);
  assert.equal(AI_IMAGE_MAX_BYTES, 5 * 1024 * 1024);
  assert.equal(AI_IMAGE_MAX_SIDE, 8192);
  assert.equal(AI_IMAGE_MAX_PIXELS, 16_000_000);
});

test("real sharp PNG/JPEG/WebP fixtures pass without normalizing any evidence", async () => {
  for (const [mimeType, bytes] of formats) {
    const image = evidence(bytes, mimeType);
    assert.deepEqual(aiEvidenceImageSchema.parse(image), image);
    const result = await validateEvidenceImage(image);
    assert.deepEqual(result, { image, width: 16, height: 12, byteLength: bytes.length });
  }
  const progressive = await solid(16, 12).jpeg({ progressive: true }).toBuffer();
  const interlaced = await solid(16, 12).png({ progressive: true }).toBuffer();
  const lossless = await solid(16, 12).webp({ lossless: true }).toBuffer();
  const palette = await solid(16, 12).png({ palette: true }).toBuffer();
  for (const [bytes, type] of [[progressive, "image/jpeg"], [interlaced, "image/png"], [lossless, "image/webp"], [palette, "image/png"]]) {
    assert.equal((await validateEvidenceImage(evidence(bytes, type))).width, 16);
  }
});

test("strict image contract rejects unknown fields, blank names, and unsupported MIME types", async () => {
  const valid = evidence(png);
  for (const image of [
    null, {}, { ...valid, unexpected: true }, { ...valid, name: " " },
    { ...valid, name: "x".repeat(256) }, { ...valid, mimeType: "image/svg+xml" },
    { ...valid, mimeType: "image/gif" }, { ...valid, dataUrl: null },
  ]) {
    assert.equal(aiEvidenceImageSchema.safeParse(image).success, false);
    await rejectsImage(image, "invalid_image");
  }
});

test("all supported MIME spoofing combinations and embedded URL type mismatches are rejected", async () => {
  for (const [actualType, bytes] of formats) {
    for (const claimedType of AI_IMAGE_MIME_TYPES) {
      if (actualType === claimedType) continue;
      const spoofed = evidence(bytes, claimedType);
      assert.equal(aiEvidenceImageSchema.safeParse(spoofed).success, false);
      await rejectsImage(spoofed, "mime_mismatch");
    }
  }
  for (const dataUrl of [
    evidence(png).dataUrl.replace("image/png", "image/jpeg"),
    evidence(png).dataUrl.replace("image/png", "IMAGE/PNG"),
    evidence(png).dataUrl.replace(";base64", ";charset=utf-8;base64"),
    ` ${evidence(png).dataUrl}`,
  ]) await rejectsImage({ ...evidence(png), dataUrl }, "invalid_data_url");
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>throw new Error("never execute")</script></svg>');
  await rejectsImage(evidence(svg), "mime_mismatch");
});

test("client rejects signature-only and empty-container fakes, not just MIME spoofing", () => {
  const emptyWebp = Buffer.from("524946460c000000574542505650384c00000000", "hex");
  const fakePng = Buffer.concat([png.subarray(0, 33), png.subarray(-12)]);
  for (const [bytes, type] of [
    [png.subarray(0, 8), "image/png"],
    [fakePng, "image/png"],
    [Buffer.from([0xff, 0xd8, 0xff]), "image/jpeg"],
    [Buffer.from([0xff, 0xd8, 0xff, 0xd9]), "image/jpeg"],
    [webp.subarray(0, 12), "image/webp"],
    [emptyWebp, "image/webp"],
  ]) assert.equal(aiEvidenceImageSchema.safeParse(evidence(bytes, type)).success, false);
});

test("empty, malformed, unpadded, URL-safe, and noncanonical base64 never get repaired", async () => {
  const valid = png.toString("base64");
  for (const encoded of [
    "", "A", "AA", "AAA", "====", "A===", "AA=A", "AAA===", valid + "\n",
    `${valid.slice(0, 4)} ${valid.slice(4)}`, "____", "----", "!!!!", "AA%3D%3D", "AA\0=",
  ]) {
    const image = { ...evidence(png), dataUrl: `data:image/png;base64,${encoded}` };
    assert.equal(aiEvidenceImageSchema.safeParse(image).success, false, encoded.slice(0, 20));
    await rejectsImage(image, "invalid_base64");
  }
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (const remainder of [0, 1, 2]) {
    let bytes = png;
    while (bytes.length % 3 !== remainder) bytes = withText(bytes, 5);
    const image = evidence(bytes);
    await validateEvidenceImage(image);
    if (remainder === 0) continue;
    const encoded = bytes.toString("base64");
    const index = encoded.indexOf("=") - 1;
    const noncanonical = encoded.slice(0, index) + alphabet[alphabet.indexOf(encoded[index]) | 1] + encoded.slice(index + 1);
    assert.deepEqual(Buffer.from(noncanonical, "base64"), bytes, "permissive decoders would accept this alias");
    await rejectsImage({ ...image, dataUrl: `data:image/png;base64,${noncanonical}` }, "invalid_base64");
    await rejectsImage({ ...image, dataUrl: image.dataUrl.replace(/=+$/, "") }, "invalid_base64");
  }
});

test("byte limit accepts exactly 5 MiB and rejects the next byte before decoding", async () => {
  for (const size of [AI_IMAGE_MAX_BYTES - 1, AI_IMAGE_MAX_BYTES]) {
    const bytes = withText(png, size - png.length - 12);
    assert.equal(bytes.length, size);
    assert.equal((await validateEvidenceImage(evidence(bytes))).byteLength, size);
  }
  const tooLarge = withText(png, AI_IMAGE_MAX_BYTES + 1 - png.length - 12);
  assert.equal(aiEvidenceImageSchema.safeParse(evidence(tooLarge)).success, false);
  await rejectsImage(evidence(tooLarge), "image_too_large");
});

test("both side limits and the decimal 16 MP boundary are enforced on real decodable images", async () => {
  for (const [width, height] of [[8192, 1], [1, 8192], [4000, 4000]]) {
    const bytes = await solid(width, height).png().toBuffer();
    assert.equal(aiEvidenceImageSchema.safeParse(evidence(bytes)).success, true);
    const validated = await validateEvidenceImage(evidence(bytes));
    assert.equal(validated.width, width);
    assert.equal(validated.height, height);
  }
  for (const [width, height] of [[8193, 1], [1, 8193], [4001, 4000], [8192, 8192]]) {
    const bytes = await solid(width, height).png().toBuffer();
    assert.equal(aiEvidenceImageSchema.safeParse(evidence(bytes)).success, false);
    await rejectsImage(evidence(bytes), "invalid_dimensions");
  }
  for (const [format, mimeType] of [["jpeg", "image/jpeg"], ["webp", "image/webp"]]) {
    for (const [width, height] of [[8192, 1], [1, 8192], [4000, 4000]]) {
      const bytes = await solid(width, height)[format]().toBuffer();
      assert.equal(aiEvidenceImageSchema.safeParse(evidence(bytes, mimeType)).success, true);
      assert.equal((await validateEvidenceImage(evidence(bytes, mimeType))).width, width);
    }
    for (const [width, height] of [[8193, 1], [1, 8193], [4001, 4000]]) {
      const bytes = await solid(width, height)[format]().toBuffer();
      assert.equal(aiEvidenceImageSchema.safeParse(evidence(bytes, mimeType)).success, false);
      await rejectsImage(evidence(bytes, mimeType), "invalid_dimensions");
    }
  }
});

test("synchronous PNG/JPEG headers reject oversized, zero, and over-16MP dimensions before decoding", () => {
  for (const [width, height] of [[100_000, 1], [1, 100_000], [0, 12], [16, 0], [4001, 4000]]) {
    const header = Buffer.from(png.subarray(16, 29));
    header.writeUInt32BE(width);
    header.writeUInt32BE(height, 4);
    const changed = Buffer.concat([png.subarray(0, 8), pngChunk("IHDR", header), png.subarray(33)]);
    assert.throws(() => aiEvidenceImageSchema.parse(evidence(changed)), /8192|16 megapixels/);
  }
  const frame = jpeg.indexOf(Buffer.from([0xff, 0xc0]));
  assert.ok(frame > 0);
  for (const [width, height] of [[8193, 1], [1, 8193], [0, 12], [16, 0], [4001, 4000]]) {
    const changed = Buffer.from(jpeg);
    changed.writeUInt16BE(width, frame + 7);
    changed.writeUInt16BE(height, frame + 5);
    assert.throws(() => aiEvidenceImageSchema.parse(evidence(changed, "image/jpeg")), /8192|16 megapixels/);
  }
});

test("synchronous WebP dimensions cover lossy, lossless, and extended headers", async () => {
  const lossless = await solid(16, 12).webp({ lossless: true }).toBuffer();
  const extended = await solid(16, 12).withExif({ IFD0: { Copyright: "Deterministic test fixture" } }).webp().toBuffer();
  assert.equal(webp.toString("ascii", 12, 16), "VP8 ");
  assert.equal(lossless.toString("ascii", 12, 16), "VP8L");
  assert.equal(extended.toString("ascii", 12, 16), "VP8X");
  assert.equal(aiEvidenceImageSchema.safeParse(evidence(lossless, "image/webp")).success, true);
  assert.equal(aiEvidenceImageSchema.safeParse(evidence(extended, "image/webp")).success, true);
  for (const [width, height] of [[8193, 1], [1, 8193], [4001, 4000]]) {
    const lossy = Buffer.from(webp);
    lossy.writeUInt16LE(width, 26);
    lossy.writeUInt16LE(height, 28);
    const packed = Buffer.from(lossless);
    packed.writeUInt32LE(((packed.readUInt32LE(21) & 0xf0000000) | (width - 1) | (height - 1) << 14) >>> 0, 21);
    const canvas = Buffer.from(extended);
    canvas.writeUIntLE(width - 1, 24, 3);
    canvas.writeUIntLE(height - 1, 27, 3);
    for (const bytes of [lossy, packed, canvas]) {
      assert.throws(() => aiEvidenceImageSchema.parse(evidence(bytes, "image/webp")), /8192|16 megapixels/);
    }
  }
});

test("truncated containers, signatures alone, concatenated images, and malformed chunk sizes fail", async () => {
  for (const [type, bytes] of formats) {
    for (const truncated of [bytes.subarray(0, 12), bytes.subarray(0, Math.floor(bytes.length / 2)), bytes.subarray(0, -1)]) {
      await rejectsImage(evidence(truncated, type));
    }
    await rejectsImage(evidence(Buffer.concat([bytes, bytes]), type), "invalid_structure");
    await rejectsImage(evidence(Buffer.concat([bytes, Buffer.from("tail")]), type), "invalid_structure");
  }
  const badPng = Buffer.from(png);
  badPng.writeUInt32BE(0xffffffff, 8);
  await rejectsImage(evidence(badPng), "invalid_structure");
  const badWebp = Buffer.from(webp);
  badWebp.writeUInt32LE(0xffffffff, 16);
  await rejectsImage(evidence(badWebp, "image/webp"), "invalid_structure");
  const badCrc = Buffer.from(png);
  badCrc[29] ^= 1;
  await rejectsImage(evidence(badCrc), "invalid_structure");
});

test("full decode rejects invalid PNG pixels even when metadata and container checks succeed", async () => {
  const chunks = pngChunks(png);
  const corrupt = Buffer.concat([
    png.subarray(0, 8),
    ...chunks.map((chunk) => chunk.type === "IDAT" ? pngChunk("IDAT", Buffer.alloc(chunk.data.length, 0)) : chunk.raw),
  ]);
  assert.equal((await sharp(corrupt).metadata()).width, 16, "metadata alone misses corrupt pixel data");
  await rejectsImage(evidence(corrupt), "decode_failed");
});

test("full JPEG decode rejects missing scan data even when headers and final EOI remain", async () => {
  const raw = Buffer.alloc(128 * 128 * 3);
  for (let index = 0; index < raw.length; index++) raw[index] = (index * 73 + (index >>> 7) * 19) & 255;
  const image = await sharp(raw, { raw: { width: 128, height: 128, channels: 3 } }).jpeg().toBuffer();
  const scan = image.indexOf(Buffer.from([0xff, 0xda]));
  assert.ok(scan > 0);
  const scanStart = scan + 2 + image.readUInt16BE(scan + 2);
  const corrupt = Buffer.concat([image.subarray(0, scanStart + 5), Buffer.from([0xff, 0xd9])]);
  assert.equal((await sharp(corrupt).metadata()).width, 128);
  await rejectsImage(evidence(corrupt, "image/jpeg"), "decode_failed");
});

test("full WebP decode rejects incomplete pixels inside an otherwise complete RIFF container", async () => {
  const raw = Buffer.alloc(128 * 128 * 3);
  for (let index = 0; index < raw.length; index++) raw[index] = (index * 73 + (index >>> 7) * 19) & 255;
  const original = await sharp(raw, { raw: { width: 128, height: 128, channels: 3 } }).webp({ lossless: true }).toBuffer();
  assert.equal(original.toString("ascii", 12, 16), "VP8L");
  const corrupt = Buffer.from(original.subarray(0, 30));
  corrupt.writeUInt32LE(corrupt.length - 8, 4);
  corrupt.writeUInt32LE(10, 16);
  assert.equal((await sharp(corrupt).metadata()).width, 128, "metadata alone misses missing WebP pixels");
  await rejectsImage(evidence(corrupt, "image/webp"), "decode_failed");
});

test("real animated WebP and even single-frame animation markers are rejected", async () => {
  const raw = Buffer.alloc(4 * 8 * 3);
  raw.fill(220, 0, 4 * 4 * 3);
  raw.fill(30, 4 * 4 * 3);
  const animated = await sharp(raw, { raw: { width: 4, height: 8, channels: 3, pageHeight: 4 } })
    .webp({ lossless: true, loop: 0, delay: [100, 100] }).toBuffer();
  assert.equal((await sharp(animated, { animated: true }).metadata()).pages, 2);
  await rejectsImage(evidence(animated, "image/webp"), "unsupported_animation");
  const chunks = [];
  for (let offset = 12; offset < animated.length;) {
    const length = animated.readUInt32LE(offset + 4);
    const end = offset + 8 + length + (length & 1);
    chunks.push({ type: animated.toString("ascii", offset, offset + 4), raw: animated.subarray(offset, end) });
    offset = end;
  }
  let frames = 0;
  const singleFrame = Buffer.concat([animated.subarray(0, 12), ...chunks.filter((chunk) => chunk.type !== "ANMF" || ++frames === 1).map((chunk) => chunk.raw)]);
  singleFrame.writeUInt32LE(singleFrame.length - 8, 4);
  assert.equal((await sharp(singleFrame, { animated: true }).metadata()).pages, 1);
  await rejectsImage(evidence(singleFrame, "image/webp"), "unsupported_animation");
});

test("APNG animation cannot bypass sharp's still-PNG loader, including a one-frame APNG", async () => {
  const first = pngChunks(png);
  const second = pngChunks(await solid(16, 12, "#ea6633").png().toBuffer());
  for (const frameCount of [1, 2]) {
    const control = Buffer.alloc(8);
    control.writeUInt32BE(frameCount);
    const frame = (sequence) => {
      const data = Buffer.alloc(26);
      data.writeUInt32BE(sequence);
      data.writeUInt32BE(16, 4);
      data.writeUInt32BE(12, 8);
      data.writeUInt16BE(1, 20);
      data.writeUInt16BE(10, 22);
      return pngChunk("fcTL", data);
    };
    const chunks = [
      png.subarray(0, 8), first.find((chunk) => chunk.type === "IHDR").raw,
      pngChunk("acTL", control), frame(0),
      ...first.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.raw),
    ];
    if (frameCount === 2) {
      chunks.push(frame(1));
      let sequence = 2;
      for (const chunk of second.filter((chunk) => chunk.type === "IDAT")) {
        const number = Buffer.alloc(4);
        number.writeUInt32BE(sequence++);
        chunks.push(pngChunk("fdAT", Buffer.concat([number, chunk.data])));
      }
    }
    chunks.push(first.find((chunk) => chunk.type === "IEND").raw);
    const apng = Buffer.concat(chunks);
    assert.equal((await sharp(apng).metadata()).width, 16);
    await rejectsImage(evidence(apng), "unsupported_animation");
  }
});

test("JPEG multipicture metadata is never silently reduced to the first image", async () => {
  const app2 = Buffer.from([0xff, 0xe2, 0, 6, 77, 80, 70, 0]);
  const multipicture = Buffer.concat([jpeg.subarray(0, 2), app2, jpeg.subarray(2)]);
  await rejectsImage(evidence(multipicture, "image/jpeg"), "unsupported_animation");
});
