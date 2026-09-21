import sharp from "sharp";

export async function evidenceImage(mimeType = "image/png") {
  const format = { "image/png": "png", "image/jpeg": "jpeg", "image/webp": "webp" }[mimeType];
  if (!format) throw new Error("Unsupported test image format.");
  const bytes = await sharp({ create: { width: 8, height: 6, channels: 3, background: "#32678a" } }).toFormat(format).toBuffer();
  return { name: `fixture.${format}`, mimeType, dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}` };
}
