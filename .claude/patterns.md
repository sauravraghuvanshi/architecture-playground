# Code Patterns — Architecture Playground

> Concrete, copy-pasteable templates. Follow these — don't invent your own.

---

## 1. React Flow custom node

All service / group / sticky nodes follow this shape. See `components/playground/nodes/ServiceNode.tsx`.

```tsx
"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ServiceNodeData } from "../lib/types";

// Stable className lookup — never interpolate Tailwind classes
const cloudRing: Record<string, string> = {
  azure: "ring-[color:var(--color-azure)]",
  aws:   "ring-[color:var(--color-aws)]",
  gcp:   "ring-[color:var(--color-gcp)]",
};

function ServiceNodeImpl({ data, selected }: NodeProps<{ data: ServiceNodeData & { iconPath?: string } }>) {
  return (
    <div
      className={[
        "rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-2 shadow-soft",
        "flex flex-col items-center gap-1 min-w-[88px]",
        selected ? `ring-2 ring-offset-2 ${cloudRing[data.cloud]}` : "",
      ].join(" ")}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2" />
      {data.iconPath ? (
        <img src={data.iconPath} alt="" width={32} height={32} draggable={false} />
      ) : (
        <div className="w-8 h-8 rounded bg-zinc-200 dark:bg-zinc-800" />
      )}
      <span className="text-xs text-zinc-700 dark:text-zinc-200 max-w-[120px] truncate">{data.label}</span>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2" />
    </div>
  );
}

// CRITICAL: memo the node so React Flow doesn't re-render it on every parent state change.
export const ServiceNode = memo(ServiceNodeImpl);
```

**Rules:**
- Always `memo()` exported nodes
- Two `<Handle>`s minimum (target + source) — even on terminal nodes; otherwise users can't connect to them
- `draggable={false}` on `<img>` so the SVG doesn't trigger native image drag
- `data.iconPath` is hydrated by the parent (`Playground.tsx` `graphToFlow()`) — not stored in the persisted node

---

## 2. Stable `nodeTypes` / `edgeTypes` (module scope)

```tsx
import { ServiceNode } from "./nodes/ServiceNode";
import { GroupNode } from "./nodes/GroupNode";
import { StickyNoteNode } from "./nodes/StickyNoteNode";
import { LabeledEdge } from "./edges/LabeledEdge";

// MUST be at module scope (or memoized with []) — defining inline in JSX recreates the object every render and tanks performance.
const nodeTypes = {
  service: ServiceNode,
  group: GroupNode,
  sticky: StickyNoteNode,
};

const edgeTypes = {
  labeled: LabeledEdge,
};

export function Canvas() {
  return <ReactFlow nodeTypes={nodeTypes} edgeTypes={edgeTypes} ... />;
}
```

---

## 3. History reducer pattern (undo/redo)

`components/playground/lib/history.ts` — pure state machine over `PlaygroundGraph`:

```ts
export interface HistoryState {
  past: PlaygroundGraph[];
  present: PlaygroundGraph;
  future: PlaygroundGraph[];
}

export type HistoryAction =
  | { type: "SET"; graph: PlaygroundGraph }       // push present → past, set new present, clear future
  | { type: "UNDO" }                              // pop past → present (push old present to future)
  | { type: "REDO" }                              // pop future → present (push old present to past)
  | { type: "RESET"; graph: PlaygroundGraph };    // clear all history, set new present

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState { /* ... */ }

export const initialHistory = (graph: PlaygroundGraph): HistoryState => ({ past: [], present: graph, future: [] });
export const canUndo = (s: HistoryState) => s.past.length > 0;
export const canRedo = (s: HistoryState) => s.future.length > 0;

// Snapshot helper — used by callers to commit a meaningful change to history
export const snapshotGraph = (nodes: Node[], edges: Edge[]): PlaygroundGraph => ({ nodes: nodes.map(serializeNode), edges: edges.map(serializeEdge) });
```

**Rules:**
- Never mutate `state.present` — always return a new object
- Cap `past` at 50 entries to bound memory (drop the oldest)
- Snapshots happen on **meaningful** events: drop, delete, label edit on blur, paste — NOT on every drag tick

---

## 4. Autosave hook

`components/playground/hooks/useAutosave.ts`:

```ts
import { useEffect, useRef } from "react";
import type { PlaygroundGraph } from "../lib/types";

const STORAGE_KEY = "architecture-playground:v1";
const DEBOUNCE_MS = 800;

export function useAutosave(graph: PlaygroundGraph, enabled = true) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), graph }));
      } catch {
        /* quota exceeded etc — silent */
      }
    }, DEBOUNCE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [graph, enabled]);
}

export function restoreAutosave(): PlaygroundGraph | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1) return null;        // schema mismatch — bail (or migrate)
    return parsed.graph as PlaygroundGraph;
  } catch {
    return null;
  }
}
```

**Rules:**
- Debounce ≥ 500ms (don't write on every keystroke)
- Always wrap `localStorage` access in try/catch (quota / privacy mode)
- Always check the `version` field — strict equality, no `>=` games

---

## 5. Sequence player hook

`components/playground/hooks/useSequencePlayer.ts`:

```ts
export function useSequencePlayer(edges: Edge[], options: { stepDurationMs?: number } = {}) {
  const stepMs = options.stepDurationMs ?? 800;
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const sequenceEdges = useMemo(
    () => edges.filter(e => typeof e.data?.step === "number").sort((a, b) => (a.data!.step! - b.data!.step!)),
    [edges]
  );

  useEffect(() => {
    if (!isPlaying || sequenceEdges.length === 0) return;
    const id = setInterval(() => {
      setActiveStep(prev => {
        if (prev === null) return sequenceEdges[0].data!.step!;
        const idx = sequenceEdges.findIndex(e => e.data!.step === prev);
        const next = sequenceEdges[idx + 1];
        if (!next) { setIsPlaying(false); return null; }
        return next.data!.step!;
      });
    }, stepMs);
    return () => clearInterval(id);
  }, [isPlaying, stepMs, sequenceEdges]);

  return { activeStep, isPlaying, setIsPlaying, totalSteps: sequenceEdges.length };
}
```

**Rules:**
- The hook owns *which* step is active; rendering of the active edge is delegated to the edge component (it reads activeStep from context or props)
- `clearInterval` in cleanup — never let a stale interval survive remount
- `sequenceEdges` recomputed via `useMemo` so playback survives unrelated edge edits

---

## 6. Export pattern (PNG / JSON / GIF)

`components/playground/lib/export.ts` — three pure functions returning `Promise<Blob>` (or triggering download):

```ts
export async function exportPng(node: HTMLElement, filename = "diagram.png"): Promise<void> {
  await waitForLayout();
  const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2 });
  triggerDownload(dataUrl, filename);
}

export function exportJson(graph: PlaygroundGraph, filename = "diagram.json"): void {
  const blob = new Blob([JSON.stringify({ version: 1, graph }, null, 2)], { type: "application/json" });
  triggerDownload(URL.createObjectURL(blob), filename);
}

export interface GifFrameDriver {
  totalFrames: number;
  setFrame(index: number): Promise<void>;   // mutates the React Flow state to render frame `index`
}

export async function exportGif(node: HTMLElement, driver: GifFrameDriver, filename = "diagram.gif"): Promise<void> {
  const worker = new Worker("/playground/gifenc.bundle.js");
  for (let i = 0; i < driver.totalFrames; i++) {
    await driver.setFrame(i);
    await waitForLayout();
    const dataUrl = await toPng(node, { cacheBust: false, pixelRatio: 1 });
    worker.postMessage({ type: "frame", index: i, dataUrl });
  }
  worker.postMessage({ type: "finish" });
  // ... await worker `done` message → triggerDownload
}

const waitForLayout = () => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
```

**Rules:**
- Always `waitForLayout()` before `toPng`
- GIF encoding goes to the worker — never inline
- All exports return / trigger downloads via `triggerDownload(url, filename)` — single helper for browser quirks

---

## 7. Validate imported JSON (Zod)

`components/playground/lib/validate.ts`:

```ts
import { z } from "zod";

const positionSchema = z.object({ x: z.number(), y: z.number() });

const serviceNodeSchema = z.object({
  id: z.string(),
  type: z.literal("service"),
  position: positionSchema,
  data: z.object({ iconId: z.string(), label: z.string(), cloud: z.enum(["azure", "aws", "gcp"]) }),
  parentId: z.string().optional(),
});

// ... groupNode, stickyNode, edge schemas

export const playgroundGraphSchema = z.object({
  nodes: z.array(z.discriminatedUnion("type", [serviceNodeSchema, /* ... */])),
  edges: z.array(/* ... */),
});

export function validateImportedGraph(raw: unknown): { ok: true; graph: PlaygroundGraph } | { ok: false; error: string } {
  const result = playgroundGraphSchema.safeParse(raw);
  if (!result.success) return { ok: false, error: result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") };
  return { ok: true, graph: result.data };
}
```

**Rules:**
- Validate **everything** that crosses an external boundary (file import, localStorage hydrate, URL share param)
- Use `z.discriminatedUnion` on `type` so node-type-specific data is type-checked
- Surface a human-readable error string back to the UI — never silently drop invalid imports

---

## 8. Server page → client wrapper pattern (ssr:false for React Flow)

`app/page.tsx` (server):

```tsx
import fs from "node:fs/promises";
import path from "node:path";
import { PlaygroundClient } from "./PlaygroundClient";

export default async function PlaygroundPage() {
  const [icons, templates] = await Promise.all([loadIcons(), loadTemplates()]);
  return <PlaygroundClient icons={icons} templates={templates} />;
}
```

`app/PlaygroundClient.tsx` (client):

```tsx
"use client";

import dynamic from "next/dynamic";
import type { IconManifestEntry, PlaygroundTemplate } from "@/components/playground/lib/types";

// React Flow touches `window` in its initialiser → must be ssr:false
const Playground = dynamic(() => import("@/components/playground/Playground").then(m => m.Playground), {
  ssr: false,
  loading: () => <div className="h-screen grid place-items-center text-sm text-zinc-500">Loading playground…</div>,
});

interface Props { icons: IconManifestEntry[]; templates: PlaygroundTemplate[] }
export function PlaygroundClient(props: Props) { return <Playground {...props} />; }
```

**Rules:**
- Server page does **all** filesystem reads (icons, templates) — never in client
- React Flow surface always loaded via `dynamic(... { ssr: false })` — it crashes during SSR
- Loading fallback should preserve viewport height to prevent layout shift

---

## 9. Tailwind v4 token pattern

All design tokens in `app/globals.css` under `@theme`. The `tailwind.config.ts` is a minimal IDE stub.

```css
@import "tailwindcss";

@theme {
  --color-brand-50:  #f8fafc;
  /* ... full slate scale ... */
  --color-brand-950: #020617;

  --color-azure: #0078d4;
  --color-aws:   #ff9900;
  --color-gcp:   #4285f4;
}

@variant dark (&:where(.dark, .dark *));
```

Usage:
```tsx
<div className="bg-brand-50 dark:bg-brand-950 text-brand-900 dark:text-brand-50" />
<div className="ring-[color:var(--color-azure)]" />
```

---

## 10. Web worker bundle script (esbuild)

`scripts/bundle-gifenc-worker.mjs`:

```js
import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["scripts/worker-entry/gifenc.ts"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  outfile: "public/playground/gifenc.bundle.js",
  minify: true,
  banner: { js: "/* gifenc worker bundle — generated, do not edit */" },
});
```

**Rules:**
- IIFE format — workers don't get ESM by default in older browsers
- Output path must be under `public/` so Next.js serves it as a static asset
- Re-run on every build via `prebuild` script in `package.json`

---

## Quick Reference: File Locations

| Pattern | Template File |
|---|---|
| Custom node | `components/playground/nodes/ServiceNode.tsx` |
| Custom edge | `components/playground/edges/LabeledEdge.tsx` |
| History reducer | `components/playground/lib/history.ts` |
| Autosave hook | `components/playground/hooks/useAutosave.ts` |
| Sequence player | `components/playground/hooks/useSequencePlayer.ts` |
| Exporters | `components/playground/lib/export.ts` |
| Zod validators | `components/playground/lib/validate.ts` |
| Server page | `app/page.tsx` |
| Client wrapper | `app/PlaygroundClient.tsx` |
| Tailwind tokens | `app/globals.css` |
| Worker bundler | `scripts/bundle-gifenc-worker.mjs` |
