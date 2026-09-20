/**
 * Whiteboard uses Excalidraw's literal (light) renderer in both canvas themes.
 * Excalidraw 0.18 dark mode inverts the entire canvas and SVGs, then partially
 * counter-inverts raster images. That is unsuitable for color-faithful assets.
 * Only explicitly owned foregrounds adapt; imported/custom colors stay literal.
 */
export const WHITEBOARD_BACKGROUNDS = { light: "#f8fafc", dark: "#05080d" } as const;
export type WhiteboardTheme = keyof typeof WHITEBOARD_BACKGROUNDS;

export function normalizeCanvasColor(color: unknown): string | null {
  if (typeof color !== "string") return null;
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color.slice(1).split("").map((digit) => digit + digit).join("")}`.toLowerCase();
  }
  return null;
}

/** Resolve CSS/alpha backgrounds against the visible surface for AI/contrast. */
export function whiteboardSurfaceColor(background: string, theme: WhiteboardTheme): string {
  const opaque = normalizeCanvasColor(background);
  if (opaque) return opaque;
  const fallback = WHITEBOARD_BACKGROUNDS[theme];
  if (typeof document === "undefined" || background === "transparent") return fallback;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d");
  if (!context) return fallback;
  context.fillStyle = fallback;
  context.fillRect(0, 0, 1, 1);
  context.fillStyle = background;
  context.fillRect(0, 0, 1, 1);
  return `#${Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3).map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export function whiteboardForeground(background: string): string {
  const color = normalizeCanvasColor(background) ?? WHITEBOARD_BACKGROUNDS.light;
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  // Choose the higher-contrast of the two app foregrounds.
  return luminance > 0.193 ? "#0f172a" : "#f8fafc";
}

export function whiteboardAppearance(theme: WhiteboardTheme, state: Record<string, unknown> = {}) {
  const stored = normalizeCanvasColor(state.viewBackgroundColor)
    ?? (typeof state.viewBackgroundColor === "string" ? state.viewBackgroundColor : null);
  const backgroundColor = !stored || Object.values(WHITEBOARD_BACKGROUNDS).some((color) => color === stored)
    ? WHITEBOARD_BACKGROUNDS[theme]
    : stored;
  return { theme, backgroundColor, foregroundColor: whiteboardForeground(whiteboardSurfaceColor(backgroundColor, theme)) };
}

export function whiteboardExportState(state: Record<string, unknown>) {
  return { ...state, theme: "light", exportWithDarkMode: false, exportBackground: true, exportEmbedScene: false };
}

export interface ForegroundElement {
  id: string;
  type: string;
  strokeColor?: string;
  customData?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Excalidraw holds live element references during drawing/resizing. Replacing
 * those elements with updateScene mid-gesture disconnects pointer updates.
 */
export function isWhiteboardInteractionActive(state: Record<string, unknown>): boolean {
  return [
    "newElement", "draggingElement", "editingElement", "editingTextElement",
    "resizingElement", "multiElement", "editingLinearElement",
    "isResizing", "isRotating", "selectedElementsAreBeingDragged",
  ].some((key) => Boolean(state[key]));
}

/**
 * New strokes made with the automatic foreground opt into adaptation.
 * A subsequent manual color edit releases ownership. Never infer ownership
 * from the colors of imported/legacy elements or from multicolor images.
 */
export function reconcileWhiteboardForeground<T extends ForegroundElement>(
  element: T,
  foreground: string,
  previousForeground: string,
  isNew: boolean,
): T {
  if (element.type === "image") return element;
  const owned = element.customData?.diagrammaticForeground;
  if (typeof owned === "string") {
    if (element.strokeColor !== owned) {
      const customData = { ...element.customData };
      delete customData.diagrammaticForeground;
      return { ...element, customData };
    }
    if (owned === foreground) return element;
    return { ...element, strokeColor: foreground, customData: { ...element.customData, diagrammaticForeground: foreground } };
  }
  if (isNew && element.strokeColor === previousForeground) {
    return { ...element, strokeColor: foreground, customData: { ...element.customData, diagrammaticForeground: foreground } };
  }
  return element;
}

/** Only bundled Lucide-style neutral SVGs are eligible, never branded artwork. */
export function isNeutralWhiteboardSymbol(svg: string): boolean {
  const paints = [...svg.matchAll(/\b(?:stroke|fill)\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1].toLowerCase());
  return paints.includes("#0f172a") && paints.every((paint) => ["none", "#0f172a", "currentcolor"].includes(paint))
    && !/<(?:style|image|linearGradient|radialGradient)\b|\bstyle\s*=|url\(/i.test(svg);
}

export function colorWhiteboardSymbol(svg: string, foreground: string): string {
  if (!isNeutralWhiteboardSymbol(svg)) return svg;
  return svg.replace(/(\b(?:stroke|fill)\s*=\s*["'])(?:#0f172a|currentColor)(["'])/gi, `$1${foreground}$2`);
}

export function fitWhiteboardImage(width: number, height: number, maxWidth = 480, maxHeight = 480) {
  if (![width, height, maxWidth, maxHeight].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Image dimensions must be positive finite numbers.");
  }
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: width * scale, height: height * scale };
}

/** Decode the bytes, not the requested API size: models may return another size. */
export async function decodeWhiteboardImage(dataURL: string): Promise<{ width: number; height: number }> {
  const image = new Image();
  image.src = dataURL;
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight) throw new Error("Image has no decodable pixels.");
  return { width: image.naturalWidth, height: image.naturalHeight };
}
