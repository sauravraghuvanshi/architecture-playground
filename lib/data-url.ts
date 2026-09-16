export function dataUrlToBlob(dataUrl: string): Blob {
  const separator = dataUrl.indexOf(",");
  if (separator < 0 || !dataUrl.startsWith("data:")) throw new Error("Invalid export data URL.");
  const header = dataUrl.slice(0, separator);
  const encoded = dataUrl.slice(separator + 1);
  const mime = header.match(/^data:([^;,]+)/)?.[1] ?? "application/octet-stream";
  if (!header.includes(";base64")) {
    return new Blob([decodeURIComponent(encoded)], { type: mime });
  }
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}
