<p align="center">
  <img src="docs/images/architecture-studio.png" alt="Diagrammatic enterprise cloud architecture studio" width="100%" />
</p>

<p align="center">
  <strong>Design enterprise cloud systems, explain request flows, and export presentation-ready diagrams from one local-first workspace.</strong>
</p>

<p align="center">
  <a href="https://architecture-playground.azurewebsites.net">Live demo</a>
  ·
  <a href="#demo-walkthrough">Watch demo</a>
  ·
  <a href="#application-screenshots">Screenshots</a>
  ·
  <a href="#architecture">Architecture</a>
  ·
  <a href="#run-locally">Run locally</a>
  ·
  <a href="#deploy-to-azure">Deploy to Azure</a>
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-0b1220?logo=nextdotjs" />
  <img alt="React" src="https://img.shields.io/badge/React-19-0b1220?logo=react" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-0b1220?logo=typescript" />
  <img alt="Playwright" src="https://img.shields.io/badge/E2E-Playwright-0b1220?logo=playwright" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-22d3ee" />
</p>

> The hosted demo is protected by a shared workspace credential. Local
> authentication is disabled by default. Diagrams, comments, and version
> snapshots stay in the browser unless you explicitly export them.

---

## What is Diagrammatic?

Diagrammatic is an open-source, browser-based diagram workspace built for cloud
architects, engineers, product teams, and technical storytellers. It combines
nine diagram modes behind one enterprise shell:

| Mode | Engine | Primary use |
| --- | --- | --- |
| Cloud Architecture | React Flow | Azure, AWS, GCP, and multi-cloud system design |
| Flowchart | React Flow | Processes, decisions, and operational flows |
| Mind Map | React Flow | Discovery, planning, and concept decomposition |
| Sequence Diagram | React Flow | Participant lifelines and message order |
| ER Diagram | React Flow | Entities, relationships, and SQL DDL |
| UML | React Flow | Classes, interfaces, and TypeScript export |
| C4 / System | React Flow | Person, system, container, and component views |
| Kanban | dnd-kit | Sprint planning, WIP limits, and Markdown export |
| Whiteboard | Excalidraw | Freehand ideation, 600 symbols, libraries, and AI images |

Cloud Architecture is the flagship experience. It includes **1,433 cloud service
icons**, generic architecture primitives, boundaries, reliable four-way
connections, explicit flow stages, validation, comments, versions, and smooth
animated GIF export.

## Why use it?

| Use case | What Diagrammatic provides |
| --- | --- |
| Architecture review | Clean boundaries, protocols, validation, and high-resolution PDF/PNG/SVG export |
| Executive walkthrough | Numbered request stages and smooth synchronized GIF motion |
| Multi-cloud design | Searchable Azure, AWS, and GCP service catalogs |
| Design workshop | Whiteboard drawing, 600 bundled symbols, and optional community libraries |
| Engineering handoff | JSON round-trip plus SQL, TypeScript, and Markdown exports |
| Rapid scaffolding | Enterprise templates, deterministic prompt scaffolding, and optional Azure OpenAI |
| Offline/private drafting | Browser-local autosave without accounts or a backend database |

## Product experience

1. Start blank or choose a tested enterprise template.
2. Search the asset catalog and place cloud services or generic primitives.
3. Connect services from any side and label the protocol or responsibility.
4. Organize components inside tier, region, or workload boundaries.
5. Select each connection and assign its GIF/playback step.
6. Give related arrows the same step to animate them together.
7. Review disconnected nodes and missing labels in the validation rail.
8. Save locally, capture a version, or add scoped comments.
9. Export PNG, SVG, PDF, JSON, or a smooth request-flow GIF.

## Demo walkthrough

The exported GIF below is produced by Diagrammatic itself. Service cards remain
static while each numbered flow stage renders six deterministic motion frames.
Arrows with the same step number move in sync.

<p align="center">
  <img src="docs/images/architecture-flow.gif" alt="Animated enterprise Azure request flow exported by Diagrammatic" width="100%" />
</p>

## Application screenshots

<table>
  <tr>
    <td width="50%">
      <img src="docs/images/project-hub.png" alt="Diagrammatic project hub with prompt and diagram modes" />
    </td>
    <td width="50%">
      <img src="docs/images/template-gallery.png" alt="Diagrammatic architecture template gallery" />
    </td>
  </tr>
  <tr>
    <td align="center"><strong>Project hub</strong><br />Start from a prompt, blank mode, recent draft, or cloud pattern.</td>
    <td align="center"><strong>Template gallery</strong><br />Filter tested architecture patterns by provider, category, and level.</td>
  </tr>
</table>

<table>
  <tr>
    <td width="50%">
      <img src="docs/images/architecture-studio.png" alt="Enterprise cloud architecture canvas with boundaries and ordered flows" />
    </td>
    <td width="50%">
      <img src="docs/images/whiteboard-assets.png" alt="Whiteboard with 600 bundled Lucide symbols" />
    </td>
  </tr>
  <tr>
    <td align="center"><strong>Architecture Studio</strong><br />Build, validate, animate, and export enterprise cloud diagrams.</td>
    <td align="center"><strong>Whiteboard assets</strong><br />Search 600 bundled symbols or opt into external Excalidraw libraries.</td>
  </tr>
</table>

## Architecture

<p align="center">
  <img src="docs/assets/architecture.svg" alt="Diagrammatic application architecture" width="100%" />
</p>

Diagrammatic is a Next.js App Router application. Server components load static
asset manifests; the client workspace dynamically mounts the engine for the
active mode.

- **Structured canvases:** React Flow powers Architecture, Flowchart, Mind Map,
  Sequence, ER, UML, and C4.
- **Specialized canvases:** Excalidraw powers Whiteboard; dnd-kit powers Kanban.
- **Local-first state:** mode drafts, comments, versions, and Whiteboard files
  are stored in `localStorage`.
- **AI:** Next.js route handlers call Azure OpenAI. Image generation streams SSE
  heartbeats so long-running `gpt-image-2` requests survive proxy idle timeouts.
- **Exports:** `html-to-image`, jsPDF, and gifenc produce full-diagram artifacts.
  GIF frames are encoded as they are captured to keep memory bounded.
- **Deployment:** `output: "standalone"` produces a self-contained Azure App
  Service package deployed through GitHub Actions and Kudu zipdeploy.

### Technology

| Layer | Main technologies |
| --- | --- |
| Application | Next.js 16 App Router, React 19, strict TypeScript |
| Styling | Tailwind CSS 4, Lucide, Framer Motion |
| Diagram engines | React Flow, Excalidraw, dnd-kit |
| Export | html-to-image, jsPDF, gifenc |
| Validation | Zod and mode-specific structural checks |
| AI | Azure OpenAI chat completions and `gpt-image-2` |
| Testing | Node test runner and Playwright |
| Hosting | Azure App Service, GitHub Actions, Kudu zipdeploy |

## Feature highlights

### Microsoft CSA workspace

- Searchable Azure Architecture Center patterns and design principles with
  first-party Microsoft Learn links, tradeoffs, and applicable blueprints
- Azure Landing Zones IaC Accelerator planning for Bicep or Terraform and
  GitHub or Azure DevOps, including all eight platform design areas
- Cloud Adoption Framework journey tracking across Strategy, Plan, Ready,
  Adopt, Govern, Secure, and Manage
- Evidence-based Azure Well-Architected assessment across all five pillars
- Architecture-to-code generation for Bicep, Terraform, Azure CLI, and Azure
  PowerShell, with unsupported-service and RBAC coverage warnings
- LLM-assisted review of the active canvas, an imported Diagrammatic JSON file,
  or a written architecture description across Architecture Center, Landing
  Zones, CAF, and WAF
- User-confirmed Azure Portal deployment handoff through a short-lived ARM
  template URL; Diagrammatic never receives Azure credentials or silently
  creates resources

### Enterprise architecture authoring

- 1,433 Azure, AWS, and GCP service icons
- Generic component, actor, database, decision, document, and internet shapes
- Tier/region/workload boundaries with child containment
- Four-way loose connection handles and selectable edge labels
- Solid, dashed, and animated flow styles
- Explicit synchronized playback stages
- Architecture validation for disconnected or unlabeled components

### Presentation-quality export

- High-resolution full-diagram PNG
- Editable SVG
- Fitted landscape or portrait PDF
- Re-importable JSON
- Smooth animated GIF with six motion frames per stage
- SQL DDL from ER, TypeScript from UML, and Markdown from Kanban

### Local collaboration

- Debounced browser autosave
- Scoped comments
- Restorable version snapshots
- No account or remote database

### Whiteboard

- Native Excalidraw drawing tools
- 600 bundled Lucide symbols generated at build time
- Optional user-initiated Excalidraw community libraries
- Azure OpenAI image generation and direct canvas insertion
- PNG export

## Run locally

### Prerequisites

- Git
- Node.js 20 or newer
- npm

### Start the workspace

```powershell
git clone https://github.com/sauravraghuvanshi/architecture-playground.git
Set-Location architecture-playground
npm install
npm run build:icon-manifest
npm run build:whiteboard-assets
npm run dev
```

Open <http://localhost:3000>.

The two asset commands generate:

- `content/cloud-icons.json` from the checked-in provider SVGs;
- `public/whiteboard-assets.json` with exactly 600 curated Lucide symbols.

## Configure the access gate

The production workspace can be protected with one environment-backed shared
credential. Values are validated server-side and are never committed to source.

```dotenv
APP_AUTH_ENABLED=true
APP_AUTH_USERNAME=<workspace-user>
APP_AUTH_PASSWORD=<strong-password>
APP_AUTH_SECRET=<random-secret-at-least-32-characters>
```

Successful sign-in issues an eight-hour, signed, HttpOnly, SameSite=Strict
cookie. Login attempts are rate limited. Leave `APP_AUTH_ENABLED` unset for an
open local development workspace.

## Configure AI

AI is optional. Copy `.env.example` to `.env.local` and configure only the
features you need.

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Prompt-to-diagram
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_API_KEY=<key>
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-10-21

# Whiteboard image generation
AZURE_OPENAI_IMAGE_ENDPOINT=https://<image-resource>.openai.azure.com
AZURE_OPENAI_IMAGE_API_KEY=<key>
AZURE_OPENAI_IMAGE_DEPLOYMENT=gpt-image-2
```

When local image credentials are absent, development proxies Whiteboard image
requests through the configured public Diagrammatic demo without exposing Azure
keys. Prompts are sent to that hosted endpoint. Set
`DIAGRAMMATIC_AI_PROXY_URL=disabled` to opt out, or set it to another trusted
Diagrammatic deployment.

The Azure Portal deployment handoff also uses `NEXT_PUBLIC_SITE_URL`. It must be
the public HTTPS URL of the Diagrammatic deployment so Azure Portal can retrieve
the random, short-lived template. Localhost deployments can generate and
download code but intentionally cannot open the portal handoff.

## Test

```powershell
npm run lint
npx tsc --noEmit
npm run test:playground
npm run test:e2e
npm run build
```

The regression suites cover:

- every diagram mode and blank-canvas action;
- held connection drags and node visibility;
- synchronized GIF stages and static service cards;
- all 16 architecture template imports;
- Whiteboard symbol insertion and persisted reload;
- mode-specific AI status and mocked SSE image insertion;
- public-page visual-system and capability-claim consistency.

## Deploy to Azure

The application uses Next.js standalone output:

```text
next build
  -> .next/standalone/server.js
  -> postbuild copies public/ and .next/static/
  -> zip standalone output
  -> Kudu zipdeploy
```

`.github/workflows/deploy.yml` deploys pushes to `master`. Configure these GitHub
repository secrets:

- `AZURE_DEPLOY_USER`
- `AZURE_DEPLOY_PASSWORD`

The workflow builds with Node.js 20, creates `deploy.zip`, submits it to the App
Service SCM endpoint, and performs an HTTP health check after restart.

## Security and privacy

- Shared sign-in gate without individual user profiles or a cloud database
- CSP, HSTS, X-Frame-Options, Permissions-Policy, and COOP headers
- AI rate limiting with explicit 429 responses
- Azure credentials remain server-side
- Community Whiteboard libraries require explicit user action and a licensing notice
- Whiteboard image prompts can be kept local by configuring your own image endpoint

See [docs/security.md](docs/security.md) and
[docs/asset-licensing.md](docs/asset-licensing.md).

## Project layout

```text
app/
  api/ai/                  Azure OpenAI routes
  diagrammatic/            Multi-mode workspace route
  templates/               Architecture template gallery
components/
  diagrammatic/
    modes/                 Architecture, Flowchart, Mind Map, Sequence,
                           ER, UML, C4, Kanban, Whiteboard
    shared/                Toolbar, palettes, inspector, comments, versions
  hub/                     Project hub
  marketing/               About page
content/
  playground-templates/    Parameterized architecture templates
public/
  cloud-icons/             Azure, AWS, and GCP assets
  whiteboard-assets.json   Generated 600-symbol manifest
e2e/                       Playwright acceptance and regression suites
scripts/                   Asset generation, smoke tests, and postbuild
```

## Asset licensing

The application code is MIT licensed. Excalidraw is MIT licensed. The bundled
Whiteboard symbols are Lucide assets under ISC/MIT terms.

Cloud provider icons remain owned by Microsoft, Amazon, and Google and are used
for architecture-diagram purposes. Optional community libraries may contain
separately governed logos or trademarks.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and
[docs/asset-licensing.md](docs/asset-licensing.md) before redistributing assets.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), then open an issue or pull request.

## Latest engineering log

See [Development log — 2026-08-11/12](docs/development-log-2026-08-11.md)
for the complete delivery summary, production blockers, root-cause resolutions,
validation evidence, and key learnings from the architecture studio release.

## License

[MIT](LICENSE) © Saurav Raghuvanshi.
