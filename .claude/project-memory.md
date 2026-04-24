# Project Memory — Architecture Playground

> Persistent project context. Update at the end of every session. Read at the start of every session.

---

## Project Identity

| Field | Value |
|---|---|
| **Name** | Architecture Playground |
| **Owner** | Saurav Raghuvanshi (sauravraghuvanshi24@gmail.com) |
| **Description** | Standalone, browser-based, multi-cloud architecture diagram editor with drag-and-drop service icons (Azure / AWS / GCP), connectable edges with sequence numbers, animated request playback, and PNG / JSON / animated GIF export. |
| **Repo (planned)** | `sauravraghuvanshi/architecture-playground` |
| **Live URL (planned)** | `https://architecture-playground.azurewebsites.net` |
| **Local path** | `C:\Users\sraghuvanshi\Downloads\My-Projects\Architecture-Playground\` |
| **Origin** | Extracted 2026-04-23 from `sauravraghuvanshi/portfolio` commit `f3274cb` ("feat(playground): Architecture Playground + Labs nav grouping") |

---

## Tech Stack

| Layer | Detail |
|---|---|
| Framework | Next.js 16.2.2 (App Router) · TypeScript · React 19 · `output: "standalone"` |
| Styling | Tailwind CSS v4 (CSS-first: `@theme` tokens in `app/globals.css`) |
| Canvas | `@xyflow/react` (React Flow v12) |
| Animation | Framer Motion 12 (UI transitions); custom request-flow animation built on React Flow edge updates |
| Export | `html-to-image` (PNG / SVG capture) · `gifenc` in a web worker (animated GIF) |
| Persistence | `localStorage` keyed `architecture-playground:v1` (Zod-validated payload) |
| Icons | SVG manifests under `public/cloud-icons/{azure,aws,gcp}/{category}/{slug}.svg`; generated index at `content/cloud-icons.json` |
| Templates | `content/playground-templates/*.json` (seed graphs, multi-cloud) |
| Deployment | Azure App Service (Linux, Node 20 LTS), planned tier F1 Free |
| CI/CD | GitHub Actions → Kudu zip-deploy (mirrors portfolio pipeline) |
| Testing | Playwright (E2E) · `node --test` for pure-logic unit tests on `lib/` |

---

## Repository Structure (target — populated incrementally)

```
architecture-playground/
├── .claude/                 ← Project context (this file lives here)
│   ├── CLAUDE.md            ← Workflow rules (auto-read by Claude Code)
│   ├── project-memory.md    ← THIS FILE
│   ├── lessons.md           ← Carried-over + playground-specific lessons
│   ├── patterns.md          ← React Flow / exporter / history reducer patterns
│   └── architecture.md      ← Design decisions & rationale
├── .github/
│   ├── copilot-instructions.md
│   └── workflows/deploy.yml ← CI/CD pipeline (Kudu zipdeploy)
├── app/
│   ├── layout.tsx           ← Root layout with theme init + Geist font
│   ├── page.tsx             ← Server component: loads icons + templates → <PlaygroundClient />
│   ├── PlaygroundClient.tsx ← Client wrapper (ssr:false dynamic import of <Playground />)
│   └── globals.css          ← Tailwind v4 @theme tokens + React Flow surface styles
├── components/playground/
│   ├── Playground.tsx       ← Top-level state + reducer wiring
│   ├── Canvas.tsx           ← React Flow surface
│   ├── Palette.tsx          ← Left sidebar (icon search + drag source)
│   ├── Inspector.tsx        ← Right sidebar (selected element editor)
│   ├── Outline.tsx          ← Collapsible structural overview
│   ├── Toolbar.tsx          ← Top action bar (export / play / undo / redo / import / save)
│   ├── PlaygroundUIContext.tsx ← Ephemeral UI state (selection, playback, placement)
│   ├── nodes/               ← ServiceNode · GroupNode · StickyNoteNode
│   ├── edges/               ← LabeledEdge
│   ├── hooks/               ← useAutosave · useSequencePlayer
│   └── lib/
│       ├── types.ts         ← PlaygroundGraph, IconManifest, etc.
│       ├── history.ts       ← Undo/redo reducer
│       ├── storage.ts       ← localStorage payload schema (Zod)
│       ├── sequence.ts      ← Auto/normalize step numbers
│       ├── validate.ts      ← Guard imported JSON
│       └── export.ts        ← PNG / JSON / GIF emitters (worker driver)
├── content/
│   ├── cloud-icons.json     ← Generated icon manifest (gitignored — built on prebuild)
│   └── playground-templates/← Seed diagrams (.json files committed)
├── public/
│   ├── cloud-icons/         ← Azure / AWS / GCP SVG service icons
│   └── playground/          ← gifenc.bundle.js worker (gitignored — built on prebuild)
├── scripts/
│   ├── build-cloud-icon-manifest.mjs  ← Walks public/cloud-icons/ → content/cloud-icons.json
│   ├── bundle-gifenc-worker.mjs       ← esbuild gifenc → IIFE worker bundle in public/playground/
│   ├── postbuild.mjs                  ← Copy public/ + .next/static/ into .next/standalone/
│   └── test-playground.mjs            ← node --test for pure lib/ functions
├── task/                    ← LOCAL ONLY (gitignored) — planning, roadmaps, work tracking
│   ├── implementation.md    ← Enterprise roadmap (8 phases, 150+ tasks)
│   └── implementation.html  ← Interactive HTML viewer for the roadmap
├── Sample-Architecture/     ← LOCAL ONLY (gitignored) — reference pptx, V-4.5 icon stencils
├── e2e/
│   └── playground.spec.ts             ← Playwright smoke
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── .gitignore
├── .env.example
└── README.md
```

---

## Routes

| Route | Component | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Architecture Playground (the whole app) |
| `/sitemap.xml` (planned) | `app/sitemap.ts` | Optional once we have multiple routes |
| `/robots.txt` (planned) | `app/robots.ts` | Optional |

The playground is intentionally a **single-page app** at `/`. No subpages, no admin panel, no auth — this is a free public tool.

---

## Azure Infrastructure (PROPOSED — confirm before provisioning)

| Resource | Value |
|---|---|
| Subscription | `60e58e3f-da14-4fa7-89dd-3d0369ddbc8b` (Visual Studio Enterprise — same as portfolio) |
| Resource Group | `rg-architecture-playground` (Central India) — separate from portfolio |
| App Service Plan | `asp-architecture-playground` (Linux, F1 Free) — dedicated plan in own resource group |
| App Service | `architecture-playground` (Linux, Node 20 LTS) |
| URL | `https://architecture-playground.azurewebsites.net` |
| Storage | None required (no images, no media uploads) |
| Auth | None — public app |

### App Service settings (required)

- `SCM_DO_BUILD_DURING_DEPLOYMENT=false` (we deploy pre-built standalone)
- `WEBSITE_NODE_DEFAULT_VERSION=~20`
- `NODE_ENV=production`
- `NEXT_PUBLIC_SITE_URL=https://architecture-playground.azurewebsites.net`
- (Optional) `NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING=<conn>` if reusing the portfolio App Insights

### CI/CD secrets (GitHub Actions)

- `AZURE_DEPLOY_USER` — Kudu ZipDeploy `userName` (starts with `$`)
- `AZURE_DEPLOY_PASSWORD` — Kudu ZipDeploy `userPWD`

Get them via:
```powershell
$creds = az webapp deployment list-publishing-profiles `
  --resource-group rg-saurav-portfolio `
  --name architecture-playground `
  --query "[?publishMethod=='ZipDeploy']" -o json | ConvertFrom-Json
$creds[0].userName; $creds[0].userPWD
```

### SCM auth gotcha

Azure tenant policy disables SCM basic auth by default. After App Service creation, run:
```bash
az rest --method put \
  --uri "/subscriptions/60e58e3f-da14-4fa7-89dd-3d0369ddbc8b/resourceGroups/rg-saurav-portfolio/providers/Microsoft.Web/sites/architecture-playground/basicPublishingCredentialsPolicies/scm?api-version=2023-12-01" \
  --body '{"properties":{"allow":true}}'
```

---

## CI/CD Pipeline

```
git push origin main
  → .github/workflows/deploy.yml triggers
  → ubuntu-latest runner
  → npm ci → npm run build (prebuild builds icon manifest + gifenc worker, then next build, then postbuild)
  → zip .next/standalone/ → deploy.zip
  → curl POST https://$DEPLOY_USER:$DEPLOY_PASS@architecture-playground.scm.azurewebsites.net/api/zipdeploy
  → Azure App Service auto-restarts
```

---

## Migration Plan — ✅ COMPLETE

All phases completed on **2026-04-24**.

### Phase 1 — Code & asset migration ✅
Migrated 19 components, 107 SVG icons, 4 templates, 4 scripts, e2e spec, playwright config from portfolio. Adjusted route `/playground` → `/`, fixed ESLint config, React 19 ref-during-render, postbuild cleanup.

### Phase 2 — Local validation ✅
Lint clean, `next build` passes, 12/12 unit tests pass, localhost verified.

### Phase 3 — Repo + infra ✅
- GitHub repo: [`sauravraghuvanshi/architecture-playground`](https://github.com/sauravraghuvanshi/architecture-playground)
- Azure: `rg-architecture-playground` → `asp-architecture-playground` → `architecture-playground` (Central India, F1 Free)
- CI/CD green, live at https://architecture-playground.azurewebsites.net

### Phase 4 — Portfolio cleanup ✅
- Removed all playground code, assets, deps from portfolio (commit `22fd4a5`)
- Navigation link → external URL (new tab)
- `prebuild` / `sitemap` updated
- Portfolio build passes, pushed to `main`
- Portfolio `.claude/project-memory.md` updated with Architecture Playground context

### Phase 5 — Polish (post-launch, future)
1. Add OG image + JSON-LD `WebApplication` schema
2. Wire optional Application Insights (opt-in via env var)
3. Add a custom domain if desired (planned: `play.saurav.dev` or similar — TBD)
4. Add a "Templates" gallery page if the template count grows
5. Add export to draw.io / Mermaid / Excalidraw formats (stretch)

---

## Last Session Summary

### 2026-04-24 — Full migration + first deploy

**Completed:**
- Phase 1: migrated all 19 components, 107 SVG icons, 4 templates, 4 scripts, e2e spec from portfolio
- Adjusted imports: route `/playground` → `/`, ESLint config fixed, React 19 ref-during-render fix, postbuild cleanup
- Lint clean, build passes, 12/12 unit tests pass
- Phase 3: git init, created GitHub repo `sauravraghuvanshi/architecture-playground`, pushed
- Azure infra (separate from portfolio): `rg-architecture-playground` / `asp-architecture-playground` / `architecture-playground` App Service in Central India
- CI/CD workflow deployed, first build green, live at https://architecture-playground.azurewebsites.net

**Commits:**
- `75090e8` — feat: initial migration from portfolio
- `01de7d0` — ci: add GitHub Actions deploy workflow

**Files touched:** 157 files (156 created + 1 workflow)

**Next session:**
1. Phase 4 — Portfolio cleanup (remove playground code, update nav link to external URL)
2. Phase 5 — Polish (OG image, JSON-LD, optional App Insights)
