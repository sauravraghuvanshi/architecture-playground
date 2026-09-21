export function releaseExportCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

export async function toExportPng(node: HTMLElement, options: Parameters<typeof import("html-to-image").toCanvas>[1]): Promise<string> {
  const { toCanvas } = await import("html-to-image");
  const canvas = await toCanvas(node, options);
  try {
    return canvas.toDataURL("image/png");
  } finally {
    releaseExportCanvas(canvas);
  }
}
