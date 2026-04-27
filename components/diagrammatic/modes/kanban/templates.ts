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
    id: "sprint-with-metadata",
    name: "Sprint 24 — Payments",
    description: "Two-week sprint with start/end + velocity + cross-diagram link",
    payload: {
      sprint: { name: "Sprint 24 — Payments", start: "2025-04-01", end: "2025-04-14", velocity: 28 },
      columns: [
        { id: "backlog", title: "Backlog", cardIds: ["s1", "s2"] },
        { id: "doing", title: "In progress", wipLimit: 3, cardIds: ["s3"] },
        { id: "review", title: "Review", wipLimit: 2, cardIds: ["s4"] },
        { id: "done", title: "Done", cardIds: ["s5"] },
      ],
      cards: {
        s1: { id: "s1", title: "Refund flow API", label: "feature",
              linkedMode: "architecture", linkedDiagramId: "draft", linkedNodeId: "api" },
        s2: { id: "s2", title: "Update ER for refunds table", label: "feature",
              linkedMode: "er", linkedDiagramId: "draft" },
        s3: { id: "s3", title: "Stripe webhook handler", label: "feature",
              linkedMode: "sequence", linkedDiagramId: "draft" },
        s4: { id: "s4", title: "QA — partial refund edge cases", label: "design" },
        s5: { id: "s5", title: "Telemetry dashboard wiring", label: "growth" },
      },
    },
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
