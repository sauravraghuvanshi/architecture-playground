import { z } from "zod";

export const IMAGE_STYLES = [
  { id: "original", label: "As described", instruction: "" },
  { id: "workshop", label: "Workshop sketch", instruction: "Use a clean hand-drawn workshop style, restrained blue accents and readable labels; use the supplied canvas foreground and background." },
  { id: "executive", label: "Executive presentation", instruction: "Use a polished flat-vector presentation style, generous spacing, concise readable labels and restrained cyan accents; use the supplied canvas foreground and background." },
  { id: "blueprint", label: "Technical blueprint", instruction: "Use a precise technical blueprint style with aligned components, clear connectors, concise readable labels and a subtle grid." },
] as const;

export const imageCanvasContextSchema = z.object({
  theme: z.enum(["light", "dark"]),
  backgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  foregroundColor: z.string().regex(/^#[0-9a-f]{6}$/i),
});
export type ImageCanvasContext = z.infer<typeof imageCanvasContextSchema>;

export const imageRequestSchema = z.object({
  prompt: z.string().trim().min(1, "Describe an image to generate.").max(1000),
  size: z.enum(["1024x1024", "1024x1536", "1536x1024"]).default("1024x1024"),
  style: z.enum(["original", "workshop", "executive", "blueprint"]).default("original"),
  canvas: imageCanvasContextSchema.default({ theme: "dark", backgroundColor: "#05080d", foregroundColor: "#f8fafc" }),
});

export function buildImagePrompt(input: z.infer<typeof imageRequestSchema>): string {
  const style = IMAGE_STYLES.find((candidate) => candidate.id === input.style)!;
  return [
    "Create a digital diagram asset to insert directly into an existing Whiteboard canvas, not a photograph or mockup.",
    `Canvas theme: ${input.canvas.theme}. Exact canvas background: ${input.canvas.backgroundColor}. High-contrast foreground for text and linework: ${input.canvas.foregroundColor}. Selected visual style: ${style.label}.`,
    "Use a flat, opaque, edge-to-edge background matching that exact canvas color, including all corners. Do not depict paper, a notebook, a photographed whiteboard, a frame, a drop shadow, a border, a white matte, or a surrounding presentation surface.",
    "Keep text and diagram strokes readable against the supplied background. Preserve recognizable brand colors when requested. Do not simulate transparency with checkerboards; transparent output is not requested or guaranteed.",
    style.instruction,
    `Visual requested by the user:\n${input.prompt}`,
  ].filter(Boolean).join("\n");
}
