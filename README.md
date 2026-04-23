# Architecture Playground

> Interactive multi-cloud architecture diagram editor. Drag-and-drop Azure / AWS / GCP service icons onto a canvas, connect them with labelled edges, define a numbered request sequence, and export to PNG, JSON, or animated GIF.

**Stack:** Next.js 16 (App Router) · TypeScript · React 19 · Tailwind CSS v4 · React Flow (`@xyflow/react`) · Framer Motion · `gifenc` (worker-based GIF encoding) · `html-to-image`

**Origin:** Extracted from [`sauravraghuvanshi/portfolio`](https://github.com/sauravraghuvanshi/portfolio) (commit `f3274cb`, April 2026) into a standalone app for independent iteration and deployment.

---

## Quick start

```bash
npm install
npm run build:icon-manifest   # generates content/cloud-icons.json from public/cloud-icons/
npm run dev                   # http://localhost:3000
```

Open `http://localhost:3000` — the playground is the whole app at the root route.

---

## Project layout

```
architecture-playground/
├── app/
│   ├── layout.tsx              ← root layout (theme init + globals)
│   ├── page.tsx                ← server component: loads icons + templates
│   ├── PlaygroundClient.tsx    ← client wrapper (ssr:false React Flow shell)
│   └── globals.css             ← Tailwind v4 @theme tokens
├── components/playground/
│   ├── Playground.tsx          ← top-level state + reducer wiring
│   ├── Canvas.tsx              ← React Flow surface
│   ├── Palette.tsx             ← left sidebar (icon search + drag source)
│   ├── Inspector.tsx           ← right sidebar (selected element editor)
│   ├── Outline.tsx             ← collapsible structural overview
│   ├── Toolbar.tsx             ← top action bar (export / play / undo / redo)
│   ├── PlaygroundUIContext.tsx ← ephemeral UI state (selection, playback)
│   ├── nodes/                  ← ServiceNode · GroupNode · StickyNoteNode
│   ├── edges/                  ← LabeledEdge
│   ├── hooks/                  ← useAutosave · useSequencePlayer
│   └── lib/
│       ├── types.ts            ← PlaygroundGraph, IconManifest, etc.
│       ├── history.ts          ← undo/redo reducer
│       ├── storage.ts          ← localStorage payload schema
│       ├── sequence.ts         ← auto/normalize step numbers
│       ├── validate.ts         ← guard imported JSON
│       └── export.ts           ← PNG / JSON / GIF emitters
├── content/
│   ├── cloud-icons.json        ← generated icon manifest (gitignored)
│   └── playground-templates/   ← seed diagrams (.json files)
├── public/
│   ├── cloud-icons/            ← Azure / AWS / GCP SVG service icons
│   └── playground/             ← gifenc.bundle.js worker (generated)
├── scripts/
│   ├── build-cloud-icon-manifest.mjs
│   ├── bundle-gifenc-worker.mjs
│   ├── postbuild.mjs           ← copy public/ + .next/static/ into standalone/
│   └── test-playground.mjs
├── e2e/
│   └── playground.spec.ts      ← Playwright smoke
└── .claude/                    ← agent workspace (project-memory, lessons, patterns, architecture)
```

---

## Build & deploy

This app uses Next.js `output: "standalone"`. The build pipeline is identical to the parent portfolio:

```
next build → .next/standalone/server.js (self-contained)
postbuild  → copies public/ + .next/static/ into .next/standalone/
zip standalone → deploy via Kudu zipdeploy (or container platform of choice)
```

Standalone keeps the deploy zip small (~30 MB) and dependency-free at runtime.

---

## Status

✅ **Live** at [architecture-playground.azurewebsites.net](https://architecture-playground.azurewebsites.net)

- ✅ All components migrated from portfolio (19 files)
- ✅ 107 cloud service SVG icons (Azure / AWS / GCP)
- ✅ 4 seed templates
- ✅ PNG / JSON / animated GIF export
- ✅ CI/CD via GitHub Actions → Azure Kudu zipdeploy
- ✅ Lint clean, build passes, 12 unit tests pass
- ⏳ Portfolio cleanup (remove old playground code from parent repo)
