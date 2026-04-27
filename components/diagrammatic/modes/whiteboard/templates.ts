import { WHITEBOARD_DEFAULT_PAYLOAD } from "../../shared/modeDefaults";
import type { ModeTemplate } from "../../shared/modeRegistry";

export const WHITEBOARD_TEMPLATES: ModeTemplate[] = [
  {
    id: "blank",
    name: "Blank canvas",
    description: "Start from an empty whiteboard",
    payload: WHITEBOARD_DEFAULT_PAYLOAD,
  },
];
