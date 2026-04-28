# Architecture Playground

> A free, open-source, browser-based **multi-mode diagram workspace** — architect cloud systems, sketch flowcharts, mind-map ideas, plan sprints on a Kanban board, and free-draw on a whiteboard, all in one IDE-grade UI. No sign-in. No tracking. Local-first.

**Live:** [architecture-playground.azurewebsites.net](https://architecture-playground.azurewebsites.net)

---

## What it does

Architecture Playground is a single workspace with **9 diagram modes** sharing one toolbar, command palette, and persistence layer:

| Mode | Engine | What it's for |
|---|---|---|
| **Cloud Architecture** | maxGraph + 1,400 cloud icons (Azure / AWS / GCP) | Real architecture diagrams with snap-to-grid, groups, labelled edges, sequence playback |
| **Flowchart** | React Flow | Decision flows, processes, BPMN-lite |
| **Mind Map** | React Flow | Brainstorming, knowledge trees |
| **Sequence Diagram** | React Flow | Request flows, lifelines |
| **ER Diagram** | React Flow | Database schemas |
| **UML** | React Flow | Class/component diagrams |
| **C4 / System** | React Flow | Context / container / component models |
| **Kanban Board** | dnd-kit | Sprint planning with cross-diagram link chips |
| **Whiteboard** | Excalidraw (embedded) | Free-form sketching, AI image insertion, `libraries.excalidraw.com` library imports |

Other surfaces:

- **`/`** — project hub. Quick prompt → AI generate, mode tiles, recent diagrams (localStorage), template browser.
- **`/templates`** — browseable starter gallery filterable by mode and cloud.
- **`/about`** — marketing landing page (Hero, tools, security, testimonials).
- **`/presentation`** — slide-deck view of selected diagrams.
- **`/legacy-playground`** — the original React Flow single-canvas app (kept for back-compat).

---

## Headline features

### Build
- **1,400+ cloud service icons** — Azure V21 (674), AWS (258), GCP (45), plus generic shapes. Searchable, categorised palette.
- **Builder palette + blank canvas** in every structured mode — start fresh or hydrate from a template, click tiles to add shapes.
- **Snap-to-grid, groups, labelled edges, sequence numbers, animated request playback** in architecture mode.
- **Right-click context menu, command palette (⌘K), keyboard shortcuts overlay (?), copy/paste/duplicate** (⌘C / ⌘V / ⌘D), undo/redo (⌘Z / ⌘⇧Z).

### AI (Azure OpenAI)
- **Prompt → diagram** for every mode — `gpt-4o-mini` on `ap-foundry-eastus`, validated against per-mode JSON schemas.
- **Prompt → image** in whiteboard — `gpt-image-2` on dedicated `ap-img-generator` resource (westus3), streamed over Server-Sent Events with 15s heartbeats to survive Azure App Service's 230s LB idle timeout.
- **In-app token-bucket rate limiting** (20 req/min/IP), graceful 429 surfacing.

### Whiteboard ecosystem (Excalidraw)
- **Library imports from `libraries.excalidraw.com`** — "Add to Excalidraw" deep links auto-route to whiteboard mode and merge into your library.
- **Persistent libraries** across reloads via a custom localStorage adapter (`diagrammatic.whiteboard.library`).
- **Branding stripped** — custom `<MainMenu>` with curated items, no Excalidraw socials/links block.
- **AI image generation** wired via SSE consumer with progress UI.

### Collaboration (local-first)
- **Comments + version snapshots** scoped per `${mode}:${diagramId}`, all in localStorage.
- **Cross-diagram link chips** — Kanban cards can link to nodes in other diagrams.
- Y.js / live presence intentionally parked — see `inbox_entries/phase-6-yjs-parked.md`.

### Export
- **PNG, SVG, JSON, animated GIF** (gifenc in a web worker).
- Sequence playback exports as a multi-frame GIF showing the request flow step-by-step.

### Hardening
- **CSP / HSTS / X-Frame-Options / Permissions-Policy / COOP** via `middleware.ts`.
- **MIT licensed**, Contributor Covenant 2.1 CoC, CONTRIBUTING.md.
- A11y on mode tabs (`role="tablist"` / `aria-selected` / `aria-label`).
- Lint clean, `tsc --noEmit` clean, 30 unit tests, Playwright e2e suite.

---

## Tech stack

| Layer | Detail |
|---|---|
| **Framework** | Next.js 16 (App Router, `output: "standalone"`) · TypeScript · React 19 |
| **Styling** | Tailwind CSS v4 (CSS-first `@theme` tokens) · Lucide icons (no emoji in UI chrome) |
| **Animation** | Framer Motion (all UI transitions) |
| **Diagram engines** | `@maxgraph/core` (architecture, Apache-2.0) · `@xyflow/react` (flowchart / mindmap / sequence / ER / UML / C4) · `@excalidraw/excalidraw` (whiteboard, MIT) · `@dnd-kit/core` + `sortable` (Kanban, MIT) |
| **Export** | `html-to-image` · `gifenc` (web worker) |
| **AI** | Azure OpenAI — `gpt-4o-mini` (chat) on `ap-foundry-eastus`, `gpt-image-2` (image) on `ap-img-generator` (westus3, OpenAI-compatible v1 endpoint, SSE-wrapped) |
| **Persistence** | `localStorage` (Zod-validated schema, version-bumped on changes); cloud save / DB intentionally removed |
| **Deploy** | Azure App Service (Linux, F1 Free, Central India) via GitHub Actions → Kudu zipdeploy |

---

## Quick start

```bash
git clone https://github.com/sauravraghuvanshi/architecture-playground.git
cd architecture-playground
npm install
npm run build:icon-manifest   # generates content/cloud-icons.json
npm run dev                   # http://localhost:3000
```

Open [`http://localhost:3000`](http://localhost:3000) — the hub. Pick a mode tile to enter the workspace.

### Optional: enable AI locally

Copy `.env.example` → `.env.local` and fill in:

```
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# Optional dedicated image resource (gpt-image-2 via /openai/v1)
AZURE_OPENAI_IMAGE_ENDPOINT=
AZURE_OPENAI_IMAGE_API_KEY=
AZURE_OPENAI_IMAGE_DEPLOYMENT=gpt-image-2
```

The app gracefully runs without AI configured — the Sparkles button just disables.

---

## Build & deploy

This app uses Next.js `output: "standalone"`. The pipeline:

```
next build              → .next/standalone/server.js (self-contained)
postbuild               → copies public/ + .next/static/ into standalone/
zip standalone          → ~30 MB deploy.zip
curl POST /api/zipdeploy → Azure Kudu, App Service auto-restarts
```

CI lives in `.github/workflows/deploy.yml`. Two repo secrets required: `AZURE_DEPLOY_USER` and `AZURE_DEPLOY_PASSWORD` (Kudu zipdeploy creds — note the user starts with `$`, so they must be passed via an `env:` block, not inline).

---

## Project layout

```
architecture-playground/
├── app/
│   ├── page.tsx                      ← hub
│   ├── diagrammatic/                 ← multi-mode workspace
│   ├── templates/                    ← gallery
│   ├── about/                        ← marketing landing
│   ├── presentation/                 ← slide-deck view
│   ├── legacy-playground/            ← original React Flow app
│   └── api/
│       ├── ai/
│       │   ├── status/               ← { configured: bool }
│       │   ├── generate/             ← prompt → diagram JSON
│       │   ├── image/                ← prompt → png (SSE-wrapped)
│       │   ├── describe/, review/    ← diagram → analysis
│       └── ...
├── components/
│   ├── diagrammatic/
│   │   ├── Workspace.tsx             ← top-level mode router
│   │   ├── shared/                   ← Toolbar, Palette, Inspector, StatusBar,
│   │   │                                CommandPalette, BuilderPalette,
│   │   │                                CommentsPanel, VersionsPanel,
│   │   │                                AiPromptModal, KeyboardHints
│   │   └── modes/
│   │       ├── architecture/         ← maxGraph + 1,400 icons
│   │       ├── flowchart/, mindmap/, sequence/, er/, uml/, c4/
│   │       ├── kanban/               ← dnd-kit
│   │       └── whiteboard/           ← Excalidraw + library adapter
│   ├── hub/                          ← HubHeader, QuickPrompt, ModeTiles,
│   │                                    RecentDiagrams, TemplateBrowser
│   ├── marketing/                    ← /about sections + copy
│   └── playground/                   ← legacy React Flow components
├── content/
│   ├── cloud-icons.json              ← generated icon manifest
│   └── playground-templates/         ← seed diagrams
├── public/
│   ├── cloud-icons/                  ← Azure / AWS / GCP / generic SVGs
│   └── playground/                   ← gifenc.bundle.js worker
├── scripts/
│   ├── build-cloud-icon-manifest.mjs
│   ├── bundle-gifenc-worker.mjs
│   ├── postbuild.mjs
│   └── test-playground.mjs
├── e2e/                              ← Playwright specs
├── middleware.ts                     ← CSP / security headers
├── docs/
│   └── security.md
├── LICENSE                           ← MIT
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md                ← Contributor Covenant 2.1
└── .claude/                          ← agent workspace (project memory, lessons, patterns, architecture)
```

---

## Status

✅ **Live & in active use** at [architecture-playground.azurewebsites.net](https://architecture-playground.azurewebsites.net)

**Phases shipped (`task/implementation.md`):**

- ✅ **Phase 0** — semantic graph model, schema versioning, 30 unit tests
- ✅ **Phase 1** — icon library expansion (977 → 1,400+), redesigned palette, keyboard shortcuts
- ✅ **Phase 2** — multi-mode workspace + 8 canvas scaffolds (`phase-2-modes`)
- ✅ **Phase 3** — per-mode templates + smoke tests (`phase-3-templates`)
- ✅ **Phase 4** — engine pivot to maxGraph + Excalidraw + dnd-kit (architect-first hub)
- ✅ **Phase 5** — per-mode AI generate + image stub + rate limit (`phase-5-ai`)
- ✅ **Phase 6** — local-first comments + version snapshots (`phase-6-collab-ui`); Y.js parked
- ✅ **Phase 7** — Kanban sprint metadata + cross-diagram links (`phase-7-planner`)
- ✅ **Phase 8** — security headers middleware + docs (`phase-8-hardening`)
- ✅ **Phase 9** — LICENSE, CoC, CONTRIBUTING, a11y polish (`phase-9-launch`)
- ✅ **Whiteboard ecosystem** — AI image (SSE), library imports, library persistence, branding cleanup, deep-link auto-routing
- ✅ **Builder UX** — blank canvas + builder palette across all React Flow modes

**Parked (see `inbox_entries/phase-*-parked.md`):** Y.js live collab · Postgres / SAML / SCIM / Stripe enterprise tier · marketing site · perf benchmarking.

---

## Origin

Started 2026-04-23, extracted from [`sauravraghuvanshi/portfolio`](https://github.com/sauravraghuvanshi/portfolio) (commit `f3274cb`) as a single-canvas React Flow toy. It has since become a complete multi-mode diagramming product — the React Flow extraction is preserved verbatim under `/legacy-playground`.

---

## License

[MIT](./LICENSE) — cloud service icons remain © Microsoft / Amazon / Google and are credited in the footer; everything else is freely usable.

Built by [Saurav Raghuvanshi](https://github.com/sauravraghuvanshi). Contributions welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).
