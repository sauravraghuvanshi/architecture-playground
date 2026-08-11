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
 * The 9 modes. Every ready flag is backed by an end-to-end workspace test.
 */
export const TOOLS: Tool[] = [
  {
    id: "architecture",
    title: "Cloud Architecture",
    blurb: "Drag 1,433 AWS, Azure & GCP icons. Order request-flow edges and export synchronized animated GIFs.",
    bullets: ["1,433 cloud icons", "Solid / dashed / animated flow edges", "PNG / SVG / PDF / GIF export"],
    icon: Boxes,
    ready: true,
    href: "/diagrammatic",
  },
  {
    id: "sequence",
    title: "Sequence Diagrams",
    blurb: "Lifelines + sync / async / return arrows snapped to message rows.",
    bullets: ["Sync, async & return arrows", "Snap-to-row message lanes", "Starter templates + participant builder"],
    icon: GitBranch,
    ready: true,
    href: "/diagrammatic?mode=sequence",
  },
  {
    id: "flowchart",
    title: "Flowcharts",
    blurb: "Start, process, decision, IO, and subprocess shapes with labeled branches.",
    bullets: ["Standard flowchart shapes", "Yes/No labelled edges", "Top-down structure"],
    icon: Workflow,
    ready: true,
    href: "/diagrammatic?mode=flowchart",
  },
  {
    id: "mindmap",
    title: "Mind Maps",
    blurb: "Radial brainstorm canvas with color themes, connected branches, and a node builder.",
    bullets: ["Radial node placement", "Color-coded topics", "Smooth bezier branches"],
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
    blurb: "Entity tables with PK / FK badges, cardinality-labelled relationships, and SQL DDL export.",
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
    blurb: "Drag cards within and across sprint columns, enforce WIP limits, and export to Markdown.",
    bullets: ["Cross-column card movement", "WIP limit warnings", "Export → Markdown checklist"],
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
 * Capabilities that are real and test-covered today.
 */
export type Capability = {
  title: string;
  blurb: string;
  icon: LucideIcon;
  status: "live";
};

export const CAPABILITIES: Capability[] = [
  { title: "Prompt → diagram", blurb: "Use deterministic architecture scaffolding or Azure OpenAI generation when the server is configured.", icon: Sparkles, status: "live" },
  { title: "Ordered request flows", blurb: "Set solid, dashed, or animated edges and control GIF sequence steps; equal steps move together.", icon: Activity, status: "live" },
  { title: "1,433 cloud icons", blurb: "AWS, Azure, and GCP icon assets are searchable and can be clicked or dragged onto the canvas.", icon: Boxes, status: "live" },
  { title: "Click-or-drag placement", blurb: "Click an icon to drop at the canvas center, or drag to a precise spot. No modal, no friction.", icon: MousePointerClick, status: "live" },
  { title: "Validation linter", blurb: "Inspector flags disconnected nodes and missing labels. The list updates as you draw.", icon: FileText, status: "live" },
  { title: "Synchronized GIF recorder", blurb: "Export numbered request flows while keeping service cards static and animating equal-numbered paths together.", icon: GitBranch, status: "live" },
  { title: "Presentation-ready export", blurb: "Export PNG, SVG, PDF, JSON, and GIF; ER adds SQL, UML adds TypeScript, and Kanban adds Markdown.", icon: Code2, status: "live" },
  { title: "Local-first review", blurb: "Autosave drafts in the browser, add scoped comments, and capture restorable version snapshots.", icon: FileText, status: "live" },
  { title: "Reusable templates", blurb: "Start blank or apply tested starter patterns for every diagram mode, including grouped cloud architectures.", icon: Wand2, status: "live" },
];

export const FOOTER_LINKS = {
  Open: [
    { label: "Source on GitHub", href: "https://github.com/sauravraghuvanshi/architecture-playground" },
    { label: "Open the canvas", href: "/diagrammatic" },
    { label: "Project hub", href: "/" },
  ],
  Resources: [
    { label: "Capabilities", href: "#capabilities" },
    { label: "Modes", href: "#modes" },
  ],
};
