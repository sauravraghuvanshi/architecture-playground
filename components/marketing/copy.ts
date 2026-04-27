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
    blurb: "Drag 1,400+ AWS, Azure & GCP icons. Animated request-flow edges out of the box.",
    bullets: ["1,400+ official cloud icons", "Solid / dashed / animated flow edges", "JSON serialization (export coming)"],
    icon: Boxes,
    ready: true,
    href: "/diagrammatic",
  },
  {
    id: "sequence",
    title: "Sequence Diagrams",
    blurb: "Lifelines, async messages, activations — replayable as animated GIFs.",
    bullets: ["Sync & async arrows", "Activation bars", "Animated GIF export (planned)"],
    icon: GitBranch,
    ready: false,
    href: "/diagrammatic",
  },
  {
    id: "flowchart",
    title: "Flowcharts",
    blurb: "BPMN-friendly shapes for processes and decision trees.",
    bullets: ["Standard BPMN stencils", "Auto-layout", "Branch & merge logic"],
    icon: Workflow,
    ready: false,
    href: "/diagrammatic",
  },
  {
    id: "mindmap",
    title: "Mind Maps",
    blurb: "Radial brainstorm canvas with collapse / expand.",
    bullets: ["Radial auto-layout", "Collapse branches", "Color-coded themes"],
    icon: Brain,
    ready: false,
    href: "/diagrammatic",
  },
  {
    id: "whiteboard",
    title: "Whiteboard",
    blurb: "Excalidraw-grade hand-drawn surface for ideation.",
    bullets: ["Sketchy strokes", "Sticky notes & frames", "Single-player today"],
    icon: PenTool,
    ready: false,
    href: "/diagrammatic",
  },
  {
    id: "er",
    title: "ER Diagrams",
    blurb: "Model schemas with crow's-foot notation, emit SQL DDL.",
    bullets: ["Crow's-foot notation", "Postgres / MySQL DDL", "Reverse-engineer from URL (planned)"],
    icon: Database,
    ready: false,
    href: "/diagrammatic",
  },
  {
    id: "uml",
    title: "UML",
    blurb: "Class, state, activity. Round-trip to TypeScript planned.",
    bullets: ["Class & interface stencils", "Stereotype tags", "TS sync (planned)"],
    icon: Layers,
    ready: false,
    href: "/diagrammatic",
  },
  {
    id: "kanban",
    title: "Kanban",
    blurb: "Lightweight sprint board with columns and WIP limits.",
    bullets: ["Drag-and-drop columns", "WIP limits", "Sprint velocity (planned)"],
    icon: ListChecks,
    ready: false,
    href: "/diagrammatic",
  },
  {
    id: "system",
    title: "System / C4",
    blurb: "C4 model templates and network topologies.",
    bullets: ["C4 Context / Container / Component", "Network shapes", "Engineer-grade clarity"],
    icon: Cpu,
    ready: false,
    href: "/diagrammatic",
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
  { title: "Auto-layout", blurb: "One click cleans up any messy canvas — tier-aware columns, orthogonal routing.", icon: Wand2, status: "next" },
  { title: "Export (PNG / SVG / JSON)", blurb: "Render the canvas to bitmap, vector, or structured JSON for your wiki or repo.", icon: Code2, status: "next" },
  { title: "Sequence-diagram GIF recorder", blurb: "Record a sequence diagram as an animated GIF — the differentiator that AI-Gateway docs use.", icon: GitBranch, status: "planned" },
  { title: "Image / code → diagram", blurb: "Drop a whiteboard photo or paste Bicep/Terraform; we infer the topology.", icon: Brain, status: "planned" },
];

export const ROADMAP = [
  { phase: "Now", items: ["Architecture mode (React Flow)", "Animated edges", "Heuristic prompt → graph", "Click & drag placement", "localStorage drafts"] },
  { phase: "Next", items: ["Inspector property editing", "Real LLM generation (Azure OpenAI)", "PNG / SVG / JSON export", "Template hydration"] },
  { phase: "Then", items: ["Sequence diagram mode + GIF recorder", "Whiteboard mode (Excalidraw)", "Mind map mode (radial)", "Flowchart mode (BPMN)"] },
  { phase: "Later", items: ["ER + UML modes", "Kanban", "Image-to-diagram", "Code-to-diagram"] },
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
