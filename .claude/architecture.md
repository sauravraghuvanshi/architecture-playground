# Architecture Decisions — Architecture Playground

> WHY things are built this way. Don't "fix" intentional decisions.

---

## 1. Standalone Next.js app (extracted from portfolio)

**Decision:** Maintain the playground as its own repo + App Service rather than a route inside the portfolio.

**Why:**
- Independent release cadence — playground iterations don't trigger portfolio rebuilds
- Heavier deps (`@xyflow/react`, `gifenc`, `html-to-image`) no longer bloat the portfolio bundle
- Portfolio's `.next/standalone/` zip drops by ~6 MB (rough estimate; React Flow + gifenc are sizeable)
- Lets the playground be linked from anywhere (talks, blog posts, social) without dragging it under the `saurav-portfolio` brand
- One thing the app does, done well — reduces cognitive load on the portfolio

**Trade-offs accepted:**
- Two repos to keep aligned on Next/React versions (mitigated by both pinning the same major versions)
- Two App Services to monitor (acceptable — both are F1 free)
- Lessons learned have to be cross-pollinated (handled by carrying over lessons in `.claude/lessons.md` § "CARRIED-OVER")

**Never:** Don't merge it back into the portfolio. The decoupling is intentional.

---

## 2. Single-page app at `/`

**Decision:** The playground IS the app. `/` renders the canvas. No multi-page navigation, no admin panel, no auth.

**Why:**
- The playground has one purpose. A homepage with a "Launch playground" CTA is friction.
- No content to manage → no admin → no auth → no NextAuth → simpler everything.
- SEO target is "interactive cloud architecture diagram tool" — a focused single page out-ranks a cluster of thin pages.

**Future:** May add `/templates` (gallery), `/share/[id]` (read-only shared diagrams) if there's demand. Keep them additive, never make `/` something else.

---

## 3. Standalone output (Next.js `output: "standalone"`)

**Decision:** Same as portfolio.

**Why:** Self-contained `server.js` + minimal `node_modules/` → small zip → Kudu zipdeploy.

**Build flow:**
1. `npm run prebuild` — build cloud-icon manifest + bundle gifenc worker
2. `next build` → `.next/standalone/`
3. `scripts/postbuild.mjs` copies `public/` and `.next/static/` into standalone
4. GitHub Actions zips standalone → uploads to Azure Kudu `/api/zipdeploy`

**Never:** Don't switch to Vercel, Oryx source build, or `npm start` deployment.

---

## 4. Azure App Service (Linux F1 Free)

**Decision:** New dedicated App Service `architecture-playground` in the existing `rg-saurav-portfolio` resource group.

**Why:**
- Same dogfooding rationale as the portfolio (owner is Azure-focused)
- F1 supports up to 10 apps per plan — reuse the existing plan, no extra cost
- Zero-state app — no DB, no Blob, no managed identity needed (no API key in code, no inbound RBAC)

**Trade-offs accepted:**
- Cold starts on F1 (acceptable for a tool people open occasionally)
- No edge / CDN caching of static assets out of the box (acceptable; static assets are small SVGs)

**Never:** Don't add Cosmos DB / SQL / Blob unless we ship server-side persistence. The localStorage-only model is intentional for v1.

---

## 5. localStorage-only persistence (no server, no accounts)

**Decision:** Diagrams persist to `localStorage`. No server roundtrip. No user accounts.

**Why:**
- Zero infra (no DB, no auth) → zero bills
- Zero privacy surface — diagrams never leave the user's browser unless they explicitly export
- Instant load, no network latency
- Aligned with the "single-purpose tool" philosophy

**Trade-offs accepted:**
- Diagrams don't sync across devices (acceptable — users can export JSON and import elsewhere)
- ~5 MB localStorage cap → graceful degradation if exceeded (silent failure with future toast notification)

**Never:** Don't add a backend "save my diagrams" feature without a *very* good reason. It opens auth, billing, abuse, GDPR — all the things this app exists to avoid.

**Schema versioning:** Every payload stamped with `version: 1`. Bump + add migration shim when fields change. See `lib/storage.ts`.

---

## 6. Tailwind v4 (CSS-first, not config-first)

**Decision:** Same as portfolio. All real tokens in `app/globals.css` under `@theme`. `tailwind.config.ts` is a minimal IDE stub.

**Why:** v4's CSS-first config is the new idiomatic approach. Keep `tailwind.config.ts` empty so future contributors don't get confused about the source of truth.

---

## 7. React Flow (`@xyflow/react`) for the canvas

**Decision:** `@xyflow/react` v12 over alternatives (Konva, fabric.js, custom SVG, draw.io embed).

**Why:**
- Best-in-class developer ergonomics for node-and-edge graphs
- Native pan/zoom/select/drag with no extra effort
- Customisable nodes / edges via React components (not opaque renderers)
- Strong TypeScript types
- Active maintenance + healthy ecosystem
- Free / MIT licensed

**Trade-offs accepted:**
- ~200 KB in the bundle (acceptable — it's the entire point of the app)
- Touches `window` in its initialiser → forces `ssr: false` dynamic import

**Never:** Don't replace it casually. A migration would touch every node, edge, and the entire interaction model.

---

## 8. GIF export via web worker (`gifenc`)

**Decision:** GIF encoding runs in a dedicated worker (`public/playground/gifenc.bundle.js`).

**Why:** A 30-frame 1280×720 GIF freezes the main thread for 8–15 s if encoded inline. The worker keeps the UI responsive and even allows a progress indicator.

**Bundle approach:** `scripts/bundle-gifenc-worker.mjs` uses esbuild to produce an IIFE bundle in `public/playground/`. Don't try to bundle it via Next.js — webpack mangles worker globals.

**Never:** Don't move encoding to the main thread for "simplicity". The UX cliff is real.

---

## 9. Cloud icons: vendor SVGs, attribution preserved

**Decision:** Bundle official Azure / AWS / GCP service icon SVGs under `public/cloud-icons/{cloud}/{category}/{slug}.svg`. A footer attribution remains visible at all times.

**Why:**
- Recognisability is core to the value prop — users want the *real* Azure App Service icon, not a generic box
- Vendors permit this kind of educational use of their service icons (each has its own brand guidelines)
- Attribution footer + "not affiliated" disclaimer keeps us on the right side of the trademark line

**Manifest:** `scripts/build-cloud-icon-manifest.mjs` walks `public/cloud-icons/` and emits `content/cloud-icons.json` (gitignored — regenerated on prebuild). Page reads it server-side.

**Never:** Remove the attribution footer. Never claim affiliation. Never recolour vendor icons in a way that suggests endorsement.

---

## 10. CI/CD: GitHub Actions → Kudu zipdeploy

**Decision:** Same pipeline as portfolio. See `.github/workflows/deploy.yml`.

**Why:** Battle-tested in the portfolio repo. All the lessons (CO-5 through CO-9 in `.claude/lessons.md`) carry over.

**Secrets:** `AZURE_DEPLOY_USER`, `AZURE_DEPLOY_PASSWORD` (passed via `env:` block, never inline).

---

## 11. No analytics / no tracking by default

**Decision:** No analytics SDK ships in the default build. Application Insights is **opt-in** via `NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING` (when added).

**Why:**
- Privacy — don't track users without an obvious benefit
- Performance — every analytics SDK adds 30–80 KB and a third-party connect
- Simplicity — fewer moving parts

**If we ever need analytics:** App Insights via the same pattern as portfolio (client-only `AppInsightsProvider`).

---

## 12. No theme toggle in v1 (system preference only)

**Decision:** Dark mode follows system preference. No in-app toggle.

**Why:**
- Reduces hydration risk (theme toggle is the #1 source of hydration mismatches — see lesson 55 in portfolio)
- Most users on a "design tool" expect it to inherit their system theme
- Saves a UI element on a tool that needs every pixel for the canvas

**Future:** Add an explicit toggle if user feedback demands it. Use the `mounted` flag pattern from portfolio lessons.

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      BUILD-TIME                              │
│                                                              │
│  public/cloud-icons/**/*.svg                                 │
│         ↓                                                    │
│  scripts/build-cloud-icon-manifest.mjs                       │
│         ↓                                                    │
│  content/cloud-icons.json (gitignored)                       │
│                                                              │
│  scripts/bundle-gifenc-worker.mjs                            │
│         ↓                                                    │
│  public/playground/gifenc.bundle.js (gitignored)             │
├──────────────────────────────────────────────────────────────┤
│                      SERVER (page render)                    │
│                                                              │
│  app/page.tsx → reads content/cloud-icons.json + templates   │
│              → passes as serializable props to client         │
├──────────────────────────────────────────────────────────────┤
│                      CLIENT (runtime)                        │
│                                                              │
│  PlaygroundClient → dynamic import (ssr:false) Playground    │
│                                                              │
│  Playground.tsx                                              │
│    ├── useReducer(historyReducer)         ← undo/redo state  │
│    ├── PlaygroundUIProvider               ← selection / etc  │
│    ├── useAutosave(graph)                 ← localStorage     │
│    ├── useSequencePlayer(edges)           ← playback         │
│    └── <Toolbar /> <Palette /> <Canvas /> <Inspector />      │
│                                                              │
│  Canvas → React Flow surface (nodeTypes/edgeTypes module-    │
│           scoped, all custom nodes memo'd)                   │
│                                                              │
│  Export:                                                     │
│    PNG  → html-to-image.toPng (main thread, fast)            │
│    JSON → JSON.stringify + Blob download                     │
│    GIF  → frame-by-frame setEdges → toPng → postMessage to   │
│           Worker("/playground/gifenc.bundle.js") → blob      │
├──────────────────────────────────────────────────────────────┤
│                      DEPLOY                                  │
│                                                              │
│  git push → GitHub Actions → npm run build → zip standalone  │
│           → Kudu /api/zipdeploy → Azure App Service restart  │
└──────────────────────────────────────────────────────────────┘
```
