/**
 * Starter templates for Flowchart mode. Each is a valid FlowchartPayload
 * that can be applied via the toolbar's Templates picker (which calls
 * BaseCanvasHandle.hydrate).
 */
import { FLOWCHART_DEFAULT_PAYLOAD, FLOWCHART_EMPTY_PAYLOAD } from "../../shared/modeDefaults";
import type { ModeTemplate } from "../../shared/modeRegistry";

export const FLOWCHART_TEMPLATES: ModeTemplate[] = [
  {
    id: "blank",
    name: "Blank canvas",
    description: "Start fresh — add shapes from the builder palette",
    payload: FLOWCHART_EMPTY_PAYLOAD,
  },
  {
    id: "auth-flow",
    name: "Authorization flow",
    description: "Receive request → check auth → handle or reject",
    payload: FLOWCHART_DEFAULT_PAYLOAD,
  },
  {
    id: "cicd-pipeline",
    name: "CI/CD pipeline",
    description: "Push → build → test → deploy with rollback branch",
    payload: {
      nodes: [
        { id: "n1", shape: "startend", label: "Push to main", x: 360, y: 0 },
        { id: "n2", shape: "process", label: "Run unit tests", x: 340, y: 110 },
        { id: "n3", shape: "decision", label: "Tests pass?", x: 340, y: 230 },
        { id: "n4", shape: "process", label: "Build artifact", x: 140, y: 380 },
        { id: "n5", shape: "process", label: "Notify on Slack", x: 540, y: 380 },
        { id: "n6", shape: "process", label: "Deploy to staging", x: 140, y: 500 },
        { id: "n7", shape: "decision", label: "Smoke OK?", x: 140, y: 620 },
        { id: "n8", shape: "process", label: "Promote to prod", x: -60, y: 770 },
        { id: "n9", shape: "process", label: "Rollback", x: 340, y: 770 },
        { id: "n10", shape: "startend", label: "Done", x: 140, y: 900 },
      ],
      edges: [
        { id: "e1", from: "n1", to: "n2" },
        { id: "e2", from: "n2", to: "n3" },
        { id: "e3", from: "n3", to: "n4", label: "Yes" },
        { id: "e4", from: "n3", to: "n5", label: "No" },
        { id: "e5", from: "n4", to: "n6" },
        { id: "e6", from: "n6", to: "n7" },
        { id: "e7", from: "n7", to: "n8", label: "Yes" },
        { id: "e8", from: "n7", to: "n9", label: "No" },
        { id: "e9", from: "n8", to: "n10" },
        { id: "e10", from: "n9", to: "n10" },
      ],
    },
  },
  {
    id: "incident-response",
    name: "Incident response",
    description: "Page → triage → mitigate → postmortem",
    payload: {
      nodes: [
        { id: "n1", shape: "startend", label: "Alert fired", x: 360, y: 0 },
        { id: "n2", shape: "process", label: "Page on-call", x: 340, y: 110 },
        { id: "n3", shape: "process", label: "Open incident channel", x: 340, y: 230 },
        { id: "n4", shape: "decision", label: "Customer impact?", x: 340, y: 350 },
        { id: "n5", shape: "process", label: "Post status page", x: 580, y: 470 },
        { id: "n6", shape: "process", label: "Mitigate", x: 340, y: 600 },
        { id: "n7", shape: "decision", label: "Fixed?", x: 340, y: 720 },
        { id: "n8", shape: "process", label: "Schedule postmortem", x: 340, y: 860 },
        { id: "n9", shape: "startend", label: "Resolved", x: 360, y: 980 },
      ],
      edges: [
        { id: "e1", from: "n1", to: "n2" },
        { id: "e2", from: "n2", to: "n3" },
        { id: "e3", from: "n3", to: "n4" },
        { id: "e4", from: "n4", to: "n5", label: "Yes" },
        { id: "e5", from: "n4", to: "n6", label: "No" },
        { id: "e6", from: "n5", to: "n6" },
        { id: "e7", from: "n6", to: "n7" },
        { id: "e8", from: "n7", to: "n8", label: "Yes" },
        { id: "e9", from: "n7", to: "n6", label: "No" },
        { id: "e10", from: "n8", to: "n9" },
      ],
    },
  },
];
