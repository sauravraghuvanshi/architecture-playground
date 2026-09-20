import { exportToBlob } from "@excalidraw/excalidraw";
import { whiteboardExportState } from "@/lib/whiteboard-appearance";

interface WhiteboardElement {
  id?: string;
  type?: string;
  isDeleted?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  [key: string]: unknown;
}

const FLOW_COLORS = ["#0ea5e9", "#22d3ee", "#67e8f9"] as const;

export async function exportWhiteboardFlowGif({
  elements,
  appState,
  files,
  backgroundColor,
}: {
  elements: readonly unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
  backgroundColor: string;
}): Promise<Blob> {
  const scene = elements as readonly WhiteboardElement[];
  const arrows = scene.filter(
    (element) => element.type === "arrow" && !element.isDeleted && element.id
  );
  if (arrows.length === 0) {
    throw new Error("Draw at least one Flow arrow before exporting a Whiteboard GIF.");
  }

  const frames: Array<{ elements: WhiteboardElement[]; delay: number }> = [
    { elements: [...scene], delay: 900 },
  ];
  for (const arrow of arrows) {
    for (const color of FLOW_COLORS) {
      frames.push({
        delay: 180,
        elements: scene.map((element) => {
          if (element.type !== "arrow") return element;
          const active = element.id === arrow.id;
          return {
            ...element,
            opacity: active ? 100 : 35,
            strokeColor: active ? color : "#64748b",
            strokeWidth: active ? Math.max(4, element.strokeWidth ?? 2) : element.strokeWidth,
          };
        }),
      });
    }
  }
  frames.push({ elements: [...scene], delay: 900 });

  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const gif = GIFEncoder();
  const raster = document.createElement("canvas");
  const context = raster.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Unable to create the Whiteboard GIF renderer.");

  let width = 0;
  let height = 0;
  let frameCount = 0;
  for (const frame of frames) {
    const png = await exportToBlob({
      elements: frame.elements as never[],
      appState: {
        ...whiteboardExportState(appState),
        viewBackgroundColor: backgroundColor,
      } as never,
      files: files as never,
      mimeType: "image/png",
    });
    const bitmap = await createImageBitmap(png);
    if (width === 0 || height === 0) {
      const scale = Math.min(1, 1280 / bitmap.width, 900 / bitmap.height);
      width = Math.max(1, Math.round(bitmap.width * scale));
      height = Math.max(1, Math.round(bitmap.height * scale));
      raster.width = width;
      raster.height = height;
    }
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const rgba = context.getImageData(0, 0, width, height).data;
    const palette = quantize(rgba, 256);
    const indexed = applyPalette(rgba, palette);
    gif.writeFrame(indexed, width, height, {
      palette,
      delay: frame.delay,
    });
    frameCount += 1;
  }

  gif.finish();
  const bytes = gif.bytes();
  const output = new Uint8Array(bytes.byteLength);
  output.set(bytes);
  window.dispatchEvent(
    new CustomEvent("diagrammatic-whiteboard-gif-capture", {
      detail: { frameCount, arrowCount: arrows.length },
    })
  );
  return new Blob([output], { type: "image/gif" });
}
