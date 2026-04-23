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

## Migration Plan (pending)

The scaffold is in place. Remaining work to bring the playground online:

### Phase 1 — Code & asset migration
1. **Copy components** from `portfolio/components/playground/` → `architecture-playground/components/playground/` (verbatim — no logic changes)
2. **Copy `app/playground/PlaygroundClient.tsx`** → `architecture-playground/app/PlaygroundClient.tsx`
3. **Replace** `architecture-playground/app/page.tsx` placeholder with the real implementation from `portfolio/app/playground/page.tsx`
4. **Copy `e2e/playground.spec.ts`** → `architecture-playground/e2e/playground.spec.ts` (update base URL)
5. **Copy `content/cloud-icons.json` source script + content** — actually only the SVGs in `public/cloud-icons/` are checked in; `content/cloud-icons.json` is regenerated
6. **Copy `public/cloud-icons/`** (the SVG asset library) and `public/playground/gif-encoder.worker.js` if it's hand-written (else regenerated)
7. **Copy `content/playground-templates/*.json`**
8. **Copy `scripts/build-cloud-icon-manifest.mjs`, `scripts/bundle-gifenc-worker.mjs`, `scripts/postbuild.mjs`, `scripts/test-playground.mjs`** (and any other playground-only scripts)
9. **Copy `playwright.config.ts`** and tweak for the new project

### Phase 2 — Local validation
1. `npm install`
2. `npm run build:icon-manifest`
3. `npm run dev` → verify at `http://localhost:3000`
4. `NEXT_TURBOPACK=0 npx next build` must pass
5. `npx playwright test` must pass

### Phase 3 — Repo + infra
1. Create GitHub repo `sauravraghuvanshi/architecture-playground` (public)
2. `git init` + first commit + push
3. Provision Azure App Service `architecture-playground` (commands above)
4. Set app settings + GitHub secrets
5. Push → watch deploy → smoke test live

### Phase 4 — Portfolio cleanup
1. In `portfolio` repo, **remove** `app/playground/`, `components/playground/`, `public/cloud-icons/`, `public/playground/`, `content/playground-templates/`, `content/cloud-icons.json`, `scripts/build-cloud-icon-manifest.mjs`, `scripts/bundle-gifenc-worker.mjs`, `scripts/test-playground.mjs`, `e2e/playground.spec.ts`
2. **Trim `package.json` deps** that are now playground-only: `@xyflow/react`, `gifenc`, `html-to-image` (verify nothing else uses them first via `grep`)
3. **Update `prebuild` script** in `portfolio/package.json` — remove `build-cloud-icon-manifest.mjs` and `bundle-gifenc-worker.mjs` calls
4. **Update `components/layout/Navigation.tsx`** — change the `/playground` internal link to an external link to `https://architecture-playground.azurewebsites.net` (open in new tab, with appropriate `rel="noopener noreferrer"`)
5. **Update `app/sitemap.ts`** — remove `/playground` route
6. **Update portfolio `README.md`** + `.claude/project-memory.md` to reflect the externalization
7. Build + verify portfolio + push → live verify

### Phase 5 — Polish (post-launch)
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
