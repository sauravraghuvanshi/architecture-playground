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
  ImageIcon,
  FileText,
  MessagesSquare,
  Calculator,
  ShieldCheck,
  Lock,
  Server,
  Globe,
  Zap,
  Network,
} from "lucide-react";

export const BRAND = {
  name: "Diagrammatic",
  tagline: "Design any system. With words. With AI. In one canvas.",
  domain: "diagrammatic.app",
};

export const NAV = [
  { label: "Product", href: "#tools" },
  { label: "AI Tools", href: "#ai" },
  { label: "Pricing", href: "#pricing" },
  { label: "Templates", href: "#templates" },
  { label: "Security", href: "#security" },
];

export type Tool = {
  id: string;
  title: string;
  blurb: string;
  bullets: string[];
  icon: LucideIcon;
  ready: boolean;
  href: string;
  accent: string;
};

export const TOOLS: Tool[] = [
  {
    id: "architecture",
    title: "Cloud Architecture",
    blurb: "Drag 1,400+ AWS, Azure & GCP icons. Snap, connect, label, export.",
    bullets: ["1,400+ official cloud icons", "Smart snapping & routing", "PNG / SVG / JSON export"],
    icon: Boxes,
    ready: true,
    href: "/diagrammatic",
    accent: "from-violet-500 to-fuchsia-500",
  },
  {
    id: "flowchart",
    title: "Flowcharts",
    blurb: "Process diagrams, decision trees, swimlanes — built for clarity.",
    bullets: ["BPMN-friendly shapes", "Auto-layout", "Branch & merge logic"],
    icon: Workflow,
    ready: false,
    href: "/diagrammatic?mode=flowchart",
    accent: "from-sky-500 to-cyan-500",
  },
  {
    id: "mindmap",
    title: "Mind Maps",
    blurb: "Capture ideas radially. Re-organize without losing the thread.",
    bullets: ["Radial auto-layout", "Collapse / expand branches", "Color-coded themes"],
    icon: Brain,
    ready: false,
    href: "/diagrammatic?mode=mindmap",
    accent: "from-orange-500 to-rose-500",
  },
  {
    id: "sequence",
    title: "Sequence Diagrams",
    blurb: "Lifelines, async messages, activations. Then animate it as a GIF.",
    bullets: ["Sync & async arrows", "Activation bars", "Animated playback to GIF"],
    icon: GitBranch,
    ready: false,
    href: "/diagrammatic?mode=sequence",
    accent: "from-emerald-500 to-teal-500",
  },
  {
    id: "er",
    title: "ER Diagrams",
    blurb: "Model your schema. Generate SQL. Reverse-engineer existing DBs.",
    bullets: ["Crow's-foot notation", "SQL DDL export", "Postgres / MySQL / SQLite"],
    icon: Database,
    ready: false,
    href: "/diagrammatic?mode=er",
    accent: "from-indigo-500 to-violet-500",
  },
  {
    id: "uml",
    title: "UML Class Diagrams",
    blurb: "Classes, interfaces, generalization. Sync to TypeScript and Java.",
    bullets: ["All 14 UML diagram types", "Round-trip to code", "Stereotype support"],
    icon: Layers,
    ready: false,
    href: "/diagrammatic?mode=uml",
    accent: "from-pink-500 to-rose-500",
  },
  {
    id: "whiteboard",
    title: "Whiteboard",
    blurb: "Sketch freely. Sticky notes. Hand-drawn vibe. Real-time cursors.",
    bullets: ["Excalidraw-class drawing", "Sticky notes & frames", "Live multiplayer (soon)"],
    icon: PenTool,
    ready: false,
    href: "/diagrammatic?mode=whiteboard",
    accent: "from-amber-500 to-orange-500",
  },
  {
    id: "kanban",
    title: "Kanban / Sprint Board",
    blurb: "Lightweight board with columns, swimlanes, WIP limits.",
    bullets: ["Drag-and-drop columns", "WIP limits", "Sprint velocity chart"],
    icon: ListChecks,
    ready: false,
    href: "/diagrammatic?mode=kanban",
    accent: "from-lime-500 to-green-500",
  },
  {
    id: "system",
    title: "System Diagrams",
    blurb: "C4, network topology, microservices — engineer-grade clarity.",
    bullets: ["C4 model templates", "Network shapes", "Container & component views"],
    icon: Cpu,
    ready: false,
    href: "/diagrammatic?mode=system",
    accent: "from-blue-500 to-indigo-500",
  },
];

export const HERO_PROMPTS = [
  "A serverless image-resize pipeline on AWS",
  "Multi-region active-active Postgres on Azure",
  "Event-driven order workflow with Kafka & GCP",
  "Mind map for our Q1 product launch",
  "Sequence diagram of an OAuth 2.0 PKCE flow",
];

export const HERO_CHIPS = [
  "Cloud architecture",
  "Flowchart",
  "Mind map",
  "Sequence",
  "ER model",
  "Whiteboard",
];

export type AITool = {
  title: string;
  blurb: string;
  icon: LucideIcon;
  accent: string;
};

export const AI_TOOLS: AITool[] = [
  { title: "Diagram from prompt", blurb: "Describe a system, get a diagram you can edit.", icon: Sparkles, accent: "from-violet-500 to-fuchsia-500" },
  { title: "Auto-layout", blurb: "One click to clean up any messy canvas.", icon: Wand2, accent: "from-sky-500 to-cyan-500" },
  { title: "Explain this diagram", blurb: "Plain-English summary your team will actually read.", icon: FileText, accent: "from-emerald-500 to-teal-500" },
  { title: "Image to diagram", blurb: "Upload a whiteboard photo — get an editable canvas.", icon: ImageIcon, accent: "from-orange-500 to-rose-500" },
  { title: "Code to diagram", blurb: "Paste Terraform, Bicep, or k8s YAML — see the topology.", icon: Cpu, accent: "from-indigo-500 to-violet-500" },
  { title: "Diagram to code", blurb: "Generate Terraform / Bicep / Mermaid from your design.", icon: Network, accent: "from-pink-500 to-rose-500" },
  { title: "Animated request flows", blurb: "Turn any sequence into a GIF, like the AI-Gateway labs.", icon: Zap, accent: "from-amber-500 to-orange-500" },
  { title: "Chat with your canvas", blurb: "Ask 'what fails if region us-east-1 goes down?'", icon: MessagesSquare, accent: "from-lime-500 to-green-500" },
  { title: "Cost estimator", blurb: "AI-priced from your architecture. Roadmap.", icon: Calculator, accent: "from-blue-500 to-indigo-500" },
];

export const REPLACED_APPS = [
  "Lucidchart",
  "Miro",
  "Visio",
  "draw.io",
  "Whimsical",
  "Excalidraw",
  "FigJam",
  "Mural",
  "ChatGPT (for diagrams)",
  "Gliffy",
  "Cacoo",
  "SmartDraw",
];

export const TRUST_LOGOS = [
  "Acme Cloud",
  "Northwind",
  "Contoso",
  "Initech",
  "Globex",
  "Stark Labs",
  "Wayne Inc",
  "Umbrella",
];

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  company: string;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "We replaced three diagramming tools with one canvas. Architecture reviews used to take a week — now it's a Friday afternoon.",
    name: "Priya Shah",
    role: "Principal Cloud Architect",
    company: "Northwind",
  },
  {
    quote:
      "The 'diagram from prompt' feature is genuinely good. Our SAs ship customer architectures in minutes, not days.",
    name: "Marcus Lee",
    role: "Director, Solutions Engineering",
    company: "Contoso",
  },
  {
    quote:
      "Finally a whiteboard, a flowchart tool, and a real cloud-architecture editor in the same tab. My toolbar thanks you.",
    name: "Elena Rossi",
    role: "Staff Engineer",
    company: "Globex",
  },
  {
    quote:
      "Animated request flows for our gateway docs used to be a video editor job. Diagrammatic exports them as GIFs in one click.",
    name: "Jordan Kim",
    role: "DevRel Lead",
    company: "Stark Labs",
  },
];

export const TRUST: { title: string; blurb: string; icon: LucideIcon }[] = [
  { title: "Encrypted in transit & at rest", blurb: "TLS 1.3 everywhere. AES-256 on disk. Per-tenant keys on roadmap.", icon: Lock },
  { title: "GitHub OAuth & SSO", blurb: "Sign in with GitHub today. SAML / OIDC SSO on enterprise plan.", icon: ShieldCheck },
  { title: "Self-host friendly", blurb: "Open-source core. Bring your own Postgres. Run on your own Azure / AWS.", icon: Server },
];

export const TEMPLATE_PREVIEW = [
  { title: "3-tier web app on Azure", tag: "Architecture", accent: "from-violet-500 to-fuchsia-500" },
  { title: "Serverless image pipeline (AWS)", tag: "Architecture", accent: "from-sky-500 to-cyan-500" },
  { title: "Event-driven orders (GCP)", tag: "Architecture", accent: "from-emerald-500 to-teal-500" },
  { title: "OAuth 2.0 PKCE flow", tag: "Sequence", accent: "from-orange-500 to-rose-500" },
  { title: "Org chart — engineering", tag: "Mind map", accent: "from-indigo-500 to-violet-500" },
  { title: "E-commerce DB schema", tag: "ER", accent: "from-pink-500 to-rose-500" },
  { title: "Sprint board template", tag: "Kanban", accent: "from-amber-500 to-orange-500" },
  { title: "C4 container view", tag: "System", accent: "from-blue-500 to-indigo-500" },
];

export const FOOTER_LINKS = {
  Product: [
    { label: "Cloud architecture", href: "/diagrammatic" },
    { label: "Flowcharts", href: "/diagrammatic?mode=flowchart" },
    { label: "Mind maps", href: "/diagrammatic?mode=mindmap" },
    { label: "Whiteboard", href: "/diagrammatic?mode=whiteboard" },
  ],
  Resources: [
    { label: "Templates", href: "#templates" },
    { label: "Documentation", href: "/docs" },
    { label: "Changelog", href: "/changelog" },
    { label: "Roadmap", href: "/roadmap" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Open source", href: "https://github.com/sauravraghuvanshi/architecture-playground" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ],
};

export const STATS = [
  { value: "1,400+", label: "Cloud icons" },
  { value: "9", label: "Diagram modes" },
  { value: "MIT / Apache-2.0", label: "Open core" },
  { value: "0", label: "Vendor lock-in" },
];
