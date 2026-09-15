import { z } from "zod";

export const IMAGE_STYLES = [
  { id: "original", label: "As described", instruction: "" },
  { id: "workshop", label: "Workshop sketch", instruction: "Use a clean hand-drawn workshop style, white background, dark ink, restrained blue accents and readable labels." },
  { id: "executive", label: "Executive presentation", instruction: "Use a polished flat-vector presentation style, white background, generous spacing, concise readable labels and a restrained navy/cyan palette." },
  { id: "blueprint", label: "Technical blueprint", instruction: "Use a precise technical blueprint style with aligned components, clear connectors, concise readable labels and a subtle grid." },
] as const;

export const imageRequestSchema = z.object({
  prompt: z.string().trim().min(1, "Describe an image to generate.").max(1000),
  size: z.enum(["1024x1024", "1024x1536", "1536x1024"]).default("1024x1024"),
  style: z.enum(["original", "workshop", "executive", "blueprint"]).default("original"),
});

export function buildImagePrompt(input: z.infer<typeof imageRequestSchema>): string {
  const style = IMAGE_STYLES.find((candidate) => candidate.id === input.style)!;
  return style.instruction
    ? `${style.instruction}\nVisual requested by the user:\n${input.prompt}`
    : input.prompt;
}
