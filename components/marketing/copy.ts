import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  Workflow,
  Brain,
  GitBranch,
  Database,
  ListChecks,
  PenTool,
  Layers,
  Cpu,
  Sparkles,
  Wand2,
  FileText,
  MousePointerClick,
  Activity,
  Code2,
} from "lucide-react";

export const BRAND = {
  name: "Diagrammatic",
  tagline: "An open architect's canvas. Type a system, watch it draw itself.",
  domain: "diagrammatic.app",
};

/**
 * Top-nav links. Anchors must point to sections that actually render below
 * (no broken in-page links). External destinations only when they exist.
 */
export const NAV = [
  { label: "Modes", href: "#modes" },
  { label: "Capabilities", href: "#capabilities" },
  { label: "Roadmap", href: "#roadmap" },
];

export type Tool = {
  id: string;
  title: string;
  blurb: string;
  bullets: string[];
  icon: LucideIcon;
  ready: boolean;
  href: string;
};

/**
 * The 9 modes. `ready: true` is the truth — only Architecture is in users'
 * hands today. Soon-flagged modes link to `/diagrammatic` so the click still
 * goes somewhere useful, but the card explicitly labels them as not-yet-built.
 */
export const TOOLS: Tool[] = [
  {
    id: "architecture",
    title: "Cloud Architecture",
    blurb: "Drag 1,400+ AWS, Azure & GCP icons. Animated request-flow edges, numbered step badges, and GIF recording.",
    bullets: ["1,400+ official cloud icons", "Solid / dashed / animated flow edges", "Animated GIF recorder"],
    icon: Boxes,
    ready: true,
    href: "/diagrammatic",
  },
  {
    id: "sequence",
    title: "Sequence Diagrams",
    blurb: "Lifelines + sync / async / return arrows snapped to message rows.",
    bullets: ["Sync, async & return arrows", "Snap-to-row message lanes", "Editable participant labels"],
    icon: GitBranch,
    ready: true,
    href: "/diagrammatic?mode=sequence",
  },
  {
    id: "flowchart",
    title: "Flowcharts",
    blurb: "BPMN-friendly start/process/decision/IO shapes with labeled branches.",
    bullets: ["Standard BPMN stencils", "Yes/No labelled edges", "Top-down structure"],
    icon: Workflow,
    ready: true,
    href: "/diagrammatic?mode=flowchart",
  },
  {
    id: "mindmap",
    title: "Mind Maps",
    blurb: "Radial brainstorm canvas with five color themes and add-child gestures.",
    bullets: ["Radial node placement", "5 color themes", "Smooth bezier branches"],
    icon: Brain,
    ready: true,
    href: "/diagrammatic?mode=mindmap",
  },
  {
    id: "whiteboard",
    title: "Whiteboard",
    blurb: "Excalidraw-grade hand-drawn surface for ideation and sketching.",
    bullets: ["Sketchy strokes & shapes", "Native PNG export", "Single-player today"],
    icon: PenTool,
    ready: true,
    href: "/diagrammatic?mode=whiteboard",
  },
  {
    id: "er",
    title: "ER Diagrams",
    blurb: "Entity tables with PK / FK badges, crow's-foot relationships, Postgres DDL export.",
    bullets: ["PK / FK badges", "1:1, 1:N, N:M cardinalities", "Export → Postgres CREATE TABLE"],
    icon: Database,
    ready: true,
    href: "/diagrammatic?mode=er",
  },
  {
    id: "uml",
    title: "UML Class",
    blurb: "Three-section class boxes with stereotypes; export to TypeScript.",
    bullets: ["Class & «interface» stereotypes", "Inheritance / composition / association", "Export → TypeScript"],
    icon: Layers,
    ready: true,
    href: "/diagrammatic?mode=uml",
  },
  {
    id: "kanban",
    title: "Kanban",
    blurb: "Drag-and-drop sprint board with WIP limits; export to Markdown.",
    bullets: ["Drag-and-drop columns", "WIP limit warnings", "Export → Markdown checklist"],
    icon: ListChecks,
    ready: true,
    href: "/diagrammatic?mode=kanban",
  },
  {
    id: "system",
    title: "System / C4",
    blurb: "Person / System / Container / Component nodes with technology-labelled edges.",
    bullets: ["C4 Context / Container / Component", "Technology-labelled edges", "Internal vs external systems"],
    icon: Cpu,
    ready: true,
    href: "/diagrammatic?mode=c4",
  },
];

export const HERO_PROMPTS = [
  "A serverless image-resize pipeline on AWS",
  "Multi-region active-active Postgres on Azure",
  "Event-driven order workflow with Kafka & GCP",
  "OAuth 2.0 PKCE flow",
  "C4 container view of a notifications service",
];

export const HERO_CHIPS = [
  "Three-tier web app on Azure",
  "Event-driven microservices",
  "Serverless image pipeline",
  "Real-time chat with WebSockets",
  "Data lakehouse on GCP",
];

/**
 * Capabilities that are real today (or in active development this phase).
 * No SOC2 claims, no testimonials, no fake comparisons.
 */
export type Capability = {
  title: string;
  blurb: string;
  icon: LucideIcon;
  status: "live" | "next" | "planned";
};

export const CAPABILITIES: Capability[] = [
  { title: "Prompt → architecture", blurb: "Type a system in plain English; we scaffold the canvas with real cloud icons and connect tiers automatically.", icon: Sparkles, status: "live" },
  { title: "Animated request flows", blurb: "Toggle every edge between solid, dashed, and a flowing animation that visualizes data movement.", icon: Activity, status: "live" },
  { title: "1,400+ cloud icons", blurb: "Official AWS, Azure, and GCP icon sets, searchable. Click to add or drag onto canvas.", icon: Boxes, status: "live" },
  { title: "Click-or-drag placement", blurb: "Click an icon to drop at the canvas center, or drag to a precise spot. No modal, no friction.", icon: MousePointerClick, status: "live" },
  { title: "Validation linter", blurb: "Inspector flags disconnected nodes and missing labels. The list updates as you draw.", icon: FileText, status: "live" },
  { title: "Animated GIF recorder", blurb: "Record numbered request flows as a looping GIF — the differentiator behind the AI-Gateway demos.", icon: GitBranch, status: "live" },
  { title: "Export (JSON / PNG / SVG / SQL / TS / MD)", blurb: "Per-mode exporters: cloud diagrams to PNG/SVG/JSON, ER to Postgres DDL, UML to TypeScript, Kanban to Markdown.", icon: Code2, status: "live" },
  { title: "Real LLM generation (Azure OpenAI)", blurb: "Replace the keyword heuristic with a streaming generator wired to Azure OpenAI.", icon: Wand2, status: "next" },
  { title: "Image / code → diagram", blurb: "Drop a whiteboard photo or paste Bicep/Terraform; we infer the topology.", icon: Brain, status: "planned" },
];

export const ROADMAP = [
  { phase: "Now", items: [
    "All 9 modes live (Architecture, Sequence, Flowchart, Mind Map, ER, UML, C4, Whiteboard, Kanban)",
    "Animated request-flow edges + numbered step badges",
    "Animated GIF recorder",
    "Prompt → architecture (heuristic)",
    "Click & drag placement, localStorage drafts",
    "Exports: JSON / PNG / SVG / SQL / TS / Markdown / GIF",
  ]},
  { phase: "Next", items: [
    "Real LLM generation (Azure OpenAI streaming)",
    "Shared-cursor presence",
    "Persisted save (server-side)",
  ]},
  { phase: "Then", items: [
    "Code → diagram (Bicep / Terraform)",
    "Image → diagram (whiteboard photo OCR)",
  ]},
  { phase: "Later", items: [
    "Realtime multiplayer (Y.js)",
    "Public template gallery uploads",
  ]},
];

export const FOOTER_LINKS = {
  Open: [
    { label: "Source on GitHub", href: "https://github.com/sauravraghuvanshi/architecture-playground" },
    { label: "Open the canvas", href: "/diagrammatic" },
    { label: "Project hub", href: "/" },
  ],
  Resources: [
    { label: "Roadmap", href: "#roadmap" },
    { label: "Capabilities", href: "#capabilities" },
    { label: "Modes", href: "#modes" },
  ],
};
