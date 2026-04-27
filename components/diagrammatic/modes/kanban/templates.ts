import { KANBAN_DEFAULT_PAYLOAD } from "../../shared/modeDefaults";
import type { ModeTemplate } from "../../shared/modeRegistry";

export const KANBAN_TEMPLATES: ModeTemplate[] = [
  {
    id: "sprint-board",
    name: "Sprint board",
    description: "Backlog / In progress / Review / Done",
    payload: KANBAN_DEFAULT_PAYLOAD,
  },
  {
    id: "bug-triage",
    name: "Bug triage",
    description: "New / Triage / Fixing / Verifying / Closed",
    payload: {
      columns: [
        { id: "new", title: "New", cardIds: ["b1", "b2"] },
        { id: "triage", title: "Triage", wipLimit: 5, cardIds: ["b3"] },
        { id: "fixing", title: "Fixing", wipLimit: 3, cardIds: ["b4"] },
        { id: "verifying", title: "Verifying", wipLimit: 3, cardIds: ["b5"] },
        { id: "closed", title: "Closed", cardIds: ["b6"] },
      ],
      cards: {
        b1: { id: "b1", title: "Connect drag loses node", label: "p0" },
        b2: { id: "b2", title: "Mind-map collapse keyboard a11y", label: "a11y" },
        b3: { id: "b3", title: "ER export missing FK constraint", label: "p1" },
        b4: { id: "b4", title: "Whiteboard PNG export black bg", label: "p1" },
        b5: { id: "b5", title: "Kanban WIP limit enforcement", label: "p2" },
        b6: { id: "b6", title: "Toolbar overflow on small screens", label: "ux" },
      },
    },
  },
];
